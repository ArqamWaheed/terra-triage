import "server-only";

import { getServiceSupabase } from "@/lib/db/supabase";
import type { Rehabber, RehabberPublic } from "@/lib/db/types";

/**
 * Read the non-PII rehabber view via the service-role client. RLS on
 * `rehabbers` denies anon; the `rehabbers_public` view grants anon SELECT,
 * but we go through service role here so this helper is usable from any
 * trusted server context (Server Components, Server Actions).
 */
export async function getPublicRehabbers(): Promise<RehabberPublic[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("rehabbers_public")
    .select(
      "id,name,org,phone,lat,lng,species_scope,radius_km,capacity,active,created_at",
    )
    .eq("active", true);
  if (error) throw new Error(`getPublicRehabbers: ${error.message}`);
  return (data ?? []) as RehabberPublic[];
}

/**
 * Privileged read including contact info. For Dispatcher use only (Phase 6);
 * never return this to the client.
 */
export async function getRehabberPrivate(id: string): Promise<Rehabber | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("rehabbers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`getRehabberPrivate: ${error.message}`);
  }
  return data as Rehabber;
}
