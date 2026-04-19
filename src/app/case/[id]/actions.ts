"use server";

import { revalidatePath } from "next/cache";

import { runFinder, TriageError, synthesizeUnknown } from "@/lib/agents/finder";
import {
  dispatchReferral,
  DispatcherError,
  type DispatcherErrorCode,
} from "@/lib/agents/dispatcher";
import { rankRehabbersWithMemory } from "@/lib/agents/rank-with-memory";
import { getSession } from "@/lib/auth/client";
import { getPublicRehabbers } from "@/lib/db/rehabbers";
import { getServiceSupabase } from "@/lib/db/supabase";
import type { Case, TriageResult } from "@/lib/db/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RunTriageResult =
  | { ok: true; case: Case; cached: boolean; degraded?: string }
  | { ok: false; reason: string; message: string };

async function downloadPhoto(
  supabase: ReturnType<typeof getServiceSupabase>,
  path: string,
): Promise<{ bytes: Uint8Array; mime: string }> {
  const { data, error } = await supabase.storage.from("photos").download(path);
  if (error || !data) {
    throw new Error(error?.message ?? "photo download failed");
  }
  const ab = await data.arrayBuffer();
  return {
    bytes: new Uint8Array(ab),
    mime: data.type || "image/jpeg",
  };
}

function toTriagePatch(r: TriageResult): Partial<Case> {
  return {
    species: r.species,
    species_confidence: r.species_confidence,
    severity: r.severity,
    safety_advice: r.safety_advice,
    status: "triaged",
  };
}

export async function runTriageForCase(
  caseId: string,
): Promise<RunTriageResult> {
  if (!UUID_RE.test(caseId)) {
    return { ok: false, reason: "bad_id", message: "Invalid case id." };
  }
  const supabase = getServiceSupabase();

  const { data: row, error: readErr } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();
  if (readErr || !row) {
    return {
      ok: false,
      reason: "not_found",
      message: readErr?.message ?? "Case not found.",
    };
  }
  const existing = row as Case;

  // Idempotent: if already triaged (or past it), return as-is.
  if (existing.status !== "new") {
    return { ok: true, case: existing, cached: false };
  }
  if (!existing.photo_path) {
    return {
      ok: false,
      reason: "no_photo",
      message: "Case has no photo on storage.",
    };
  }

  let patch: Partial<Case>;
  let cached = false;
  let degraded: string | undefined;

  try {
    const { bytes, mime } = await downloadPhoto(supabase, existing.photo_path);
    const result = await runFinder({
      imageBytes: bytes,
      mimeType: mime,
      lat: existing.lat,
      lng: existing.lng,
    });
    cached = result.cached;
    degraded = result.degraded;
    patch = toTriagePatch(result);
  } catch (err) {
    // Hard failure — still mark the case 'triaged' with a conservative
    // fallback payload so the dispatcher can rank by proximity only.
    const reason =
      err instanceof TriageError ? err.reason : "vision_unavailable";
    const fallback = synthesizeUnknown();
    patch = toTriagePatch(fallback);
    degraded = `fallback:${reason}`;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("cases")
    .update(patch)
    .eq("id", caseId)
    .eq("status", "new")
    .select("*")
    .maybeSingle();

  if (updateErr) {
    return {
      ok: false,
      reason: "db_update_failed",
      message: updateErr.message,
    };
  }

  // If the row moved past 'new' between our read and update (a concurrent
  // run), re-fetch the current row and return it.
  const finalRow =
    (updated as Case | null) ??
    ((
      await supabase.from("cases").select("*").eq("id", caseId).maybeSingle()
    ).data as Case | null);

  if (!finalRow) {
    return {
      ok: false,
      reason: "not_found",
      message: "Case disappeared mid-update.",
    };
  }

  revalidatePath(`/case/${caseId}`);
  return { ok: true, case: finalRow, cached, degraded };
}

// ---------------------------------------------------------------------------
// Phase 6 — Auth0 PAR + Resend dispatcher.
// ---------------------------------------------------------------------------
const TOP_N = 5;

export type SendReferralResult =
  | {
      ok: true;
      referralId: string;
      emailProviderId: string;
      mode: "user-consented" | "m2m-fallback";
      transport: "resend" | "gmail-smtp";
      rehabberName: string;
    }
  | { ok: false; code: DispatcherErrorCode | "UNAUTHENTICATED" | "BAD_INPUT"; message: string };

export async function sendReferralAction(
  caseId: string,
  rehabberId: string,
): Promise<SendReferralResult> {
  if (!UUID_RE.test(caseId) || !UUID_RE.test(rehabberId)) {
    return { ok: false, code: "BAD_INPUT", message: "Invalid ids" };
  }
  const session = await getSession();
  const userSub = session?.user?.sub as string | undefined;
  if (!userSub) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Sign in required to dispatch referrals.",
    };
  }

  const sb = getServiceSupabase();
  const { data: row, error: readErr } = await sb
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();
  if (readErr || !row) {
    return { ok: false, code: "CASE_NOT_FOUND", message: "Case not found." };
  }
  const caseRow = row as Case;
  if (caseRow.status !== "triaged" && caseRow.status !== "referred") {
    return {
      ok: false,
      code: "CASE_INVALID_STATE",
      message: `Case status is ${caseRow.status}; cannot dispatch.`,
    };
  }

  // Re-rank server-side and pin the snapshot for rank_explain. Rejects a
  // tampered rehabberId not present in our top-N.
  const rehabbers = await getPublicRehabbers();
  const ranked = await rankRehabbersWithMemory(
    {
      species: caseRow.species,
      lat: caseRow.lat,
      lng: caseRow.lng,
    },
    rehabbers,
  );
  const pick = ranked
    .slice(0, TOP_N)
    .find((r) => r.rehabber.id === rehabberId);
  if (!pick) {
    return {
      ok: false,
      code: "BAD_INPUT",
      message: "Rehabber is not in the current top-N for this case.",
    };
  }

  try {
    const result = await dispatchReferral({
      caseId,
      rehabberId,
      userSub,
      rankScore: pick.score,
      rankExplain: pick.explain as unknown as Record<string, unknown>,
    });
    revalidatePath(`/case/${caseId}`);
    return {
      ok: true,
      referralId: result.referralId,
      emailProviderId: result.emailProviderId,
      mode: result.mode,
      transport: result.transport,
      rehabberName: pick.rehabber.name,
    };
  } catch (err) {
    if (err instanceof DispatcherError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return {
      ok: false,
      code: "EMAIL_SEND_FAILED",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
