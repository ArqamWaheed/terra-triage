# memory.md

> **READ THIS FIRST. UPDATE THIS LAST.** If anything below is stale, fix it before ending your turn.

## Project
Terra Triage — multi-agent wildlife triage web app for DEV Earth Day hackathon. Deadline: **2026-04-20 06:59 UTC**. Prize targets: Backboard (primary), Auth0 (secondary).

## Current Goal
MVP feature-complete; awaiting Supabase/Auth0/Backboard tenant provisioning + demo recording.

## Active Task
Post-MVP features F1/F2/F3 shipped (commits 068a4f1, 26d794d, c42849c). Remaining: deploy + record demo + DEV post.

## Recent Decisions
- 2026-04-18 — Historical Summary: Phases 1–9 shipped (scaffold → landing → intake → Finder/Gemini → Leaflet ranking → Auth0 PAR + Resend dispatcher → Backboard+local memory → rehabber outcome magic-link → /admin ops → PWA/README/demo-script polish). See git log for per-phase detail.
- 2026-04-19 — Tenants live: Supabase (migrations + seed + photos bucket), Auth0 (RWA + API `https://terra-triage.app/agent` + `referral:send` + M2M), Resend (`onboarding@resend.dev`). AUTH0_PAR gated behind env flag (tenant toggle missing); `/api/auth/login` verified 307. Intake at `/report`.
- 2026-04-19 — Backboard backend rewritten against real API (`app.backboard.io/api`, `X-API-Key`, assistant-scoped memory add/search). Signals encoded as `TERRA_SIGNAL rehabber=<id> key=<k> value=<json>`; assistant id pinned via `BACKBOARD_ASSISTANT_ID`. Commit 38b4b4e. Cost fix (list instead of search) in 96a8adb.
- 2026-04-19 — Gemini → Groq migration (commit f8928ed): `meta-llama/llama-4-scout-17b-16e-instruct` via OpenAI-compat `chat/completions` with `response_format:{type:"json_object"}`. `PROMPT_VERSION` bumped v1→v2 (invalidates triage_cache). `@google/generative-ai` removed.
- 2026-04-19 — Copy-hygiene sweep (commit bce9f4c): 24 user-facing em-dashes scrubbed across 11 files; no phase/debug leakage found.
- 2026-04-19 — Security audit pass (commit 5c568ec): timing-safe admin basic-auth compare, hardened security headers (HSTS/XFO/XCTO/Referrer/Permissions-Policy), stripped upstream response bodies from Groq+Backboard error messages. Accepted risks documented in commit.
- 2026-04-19 — Feature ideation: `docs/post-mvp-plan.md` written with 3 optional adds (demo-seed button, auth-mode badge, memory audit log — 52 min total) tied to Backboard/Auth0 narratives. Not yet implemented.
- 2026-04-20 — Post-MVP features shipped (F1 demo-seed endpoint+button idempotent fixed UUID + real runFinder / synthesizeUnknown fallback; F2 AuthModeBadge on dispatch success — dispatcher now returns `authMode` alongside `mode`; F3 memory signals timeline panel on /admin/cases with local_fallback warn chip). Lint + build green on each.

## Open Questions
- Resend domain verification vs. `onboarding@resend.dev` (demo workaround: seed rehabbers with your verified address).
- Demo video host (YouTube unlisted vs. Loom free).
- Whether to implement post-mvp-plan features (52 min) before recording.

## Next Actions
1. Full end-to-end smoke: photo → Finder(Groq) → rank (Backboard memory hit) → referral email → magic-link outcome → `/admin`.
2. Record 60–90s demo; capture `docs/hero.png` + `docs/architecture.png`.
3. Deploy to Vercel (free) from `main`.
4. Publish `docs/dev-post-draft.md` on DEV by T-2h (2026-04-20 04:59 UTC).

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
