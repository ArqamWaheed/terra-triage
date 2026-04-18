import "server-only";

import { getServiceSupabase } from "@/lib/db/supabase";

import { MemoryBackendError, type MemoryBackend } from "./interface";
import {
  MEMORY_KEYS,
  type MemoryEntryInput,
  type MemoryKey,
  type Signals,
  type SignalsByRehabber,
} from "./types";

interface Row {
  rehabber_id: string;
  key: string;
  value: unknown;
  created_at: string;
}

/**
 * Append-only JSONB fallback backed by the `memory_entries` table.
 * `query` returns the latest value per (rehabber_id, key). No external IO.
 */
export class LocalMemoryBackend implements MemoryBackend {
  readonly kind = "local" as const;

  async query(ids: string[]): Promise<SignalsByRehabber> {
    const out: SignalsByRehabber = {};
    if (ids.length === 0) return out;
    for (const id of ids) out[id] = {};

    const db = getServiceSupabase();
    const { data, error } = await db
      .from("memory_entries")
      .select("rehabber_id,key,value,created_at")
      .in("rehabber_id", ids)
      .in("key", MEMORY_KEYS as unknown as string[])
      .order("created_at", { ascending: false });

    if (error) {
      throw new MemoryBackendError(
        "local",
        `memory_entries select failed: ${error.message}`,
        error,
      );
    }

    const seen = new Set<string>();
    for (const row of (data ?? []) as Row[]) {
      if (!MEMORY_KEYS.includes(row.key as MemoryKey)) continue;
      const marker = `${row.rehabber_id}|${row.key}`;
      if (seen.has(marker)) continue;
      seen.add(marker);
      const bucket = (out[row.rehabber_id] ??= {} as Signals);
      (bucket as Record<string, unknown>)[row.key] = row.value;
    }
    return out;
  }

  async upsert(id: string, entries: MemoryEntryInput[]): Promise<void> {
    if (entries.length === 0) return;
    const rows = entries.map((e) => ({
      rehabber_id: id,
      key: e.key,
      value: e.value as unknown,
      source: "local_fallback",
    }));
    const db = getServiceSupabase();
    const { error } = await db.from("memory_entries").insert(rows);
    if (error) {
      throw new MemoryBackendError(
        "local",
        `memory_entries insert failed: ${error.message}`,
        error,
      );
    }
  }
}
