import "server-only";

import { getMemory } from "@/lib/memory";
import type { SignalsByRehabber } from "@/lib/memory/types";
import type { RehabberPublic } from "@/lib/db/types";

import {
  rankRehabbers,
  type RankInput,
  type Ranked,
  type RehabberSignals,
  type SignalsById,
} from "./rank";

/**
 * Thin wrapper around rankRehabbers that pulls per-rehabber Backboard/local
 * memory signals before scoring. Does not alter rank.ts weights or signature.
 *
 * On a memory backend failure (Backboard down AND local unavailable) it
 * degrades to an empty-signals rank — the demo still ships a ranking.
 */
export async function rankRehabbersWithMemory(
  input: RankInput,
  rehabbers: RehabberPublic[],
): Promise<Ranked[]> {
  const ids = rehabbers.map((r) => r.id);
  let signals: SignalsByRehabber = {};
  try {
    signals = await getMemory().query(ids);
  } catch (err) {
    console.error(
      `[rank-with-memory] signals query failed; ranking without them: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  return rankRehabbers(input, rehabbers, toSignalsById(signals));
}

function toSignalsById(s: SignalsByRehabber): SignalsById {
  const out: SignalsById = {};
  for (const [id, sig] of Object.entries(s)) {
    out[id] = sig as unknown as RehabberSignals;
  }
  return out;
}
