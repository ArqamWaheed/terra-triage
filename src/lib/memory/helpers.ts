import type {
  AcceptRateVal,
  CapacityVal,
  GeoAccuracyVal,
  MemoryEntryInput,
  ResponseMsVal,
  Signals,
  SpeciesScopeVal,
} from "./types";

export type Outcome = "accepted" | "declined" | "transferred" | "closed";

export interface ApplyOutcomeOpts {
  species?: string;
  responseMs?: number;
  capacityBefore?: number;
  geoCorrectionKm?: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function rollingAvg(prev: ResponseMsVal | undefined, sample: number): ResponseMsVal {
  const n = (prev?.n ?? 0) + 1;
  const prevAvg = prev?.avg_ms ?? sample;
  const avg_ms = Math.round(prevAvg + (sample - prevAvg) / n);
  return { n, avg_ms };
}

function rollingMedianLike(
  prev: GeoAccuracyVal | undefined,
  sampleKm: number,
): GeoAccuracyVal {
  // True streaming median is overkill; use a running average as a stand-in.
  // Label stays `km_median` to match techdesign §9 without breaking readers.
  const n = (prev?.n ?? 0) + 1;
  const prevMed = prev?.km_median ?? sampleKm;
  const km_median = prevMed + (sampleKm - prevMed) / n;
  return { km_median, n };
}

/**
 * Pure reducer: given the previous signals snapshot and an outcome event,
 * return the list of (key, value) entries that should be upserted.
 *
 * - capacity.remaining decrements on 'accepted' (floored at 0).
 * - accept_rate updates n/accepted/rate on every outcome.
 * - species_scope reinforces +0.1 on accept, -0.05 on decline; clamped [0,1].
 * - response_ms is a rolling average when opts.responseMs is provided.
 * - geo_accuracy only moves when opts.geoCorrectionKm is provided.
 */
export function applyOutcomeToSignals(
  prev: Signals,
  outcome: Outcome,
  opts: ApplyOutcomeOpts = {},
): MemoryEntryInput[] {
  const out: MemoryEntryInput[] = [];
  const now = new Date().toISOString();

  // capacity: only definitive on accept; leave untouched otherwise unless
  // caller gave us a fresh capacityBefore value to anchor on.
  if (outcome === "accepted") {
    const base =
      opts.capacityBefore ?? prev.capacity?.remaining ?? 0;
    const next: CapacityVal = {
      remaining: Math.max(0, base - 1),
      updated_at: now,
    };
    out.push({ key: "capacity", value: next });
  } else if (typeof opts.capacityBefore === "number") {
    const next: CapacityVal = {
      remaining: Math.max(0, opts.capacityBefore),
      updated_at: now,
    };
    out.push({ key: "capacity", value: next });
  }

  // accept_rate: count every outcome.
  const prevAr = prev.accept_rate;
  const n = (prevAr?.n ?? 0) + 1;
  const accepted = (prevAr?.accepted ?? 0) + (outcome === "accepted" ? 1 : 0);
  const rate = n === 0 ? 0 : accepted / n;
  const nextAr: AcceptRateVal = { n, accepted, rate };
  out.push({ key: "accept_rate", value: nextAr });

  // species_scope: reinforce / decay per outcome.
  if (opts.species) {
    const scope: SpeciesScopeVal = { ...(prev.species_scope ?? {}) };
    const key = opts.species.trim().toLowerCase();
    if (key.length > 0) {
      const cur = scope[key] ?? 0.5;
      const delta =
        outcome === "accepted" ? 0.1 : outcome === "declined" ? -0.05 : 0;
      if (delta !== 0) {
        scope[key] = clamp01(cur + delta);
        out.push({ key: "species_scope", value: scope });
      }
    }
  }

  // response_ms: rolling average when the caller measured it.
  if (typeof opts.responseMs === "number" && opts.responseMs >= 0) {
    out.push({
      key: "response_ms",
      value: rollingAvg(prev.response_ms, opts.responseMs),
    });
  }

  // geo_accuracy: only when caller provides a correction.
  if (typeof opts.geoCorrectionKm === "number" && opts.geoCorrectionKm >= 0) {
    out.push({
      key: "geo_accuracy",
      value: rollingMedianLike(prev.geo_accuracy, opts.geoCorrectionKm),
    });
  }

  return out;
}
