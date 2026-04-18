# `rank.ts` — Rehabber Ranking Agent

Pure TypeScript scorer used by the Dispatcher flow (techdesign §5.2, §9) to
order active rehabbers for a given case.

## Signature

```ts
rankRehabbers(
  { species, lat, lng },
  rehabbers: RehabberPublic[],
  signals?: Record<rehabberId, RehabberSignals>,
): Ranked[]
```

Returns `{ rehabber, score, km, signals, explain }[]` sorted by `score` desc.

## Scoring

`score = Σ weight[k] * component[k]`

| Component       | Weight | Signal source                       |
| --------------- | ------ | ----------------------------------- |
| `speciesMatch`  | 0.35   | case.species → SPECIES_MAP → scope  |
| `distanceScore` | 0.25   | haversine(finder, rehabber) / 100km |
| `capacityScore` | 0.20   | rehabber.capacity + signals.capacity.remaining |
| `acceptRate`    | 0.15   | signals.accept_rate.rate (prior 0.5)|
| `responseSpeed` | 0.05   | signals.response_ms.avg_ms          |

### Component details

- **speciesMatch**: `1` if the mapped scope is in `rehabber.species_scope`,
  `0.3` otherwise, `0.6` when species is unknown (uncertainty prior).
- **distanceScore**: `max(0, 1 - km/100)`. Over 100 km → 0.
- **capacityScore**: `capacity/10` clamped, blended 60/40 with
  `signals.capacity.remaining/10` when live signal is present.
- **acceptRate**: `signals.accept_rate.rate ?? 0.5`.
- **responseSpeed**: `1 - min(1, avg_ms / 86_400_000)` — 24h ceiling,
  1h default.

## Signal keys (Backboard namespace `terra-triage/rehabbers`)

Matches techdesign §9. All keys optional on the first run.

```ts
interface RehabberSignals {
  capacity?:     { remaining: number; updated_at?: string };
  accept_rate?:  { n: number; accepted: number; rate: number };
  species_scope?: Record<string, number>; // per-species weight, future use
  response_ms?:  { n: number; avg_ms: number };
}
```

## Phase 7 Backboard plug-in

Phase 5 ships with `signals` defaulting to `{}`. Phase 7 will add a
`src/lib/agents/memory.ts` with:

```ts
export async function loadSignals(ids: string[]): Promise<SignalsById>;
```

…backed by Backboard memory (fallback: `memory_entries` JSONB). The
Dispatcher server action passes its result straight into `rankRehabbers`;
no scorer changes required.

## Species scope map

Minimal common-name → scope mapping for the seed dataset:
`hawk/eagle/owl → raptor`, `robin/sparrow → songbird`,
`duck/goose → waterfowl`, `squirrel/rabbit → mammal_small`,
`fox/raccoon → mammal_medium`, `turtle/snake → reptile`, `bat → bat`.
Unknown species → `0.6` prior; mapped-but-unmatched → `0.3`.
