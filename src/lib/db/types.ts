// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Replace with `supabase gen types typescript` output post-MVP.

export type CaseStatus =
  | "new"
  | "triaged"
  | "referred"
  | "accepted"
  | "declined"
  | "closed";

export type SpeciesScope =
  | "raptor"
  | "songbird"
  | "waterfowl"
  | "mammal_small"
  | "mammal_medium"
  | "reptile"
  | "bat";

export interface User {
  id: string; // Auth0 sub
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface Rehabber {
  id: string;
  name: string;
  org: string | null;
  email: string;
  phone: string | null;
  lat: number;
  lng: number;
  species_scope: SpeciesScope[];
  radius_km: number;
  capacity: number;
  active: boolean;
  created_at: string;
}

// Mirror of the rehabbers_public view (no email/phone).
export type RehabberPublic = Omit<Rehabber, "email" | "phone">;

export interface SafetyAdvice {
  touch: boolean;
  containment: string;
  transport: string;
  line: string;
}

export interface Case {
  id: string;
  finder_user_id: string | null;
  finder_email: string | null;
  photo_path: string;
  lat: number;
  lng: number;
  species: string | null;
  species_confidence: number | null;
  severity: 1 | 2 | 3 | 4 | 5 | null;
  safety_advice: SafetyAdvice | null;
  status: CaseStatus;
  created_at: string;
  updated_at: string;
}

export type ReferralOutcome =
  | "accepted"
  | "declined"
  | "transferred"
  | "closed";

export interface Referral {
  id: string;
  case_id: string;
  rehabber_id: string;
  rank_score: number;
  rank_explain: Record<string, unknown> | null;
  email_provider_id: string | null;
  magic_token_hash: string;
  magic_expires_at: string;
  sent_at: string;
  outcome: ReferralOutcome | null;
  outcome_at: string | null;
  outcome_notes: string | null;
}

export type MemoryEntryKey =
  | "capacity"
  | "accept_rate"
  | "species_scope"
  | "response_ms";

export type MemoryEntrySource = "backboard" | "local_fallback";

export interface MemoryEntry {
  id: number;
  rehabber_id: string;
  key: MemoryEntryKey | string;
  value: unknown;
  source: MemoryEntrySource;
  created_at: string;
}

// Finder agent output — cached in triage_cache and embedded in cases.
export interface TriageResult {
  species: string;
  species_common?: string;
  species_confidence: number; // 0..1
  severity: 1 | 2 | 3 | 4 | 5;
  safety_advice: SafetyAdvice;
  should_touch: boolean;
  uncertainty_notes?: string;
}

// Runtime wrapper returned by the Finder agent — adds cache + degradation flags.
export interface TriageRunResult extends TriageResult {
  cached: boolean;
  degraded?: "text_only" | "low_confidence";
}

export type TriageErrorReason =
  | "missing_api_key"
  | "vision_unavailable"
  | "parse_failed"
  | "invalid_image";

export interface TriageCacheRow {
  sha: string;
  response: TriageResult;
  created_at: string;
}
