"use server";

import { revalidatePath } from "next/cache";

import { runFinder, TriageError, synthesizeUnknown } from "@/lib/agents/finder";
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
      err instanceof TriageError ? err.reason : "gemini_unavailable";
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
