import "server-only";

import { getServiceSupabase } from "@/lib/db/supabase";
import type { MemoryEntry } from "@/lib/db/types";

/**
 * Latest memory_entries rows for a single rehabber, newest first.
 * Filters out the internal `backend_fallback` sentinel used only for
 * observability logging (see memory/types.ts).
 */
export async function getMemoryEntriesForRehabber(
  rehabberId: string,
  limit = 50,
): Promise<MemoryEntry[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("memory_entries")
    .select("*")
    .eq("rehabber_id", rehabberId)
    .neq("key", "backend_fallback")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`getMemoryEntriesForRehabber: ${error.message}`);
  }
  return (data ?? []) as MemoryEntry[];
}

/**
 * Latest memory_entries rows across all rehabbers (for the /admin global
 * timeline panel). Newest first; excludes the `backend_fallback` sentinel.
 */
export async function getLatestMemoryEntries(
  limit = 20,
): Promise<MemoryEntry[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("memory_entries")
    .select("*")
    .neq("key", "backend_fallback")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`getLatestMemoryEntries: ${error.message}`);
  }
  return (data ?? []) as MemoryEntry[];
}
