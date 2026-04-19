import "server-only";

import { getServiceSupabase } from "@/lib/db/supabase";

import { BackboardBackend } from "./backboard";
import { MemoryBackendError, type MemoryBackend } from "./interface";
import { LocalMemoryBackend } from "./local";
import {
  BACKEND_FALLBACK_KEY,
  type MemoryEntryInput,
  type SignalsByRehabber,
} from "./types";

export { MemoryBackendError } from "./interface";
export type { MemoryBackend } from "./interface";
export type {
  MemoryKey,
  MemoryValue,
  Signals,
  SignalsByRehabber,
  CapacityVal,
  AcceptRateVal,
  SpeciesScopeVal,
  ResponseMsVal,
  GeoAccuracyVal,
} from "./types";

export const MemoryBackendKind = {
  Backboard: "backboard",
  Local: "local",
} as const;

/**
 * Proxy that tries Backboard first and falls back to the local JSONB backend
 * on any thrown error. Every fallback is logged as a memory_entries row with
 * key='backend_fallback' (filtered out on read — see types.MEMORY_KEYS).
 */
class FallbackMemory implements MemoryBackend {
  readonly kind = "backboard" as const;
  constructor(
    private readonly primary: BackboardBackend,
    private readonly secondary: LocalMemoryBackend,
  ) {}

  async query(ids: string[]): Promise<SignalsByRehabber> {
    try {
      return await this.primary.query(ids);
    } catch (err) {
      const reason = reasonOf(err);
      console.error(`[memory] fallback to local: ${reason}`);
      await logFallback("query", reason, ids[0]);
      return this.secondary.query(ids);
    }
  }

  async upsert(id: string, entries: MemoryEntryInput[]): Promise<void> {
    try {
      await this.primary.upsert(id, entries);
      return;
    } catch (err) {
      const reason = reasonOf(err);
      console.error(`[memory] fallback to local: ${reason}`);
      await logFallback("upsert", reason, id);
      await this.secondary.upsert(id, entries);
    }
  }
}

function reasonOf(err: unknown): string {
  if (err instanceof MemoryBackendError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

async function logFallback(
  op: "query" | "upsert",
  reason: string,
  rehabberId: string | undefined,
): Promise<void> {
  if (!rehabberId) return; // memory_entries.rehabber_id is NOT NULL.
  try {
    const db = getServiceSupabase();
    await db.from("memory_entries").insert({
      rehabber_id: rehabberId,
      key: BACKEND_FALLBACK_KEY,
      value: { op, reason, at: new Date().toISOString() },
      source: "local_fallback",
    });
  } catch (err) {
    console.error(
      `[memory] failed to log fallback event: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

let cached: MemoryBackend | null = null;

/**
 * Resolve the active memory backend for the current process.
 *
 * - If BACKBOARD_API_KEY is set AND MEMORY_BACKEND !== 'local', returns a
 *   Backboard-primary + local-fallback proxy.
 * - Otherwise returns the local JSONB backend.
 *
 * Lazy-initialized so the build never requires BACKBOARD_API_KEY.
 */
export function getMemory(): MemoryBackend {
  if (cached) return cached;
  const apiKey = process.env.BACKBOARD_API_KEY;
  const forceLocal = process.env.MEMORY_BACKEND === "local";
  if (apiKey && !forceLocal) {
    const primary = new BackboardBackend({
      apiKey,
      baseUrl: process.env.BACKBOARD_BASE_URL,
      assistantId: process.env.BACKBOARD_ASSISTANT_ID,
    });
    cached = new FallbackMemory(primary, new LocalMemoryBackend());
  } else {
    cached = new LocalMemoryBackend();
  }
  return cached;
}

// Exposed for tests.
export function __resetMemoryCache(): void {
  cached = null;
}
