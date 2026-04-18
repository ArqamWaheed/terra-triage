# Memory layer

Terra Triage's "Memory agent" is a thin TypeScript module. One interface, two
backends, same shape on read and write — so the Backboard prize demo and the
local fallback are indistinguishable to callers.

## Interface

```ts
import { getMemory } from "@/lib/memory";

const mem = getMemory();
const signals = await mem.query([rehabberId1, rehabberId2]);
await mem.upsert(rehabberId1, [
  { key: "capacity", value: { remaining: 3, updated_at: new Date().toISOString() } },
]);
```

See `types.ts` for the full `Signals` / `MemoryKey` definitions (mirrors
`techdesign §9`).

## Backends

| Backend | File | When selected |
|---|---|---|
| Backboard (+ local fallback) | `backboard.ts` + `index.ts` | `BACKBOARD_API_KEY` set AND `MEMORY_BACKEND !== 'local'` |
| Local JSONB only | `local.ts` | otherwise |

Environment:

- `BACKBOARD_API_KEY` — enables the Backboard-primary proxy.
- `BACKBOARD_BASE_URL` — optional override (default `https://api.backboard.io`).
- `MEMORY_BACKEND=local` — forces the local-only backend.

Build never requires `BACKBOARD_API_KEY`: `getMemory()` is lazy and the local
backend is self-contained (reads/writes the `memory_entries` table via the
service-role Supabase client).

## Fallback logic

`FallbackMemory` (in `index.ts`) wraps Backboard and catches any thrown error:

1. Logs `[memory] fallback to local: <reason>` to stderr.
2. Writes an observability row to `memory_entries` with `key='backend_fallback'`
   (filtered out at read time via `MEMORY_KEYS`).
3. Delegates the call to `LocalMemoryBackend`.

Every successful Backboard upsert is also mirrored to `memory_entries`
(`source='backboard'`) so the local backend stays warm and can carry the demo
if Backboard 404s mid-talk.

## Helpers

`helpers.ts` exposes `applyOutcomeToSignals(prev, outcome, opts)` — a pure
reducer that turns a referral outcome into the list of upsert entries. No IO;
callers feed its result into `mem.upsert()`.

## Ranking integration

Phase 5's `rankRehabbers` is unchanged. Use the async wrapper instead:

```ts
import { rankRehabbersWithMemory } from "@/lib/agents/rank-with-memory";
const ranked = await rankRehabbersWithMemory({ species, lat, lng }, rehabbers);
```

## Demo instructions

The Backboard prize moment (`techdesign §16`) is a before/after rerank:

1. Submit Case A (Red-tailed Hawk). Top rehabber = X.
2. Simulate an outcome: decline from X, accept from Y (via the outcome page in
   Phase 8, or call `applyOutcomeToSignals` + `getMemory().upsert()` directly).
3. Submit Case B (identical species). Top rehabber = Y.

To force the fallback path during the demo (e.g. to show graceful degradation),
set `MEMORY_BACKEND=local` in the environment; the UI is identical, and a
`backend_fallback` row appears in `memory_entries` each time Backboard would
have been hit.

## Open items

- Backboard endpoint paths (`/memory/query`, `/memory/upsert`) are conservative
  guesses. Verify against Backboard docs before demo — see `techdesign §17 Q2`.
  If they change, only `backboard.ts` needs editing.
