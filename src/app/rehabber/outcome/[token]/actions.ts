"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { verifyMagicToken, MagicLinkError } from "@/lib/auth/magic-link";
import { getServiceSupabase } from "@/lib/db/supabase";
import { getMemory } from "@/lib/memory";
import { applyOutcomeToSignals, type Outcome } from "@/lib/memory/helpers";
import type { Case, Referral, Rehabber } from "@/lib/db/types";
import type { Signals, SignalsByRehabber } from "@/lib/memory/types";

const OUTCOMES: ReadonlyArray<Outcome> = [
  "accepted",
  "declined",
  "transferred",
  "closed",
];

export interface SubmitOutcomeResult {
  ok: boolean;
  code?:
    | "INVALID_TOKEN"
    | "EXPIRED"
    | "NOT_FOUND"
    | "ALREADY_SUBMITTED"
    | "BAD_INPUT"
    | "DB_ERROR";
  message?: string;
}

/**
 * Case-status rule (inline doc so we don't edit techdesign §4):
 *   accepted             → cases.status='accepted'
 *   declined             → cases.status stays 'referred' (other rehabbers can still accept)
 *   transferred | closed → cases.status='closed'
 */
function caseStatusFor(outcome: Outcome): "accepted" | "closed" | null {
  if (outcome === "accepted") return "accepted";
  if (outcome === "transferred" || outcome === "closed") return "closed";
  return null; // declined: leave as-is
}

export async function submitOutcome(
  token: string,
  formData: FormData,
): Promise<SubmitOutcomeResult> {
  const outcomeRaw = String(formData.get("outcome") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const speciesCorrection =
    String(formData.get("species_correction") ?? "").trim() || null;

  if (!OUTCOMES.includes(outcomeRaw as Outcome)) {
    return { ok: false, code: "BAD_INPUT", message: "invalid outcome" };
  }
  const outcome = outcomeRaw as Outcome;

  const sb = getServiceSupabase();

  // Decode referralId from the token so we can look up the stored hash.
  const firstDot = token.indexOf(".");
  if (firstDot <= 0) {
    return { ok: false, code: "INVALID_TOKEN", message: "malformed token" };
  }
  const referralId = token.slice(0, firstDot);

  const { data: refRow, error: refErr } = await sb
    .from("referrals")
    .select("*")
    .eq("id", referralId)
    .maybeSingle();
  if (refErr || !refRow) {
    return { ok: false, code: "NOT_FOUND", message: "referral not found" };
  }
  const referral = refRow as Referral;

  if (referral.outcome) {
    return { ok: false, code: "ALREADY_SUBMITTED" };
  }

  try {
    verifyMagicToken(token, referral.magic_token_hash);
  } catch (err) {
    if (err instanceof MagicLinkError) {
      return {
        ok: false,
        code: err.code === "EXPIRED" ? "EXPIRED" : "INVALID_TOKEN",
        message: err.message,
      };
    }
    return { ok: false, code: "INVALID_TOKEN" };
  }

  if (new Date(referral.magic_expires_at).getTime() < Date.now()) {
    return { ok: false, code: "EXPIRED" };
  }

  // Load case + rehabber for memory signals.
  const [{ data: caseRow }, { data: rehabRow }] = await Promise.all([
    sb.from("cases").select("*").eq("id", referral.case_id).maybeSingle(),
    sb.from("rehabbers").select("*").eq("id", referral.rehabber_id).maybeSingle(),
  ]);
  const caseData = caseRow as Case | null;
  const rehabber = rehabRow as Rehabber | null;
  if (!caseData || !rehabber) {
    return { ok: false, code: "NOT_FOUND", message: "case/rehabber missing" };
  }

  const nowIso = new Date().toISOString();

  // Atomic-ish single-use enforcement: condition the UPDATE on outcome IS NULL.
  const { data: updated, error: updErr } = await sb
    .from("referrals")
    .update({
      outcome,
      outcome_at: nowIso,
      outcome_notes: notes,
    })
    .eq("id", referralId)
    .is("outcome", null)
    .select("id")
    .maybeSingle();
  if (updErr) {
    return { ok: false, code: "DB_ERROR", message: updErr.message };
  }
  if (!updated) {
    return { ok: false, code: "ALREADY_SUBMITTED" };
  }

  // Case status update per rule above.
  const nextCaseStatus = caseStatusFor(outcome);
  if (nextCaseStatus) {
    await sb
      .from("cases")
      .update({ status: nextCaseStatus })
      .eq("id", caseData.id);
  }

  // Memory write. Query current signals for this rehabber first so
  // applyOutcomeToSignals has a prev snapshot.
  let prev: Signals = {};
  try {
    const all: SignalsByRehabber = await getMemory().query([rehabber.id]);
    prev = all[rehabber.id] ?? {};
  } catch {
    // Empty prev is fine; helper handles undefineds.
  }

  const responseMs = Math.max(
    0,
    Date.now() - new Date(referral.sent_at).getTime(),
  );
  const speciesForSignal =
    speciesCorrection ?? caseData.species ?? undefined;

  const entries = applyOutcomeToSignals(prev, outcome, {
    species: speciesForSignal ?? undefined,
    responseMs,
    capacityBefore: rehabber.capacity,
  });

  // If the rehabber corrected the species AND it differs from the case's,
  // also reinforce the corrected species as an accepted scope. The helper
  // already reinforced the corrected species above when passed as `species`,
  // so this branch only fires when we need a second entry for the ORIGINAL.
  if (
    speciesCorrection &&
    caseData.species &&
    speciesCorrection.toLowerCase() !== caseData.species.toLowerCase() &&
    outcome === "accepted"
  ) {
    const extra = applyOutcomeToSignals(prev, "accepted", {
      species: caseData.species,
    }).filter((e) => e.key === "species_scope");
    entries.push(...extra);
  }

  try {
    await getMemory().upsert(rehabber.id, entries);
  } catch (err) {
    console.error(
      `[outcome] memory upsert failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    // Non-fatal — the referral/case status already landed.
  }

  revalidatePath("/admin/cases");
  redirect(`/rehabber/outcome/${encodeURIComponent(token)}/confirm`);
}
