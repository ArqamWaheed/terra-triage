// Shared memory-signal value shapes. Mirrors techdesign §9 Backboard keys.

export type CapacityVal = { remaining: number; updated_at: string };
export type AcceptRateVal = { n: number; accepted: number; rate: number };
export type SpeciesScopeVal = Record<string, number>;
export type ResponseMsVal = { n: number; avg_ms: number };
export type GeoAccuracyVal = { km_median: number; n: number };

export type MemoryKey =
  | "capacity"
  | "accept_rate"
  | "species_scope"
  | "response_ms"
  | "geo_accuracy";

export type MemoryValue =
  | CapacityVal
  | AcceptRateVal
  | SpeciesScopeVal
  | ResponseMsVal
  | GeoAccuracyVal;

export interface Signals {
  capacity?: CapacityVal;
  accept_rate?: AcceptRateVal;
  species_scope?: SpeciesScopeVal;
  response_ms?: ResponseMsVal;
  geo_accuracy?: GeoAccuracyVal;
}

export type SignalsByRehabber = Record<string, Signals>;

export interface MemoryEntryInput {
  key: MemoryKey;
  value: MemoryValue;
}

// Sentinel key used to log fallback events in memory_entries; readers filter
// it out via MEMORY_KEYS below.
export const BACKEND_FALLBACK_KEY = "backend_fallback";

export const MEMORY_KEYS: readonly MemoryKey[] = [
  "capacity",
  "accept_rate",
  "species_scope",
  "response_ms",
  "geo_accuracy",
] as const;
