# memory.md

> **READ THIS FIRST. UPDATE THIS LAST.** If anything below is stale, fix it before ending your turn.

## Project
Terra Triage — multi-agent wildlife triage web app for DEV Earth Day hackathon. Deadline: **2026-04-20 06:59 UTC**. Prize targets: Backboard (primary), Auth0 (secondary).

## Current Goal
MVP feature-complete; awaiting Supabase/Auth0/Backboard tenant provisioning + demo recording.

## Active Task
Backboard rewrite shipped; remaining: swap Gemini key (quota 0 on current) + full end-to-end demo run.

## Recent Decisions
- 2026-04-18 — Historical Summary: Phases 1–9 shipped (scaffold → landing → intake → Finder/Gemini → Leaflet ranking → Auth0 PAR + Resend dispatcher → Backboard+local memory → rehabber outcome magic-link → /admin ops → PWA/README/demo-script polish). See git log for per-phase detail.
- 2026-04-19 — Tenants live: Supabase (migrations + seed + photos bucket), Auth0 (RWA + API `https://terra-triage.app/agent` + `referral:send` + M2M), Resend (`onboarding@resend.dev`). AUTH0_PAR gated behind env flag (tenant toggle missing); `/api/auth/login` verified 307. Intake at `/report`.
- 2026-04-19 — Backboard backend rewritten against real API (`app.backboard.io/api`, `X-API-Key`, assistant-scoped memory add/search). Previous `/memory/query|/memory/upsert` endpoints were fictional (DNS didn't resolve). Signals encoded as `TERRA_SIGNAL rehabber=<id> key=<k> value=<json>`; assistant id `0de2d510-...` pinned via `BACKBOARD_ASSISTANT_ID` env (lazy list-or-create fallback). Live add+search verified. Commit 38b4b4e.

## Open Questions
- Gemini key quota=0 on current project — user to swap key before demo.
- Resend domain verification vs. `onboarding@resend.dev` (100/day sandbox → only user's own verified email receives).
- Demo video host (YouTube unlisted vs. Loom free).

## Next Actions
1. Swap `GEMINI_API_KEY` to a project with available quota; re-test `/report` ID.
2. Full end-to-end smoke: photo → Finder → rank (Backboard memory hit) → referral email → magic-link outcome → `/admin`. Confirm `[memory] fallback to local` no longer logs.
3. Seed ≥2 demo-region rehabbers within 25km of demo photo coords so ranking shift is visible.
4. Record 60–90s demo; capture `docs/hero.png` + `docs/architecture.png`.
5. Publish `docs/dev-post-draft.md` on DEV by T-2h (2026-04-20 04:59 UTC).

## File Index
| File | Purpose |
|---|---|
| `memory.md` | Living context; read first, update last. |
| `agents.md` | Agent operating protocol, roles, turn loop. |
| `.github/copilot-instructions.md` | Repo-wide AI agent rules (auto-loaded). |
| `research.md` | Hackathon + domain research notes. |
| `PRD.md` | Product requirements. |
| `techdesign-terratriage.md` | Architecture + agent topology + 42h build sequence. |

## Context Compression Log
- 2026-04-18 — Initial seed + first sync after planning-phase docs landed.
- 2026-04-18 — Phase 9 polish: collapsed Phases 2–8 into Historical Summary (detail remains in git log); refreshed Current Goal / Active Task / Next Actions to submission-polish mode.

## Compression Protocol
- **Recent Decisions > 5**: collapse oldest entries into a single `Historical Summary:` line at the top of the section; delete the individual lines.
- **Open Question resolved**: move it to Recent Decisions (dated) and delete from Open Questions.
- **Next Actions done**: delete; do not archive.
- **On `/compress`**: rewrite this file end-to-end, prune every section to ≤ 10 lines, append a timestamp to Context Compression Log.
