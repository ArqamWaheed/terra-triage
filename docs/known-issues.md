# Known Issues

Risk items surfaced by grep for `TODO`/`FIXME` in `src/` as of the Phase 9 polish pass. Tracked here so no silent assumptions reach the demo.

## Backboard endpoint shape unverified

- **File:** `src/lib/memory/backboard.ts:18`
- **Comment:** `TODO: verify with Backboard docs before demo — see techdesign §17 Q2.`
- **Risk:** Namespace layout and POST `/memory/query` + `/memory/upsert` shapes are assumed from the techdesign spec. If Backboard's production API differs, the primary memory backend will throw and the `FallbackMemory` proxy will transparently delegate to the local Postgres JSONB store (`src/lib/memory/local.ts`). Ranking behaviour remains correct — but the demo loses the "Backboard prize moment" narration.
- **Mitigation:** On first successful Backboard call, confirm the logged namespace + response shape match [techdesign §17 Q2](../techdesign-terratriage.md#17-open-technical-questions). If not, patch `backboard.ts` against the live docs and re-run `pnpm build`.
- **Owner:** operator, pre-demo.

## Auth0 AI Agents preview availability

Not a code `TODO` but called out in `PRD.md` R-2 / techdesign §17 Q1. If the chosen tenant does not have AI Agents preview enabled, the Dispatcher falls back to `m2m-fallback` mode automatically — still scoped, still narratable, but the on-screen auth-mode badge will read `m2m-fallback` instead of `user-consented`.

## Resend domain verification

Operator decision (techdesign §17 Q4). Staying on `onboarding@resend.dev` is acceptable for demo but rate-limits at 100/day and may land in spam on strict inboxes. Gmail SMTP fallback is wired for 429/5xx; no code change required either way.
