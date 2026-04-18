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

export const BACKBOARD_NAMESPACE = "terra-triage/rehabbers";
const DEFAULT_TIMEOUT_MS = 5_000;

// Endpoint paths are conservative guesses based on the techdesign §9 shape.
// TODO: verify with Backboard docs before demo — see techdesign §17 Q2.
// The local-fallback path carries the demo if these ever 404.
const QUERY_PATH = "/memory/query";
const UPSERT_PATH = "/memory/upsert";

export interface BackboardBackendOptions {
  apiKey: string;
  baseUrl?: string;
  namespace?: string;
  timeoutMs?: number;
}

interface QueryResponseEntry {
  id: string;
  key: string;
  value: unknown;
}

interface QueryResponse {
  entries?: QueryResponseEntry[];
}

export class BackboardBackend implements MemoryBackend {
  readonly kind = "backboard" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly namespace: string;
  private readonly timeoutMs: number;

  constructor(opts: BackboardBackendOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://api.backboard.io").replace(
      /\/+$/,
      "",
    );
    this.namespace = opts.namespace ?? BACKBOARD_NAMESPACE;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async query(ids: string[]): Promise<SignalsByRehabber> {
    if (ids.length === 0) return {};
    const body = {
      namespace: this.namespace,
      ids,
      keys: MEMORY_KEYS,
    };
    const res = await this.fetchJson<QueryResponse>(QUERY_PATH, body);
    const out: SignalsByRehabber = {};
    for (const id of ids) out[id] = {};
    for (const e of res.entries ?? []) {
      if (!MEMORY_KEYS.includes(e.key as MemoryKey)) continue;
      const bucket = (out[e.id] ??= {} as Signals);
      (bucket as Record<string, unknown>)[e.key] = e.value;
    }
    return out;
  }

  async upsert(id: string, entries: MemoryEntryInput[]): Promise<void> {
    if (entries.length === 0) return;
    await this.fetchJson(UPSERT_PATH, {
      namespace: this.namespace,
      id,
      entries,
    });
    // Mirror every Backboard write to memory_entries for observability + a
    // warm local cache that can feed the fallback backend if Backboard dies.
    await mirrorToLocal(id, entries, "backboard");
  }

  private async fetchJson<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("backboard timeout")),
      this.timeoutMs,
    );
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new MemoryBackendError(
          "backboard",
          `backboard ${path} ${res.status}: ${text.slice(0, 200)}`,
        );
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof MemoryBackendError) throw err;
      throw new MemoryBackendError(
        "backboard",
        err instanceof Error ? err.message : "backboard fetch failed",
        err,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

async function mirrorToLocal(
  rehabberId: string,
  entries: MemoryEntryInput[],
  source: "backboard" | "local_fallback",
): Promise<void> {
  const rows = entries.map((e) => ({
    rehabber_id: rehabberId,
    key: e.key,
    value: e.value as unknown,
    source,
  }));
  const db = getServiceSupabase();
  const { error } = await db.from("memory_entries").insert(rows);
  if (error) {
    // Non-fatal: observability only. Surface in logs but don't break caller.
    console.error(`[memory] mirror to memory_entries failed: ${error.message}`);
  }
}

export { mirrorToLocal };
