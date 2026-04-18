import { haversineKm } from "@/lib/utils/geo";
import type { RehabberPublic, SpeciesScope } from "@/lib/db/types";

export interface CapacitySignal {
  remaining: number;
  updated_at?: string;
}
export interface AcceptRateSignal {
  n: number;
  accepted: number;
  rate: number;
}
export interface SpeciesScopeSignal {
  [species: string]: number;
}
export interface ResponseMsSignal {
  n: number;
  avg_ms: number;
}

export interface RehabberSignals {
  capacity?: CapacitySignal;
  accept_rate?: AcceptRateSignal;
  species_scope?: SpeciesScopeSignal;
  response_ms?: ResponseMsSignal;
}

export type SignalsById = Record<string, RehabberSignals | undefined>;

export interface RankInput {
  species: string | null;
  lat: number;
  lng: number;
}

export interface RankExplain {
  speciesMatch: number;
  distanceScore: number;
  capacityScore: number;
  acceptRate: number;
  responseSpeed: number;
  km: number;
  weights: typeof WEIGHTS;
}

export interface Ranked {
  rehabber: RehabberPublic;
  score: number;
  km: number;
  signals: RehabberSignals;
  explain: RankExplain;
}

export const WEIGHTS = {
  speciesMatch: 0.35,
  distanceScore: 0.25,
  capacityScore: 0.2,
  acceptRate: 0.15,
  responseSpeed: 0.05,
} as const;

// Common-name → species_scope key. Kept intentionally small; Phase 7 can
// replace this with Backboard-derived weights per rehabber.
const SPECIES_MAP: Record<string, SpeciesScope> = {
  hawk: "raptor",
  eagle: "raptor",
  owl: "raptor",
  falcon: "raptor",
  osprey: "raptor",
  kestrel: "raptor",
  "red-tailed hawk": "raptor",
  robin: "songbird",
  sparrow: "songbird",
  finch: "songbird",
  warbler: "songbird",
  cardinal: "songbird",
  jay: "songbird",
  duck: "waterfowl",
  goose: "waterfowl",
  swan: "waterfowl",
  heron: "waterfowl",
  mallard: "waterfowl",
  squirrel: "mammal_small",
  rabbit: "mammal_small",
  chipmunk: "mammal_small",
  mouse: "mammal_small",
  opossum: "mammal_small",
  fox: "mammal_medium",
  raccoon: "mammal_medium",
  skunk: "mammal_medium",
  coyote: "mammal_medium",
  turtle: "reptile",
  snake: "reptile",
  lizard: "reptile",
  tortoise: "reptile",
  bat: "bat",
};

export function speciesToScope(species: string | null | undefined): SpeciesScope | null {
  if (!species) return null;
  const key = species.trim().toLowerCase();
  if (SPECIES_MAP[key]) return SPECIES_MAP[key];
  for (const [k, v] of Object.entries(SPECIES_MAP)) {
    if (key.includes(k)) return v;
  }
  return null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function computeSpeciesMatch(
  r: RehabberPublic,
  species: string | null,
): number {
  if (!species) return 0.6; // unknown prior
  const scope = speciesToScope(species);
  if (!scope) return 0.3;
  return r.species_scope.includes(scope) ? 1 : 0.3;
}

function computeDistance(km: number): number {
  return Math.max(0, 1 - km / 100);
}

function computeCapacity(r: RehabberPublic, s?: RehabberSignals): number {
  const base = clamp01(r.capacity / 10);
  const remaining = s?.capacity?.remaining;
  if (typeof remaining === "number") {
    // Blend: seeded capacity 60%, fresh signal 40%.
    return clamp01(base * 0.6 + clamp01(remaining / 10) * 0.4);
  }
  return base;
}

function computeAcceptRate(s?: RehabberSignals): number {
  return clamp01(s?.accept_rate?.rate ?? 0.5);
}

function computeResponseSpeed(s?: RehabberSignals): number {
  const avg = s?.response_ms?.avg_ms ?? 3_600_000; // 1h default
  return 1 - Math.min(1, avg / 86_400_000); // 24h ceiling
}

export function rankRehabbers(
  input: RankInput,
  rehabbers: RehabberPublic[],
  signals: SignalsById = {},
): Ranked[] {
  return rehabbers
    .map<Ranked>((r) => {
      const km = haversineKm(
        { lat: input.lat, lng: input.lng },
        { lat: r.lat, lng: r.lng },
      );
      const sig = signals[r.id] ?? {};
      const speciesMatch = computeSpeciesMatch(r, input.species);
      const distanceScore = computeDistance(km);
      const capacityScore = computeCapacity(r, sig);
      const acceptRate = computeAcceptRate(sig);
      const responseSpeed = computeResponseSpeed(sig);

      const score =
        WEIGHTS.speciesMatch * speciesMatch +
        WEIGHTS.distanceScore * distanceScore +
        WEIGHTS.capacityScore * capacityScore +
        WEIGHTS.acceptRate * acceptRate +
        WEIGHTS.responseSpeed * responseSpeed;

      return {
        rehabber: r,
        score,
        km,
        signals: sig,
        explain: {
          speciesMatch,
          distanceScore,
          capacityScore,
          acceptRate,
          responseSpeed,
          km,
          weights: WEIGHTS,
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}
