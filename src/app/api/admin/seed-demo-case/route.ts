import { NextResponse, type NextRequest } from "next/server";

import { runFinder, synthesizeUnknown, TriageError } from "@/lib/agents/finder";
import { checkAdminBasicAuth } from "@/lib/auth/admin-basic-auth";
import { getServiceSupabase } from "@/lib/db/supabase";
import type { Case, TriageResult } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stable UUID for the demo case so repeated seeds are idempotent (upsert).
const DEMO_CASE_ID = "11111111-2222-3333-4444-555555555555";
// Central Park, NYC — well-known demo spot with real coordinates.
const DEMO_LAT = 40.7829;
const DEMO_LNG = -73.9654;
const DEMO_FINDER_EMAIL = "demo-seed@terra-triage.app";

function triagePatch(r: TriageResult): Partial<Case> {
  return {
    species: r.species,
    species_confidence: r.species_confidence,
    severity: r.severity,
    safety_advice: r.safety_advice,
    status: "triaged",
  };
}

/**
 * Seed a reproducible demo case in one tap. Idempotent via a fixed UUID: if
 * the case already exists, its triage fields are refreshed but IDs stay stable
 * so linked referrals survive repeated calls.
 *
 * Runs the real Finder when a reusable photo exists in the `photos` bucket;
 * otherwise falls back to the production `synthesizeUnknown()` fallback path.
 * Never mocks agent behavior.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const blocked = checkAdminBasicAuth(req);
  if (blocked) return blocked;

  const sb = getServiceSupabase();

  // Reuse any existing photo so the full dispatch flow (signed URL + email)
  // still works on the seeded case without uploading anything new.
  const { data: photoSrc } = await sb
    .from("cases")
    .select("photo_path")
    .neq("photo_path", "")
    .not("photo_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const photoPath = (photoSrc?.photo_path as string | null) ?? "";

  // Upsert the case row first — fixed UUID keeps this idempotent.
  const { error: upErr } = await sb
    .from("cases")
    .upsert(
      {
        id: DEMO_CASE_ID,
        lat: DEMO_LAT,
        lng: DEMO_LNG,
        finder_email: DEMO_FINDER_EMAIL,
        photo_path: photoPath,
        status: "new",
        species: null,
        species_confidence: null,
        severity: null,
        safety_advice: null,
      },
      { onConflict: "id" },
    );
  if (upErr) {
    return NextResponse.json(
      { error: `case upsert failed: ${upErr.message}` },
      { status: 500 },
    );
  }

  // Run the real Finder when a photo is available; populates triage_cache.
  let triage: TriageResult;
  let degraded: string | undefined;
  if (photoPath) {
    try {
      const { data, error } = await sb.storage.from("photos").download(photoPath);
      if (error || !data) throw error ?? new Error("photo download failed");
      const bytes = new Uint8Array(await data.arrayBuffer());
      const result = await runFinder({
        imageBytes: bytes,
        mimeType: data.type || "image/jpeg",
        lat: DEMO_LAT,
        lng: DEMO_LNG,
      });
      triage = result;
      degraded = result.degraded;
    } catch (err) {
      // Real fallback path — same as production runTriageForCase.
      triage = synthesizeUnknown();
      degraded = `fallback:${
        err instanceof TriageError ? err.reason : "vision_unavailable"
      }`;
    }
  } else {
    triage = synthesizeUnknown();
    degraded = "fallback:no_photo";
  }

  const { error: patchErr } = await sb
    .from("cases")
    .update(triagePatch(triage))
    .eq("id", DEMO_CASE_ID);
  if (patchErr) {
    return NextResponse.json(
      { error: `triage patch failed: ${patchErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    caseId: DEMO_CASE_ID,
    created: true,
    photoReused: Boolean(photoPath),
    degraded: degraded ?? null,
  });
}
