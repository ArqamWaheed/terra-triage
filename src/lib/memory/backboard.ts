import "server-only";

import { getServiceSupabase } from "@/lib/db/supabase";

import { MemoryBackendError, type MemoryBackend } from "./interface";
import {
  MEMORY_KEYS,
  type MemoryEntryInput,
  type MemoryKey,
  type MemoryValue,
  type Signals,
  type SignalsByRehabber,
} from "./types";

// Backboard real API (https://docs.backboard.io/concepts/memory):
//  - POST  /api/assistants                                  -> create assistant
//  - GET   /api/assistants                                  -> list assistants
//  - POST  /api/assistants/{aid}/memories                   -> add memory
//  - POST  /api/assistants/{aid}/memories/search            -> semantic search
// Signals are stored one memory-per-(rehabber_id, key) with a parseable
// content prefix so retrieval can reconstruct the original typed value even if
// Backboard paraphrases into natural language. The prefix is also included in
// the semantic query to bias the vector search.

const DEFAULT_BASE_URL = "https://app.backboard.io";
const DEFAULT_TIMEOUT_MS = 8_000;
const ASSISTANT_NAME = "Terra Triage Rehabber Memory";
const ASSISTANT_PROMPT =
  "You are an operational memory agent for a wildlife-triage referral " +
  "system. You store structured signals about licensed rehabbers " +
  "(capacity, acceptance rate, taxa scope, response latency, geo accuracy) " +
  "and return them verbatim when queried. Never invent values.";
const CONTENT_PREFIX = "TERRA_SIGNAL";
const SEARCH_LIMIT = 30;

export interface BackboardBackendOptions {
  apiKey: string;
  baseUrl?: string;
  assistantId?: string;
  timeoutMs?: number;
}

interface CreateAssistantResponse {
  assistant_id: string;
  name: string;
}

type AssistantSummary = { assistant_id: string; name: string };

interface AddMemoryResponse {
  success: boolean;
  memory_id: string;
  content: string;
}

interface SearchMemoriesResponse {
  memories: Array<{
    id: string;
    content: string;
    score?: number;
    created_at?: string;
    metadata?: Record<string, unknown> | null;
  }>;
  total_count?: number;
}

function isMemoryKey(k: string): k is MemoryKey {
  return (MEMORY_KEYS as readonly string[]).includes(k);
}

function encodeContent(
  rehabberId: string,
  key: MemoryKey,
  value: MemoryValue,
): string {
  // Flat, parseable, semantic-friendly. The JSON tail is what we parse back;
  // the prose prefix helps the embedding model co-locate rehabber+key hits.
  return (
    `${CONTENT_PREFIX} rehabber=${rehabberId} key=${key} ` +
    `value=${JSON.stringify(value)}`
  );
}

const CONTENT_RE = new RegExp(
  `${CONTENT_PREFIX}\\s+rehabber=([^\\s]+)\\s+key=([a-z_]+)\\s+value=(.+)$`,
);

function decodeContent(
  content: string,
): { rehabberId: string; key: MemoryKey; value: MemoryValue } | null {
  const m = content.match(CONTENT_RE);
  if (!m) return null;
  const [, rehabberId, key, jsonTail] = m;
  if (!isMemoryKey(key)) return null;
  try {
    const value = JSON.parse(jsonTail) as MemoryValue;
    return { rehabberId, key, value };
  } catch {
    return null;
  }
}

export class BackboardBackend implements MemoryBackend {
  readonly kind = "backboard" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private assistantIdPromise: Promise<string> | null = null;

  constructor(opts: BackboardBackendOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (opts.assistantId) {
      this.assistantIdPromise = Promise.resolve(opts.assistantId);
    }
  }

  async query(ids: string[]): Promise<SignalsByRehabber> {
    if (ids.length === 0) return {};
    const assistantId = await this.resolveAssistant();
    const out: SignalsByRehabber = Object.fromEntries(
      ids.map((id) => [id, {} as Signals]),
    );

    // Parallel semantic searches, one per rehabber. Small N (≤15) keeps this
    // well within rate budgets and under ~2s wall-clock.
    await Promise.all(
      ids.map(async (id) => {
        const res = await this.fetchJson<SearchMemoriesResponse>(
          `/api/assistants/${assistantId}/memories/search`,
          { query: `${CONTENT_PREFIX} rehabber=${id}`, limit: SEARCH_LIMIT },
        );
        // Newest-first so the first match per key wins.
        const memories = [...(res.memories ?? [])].sort((a, b) =>
          (b.created_at ?? "").localeCompare(a.created_at ?? ""),
        );
        const bucket = out[id];
        const seen = new Set<MemoryKey>();
        for (const m of memories) {
          const decoded = decodeContent(m.content);
          if (!decoded) continue;
          if (decoded.rehabberId !== id) continue;
          if (seen.has(decoded.key)) continue;
          seen.add(decoded.key);
          (bucket as Record<string, unknown>)[decoded.key] = decoded.value;
        }
      }),
    );

    return out;
  }

  async upsert(id: string, entries: MemoryEntryInput[]): Promise<void> {
    if (entries.length === 0) return;
    const assistantId = await this.resolveAssistant();

    await Promise.all(
      entries.map((e) =>
        this.fetchJson<AddMemoryResponse>(
          `/api/assistants/${assistantId}/memories`,
          {
            content: encodeContent(id, e.key, e.value),
            metadata: { rehabber_id: id, key: e.key, source: "terra-triage" },
          },
        ),
      ),
    );

    await mirrorToLocal(id, entries, "backboard");
  }

  // ── internals ──

  private async resolveAssistant(): Promise<string> {
    if (!this.assistantIdPromise) {
      this.assistantIdPromise = this.bootstrapAssistant().catch((err) => {
        // Reset cache on failure so a later call can retry (e.g. transient
        // timeout on cold start).
        this.assistantIdPromise = null;
        throw err;
      });
    }
    return this.assistantIdPromise;
  }

  private async bootstrapAssistant(): Promise<string> {
    // 1. Try list-and-match by name so re-deploys reuse the same assistant.
    try {
      const list = await this.fetchJson<AssistantSummary[]>(
        "/api/assistants",
        undefined,
        "GET",
      );
      if (Array.isArray(list)) {
        const hit = list.find((a) => a.name === ASSISTANT_NAME);
        if (hit?.assistant_id) return hit.assistant_id;
      }
    } catch {
      // Swallow — fall through to create.
    }

    // 2. Create on first run.
    const created = await this.fetchJson<CreateAssistantResponse>(
      "/api/assistants",
      { name: ASSISTANT_NAME, system_prompt: ASSISTANT_PROMPT },
    );
    if (!created.assistant_id) {
      throw new MemoryBackendError(
        "backboard",
        "backboard create assistant returned no assistant_id",
      );
    }
    console.info(
      `[memory] backboard assistant resolved: ${created.assistant_id}`,
    );
    return created.assistant_id;
  }

  private async fetchJson<T>(
    path: string,
    body: unknown,
    method: "GET" | "POST" = "POST",
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("backboard timeout")),
      this.timeoutMs,
    );
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "X-API-Key": this.apiKey,
          ...(method === "POST"
            ? { "content-type": "application/json" }
            : {}),
        },
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new MemoryBackendError(
          "backboard",
          `backboard ${method} ${path} ${res.status}: ${text.slice(0, 200)}`,
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
    console.error(`[memory] mirror to memory_entries failed: ${error.message}`);
  }
}

export { mirrorToLocal };
