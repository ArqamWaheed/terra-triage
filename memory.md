# memory.md

> **READ THIS FIRST. UPDATE THIS LAST.** If anything below is stale, fix it before ending your turn.

## Project
Terra Triage — multi-agent wildlife triage web app for DEV Earth Day hackathon. Deadline: **2026-04-20 06:59 UTC**. Prize targets: Backboard (primary), Auth0 (secondary).

## Current Goal
MVP feature-complete; awaiting Supabase/Auth0/Backboard tenant provisioning + demo recording.

## Active Task
idle — MVP done; submission polish only.

## Recent Decisions
- 2026-04-18 — Historical Summary: Phases 1–8 shipped (scaffold → landing → intake → Finder/Gemini → Leaflet ranking → Auth0 PAR + Resend dispatcher → Backboard+local memory → rehabber outcome magic-link → /admin ops). See git log for per-phase detail.
- 2026-04-18 — Phase 9 polish shipped: PWA manifest (`public/manifest.webmanifest`, `#0a0a0a` theme/bg, standalone) + sharp-rasterised 192/512 maskable icons from hand-authored mono SVG (`public/icons/icon.svg`); `layout.tsx` metadata wired (manifest, applicationName, appleWebApp, icon list) — `themeColor` already on `Viewport` from earlier phase. Root `README.md` replaced Next.js default: pitch, hero placeholder, what-it-does, ASCII architecture, agents table, tech stack, explicit Backboard + Auth0 prize-category sections (w/ file refs to rank-with-memory, agent-token, memory/index, dispatcher), `$0` link to PRD §11, local setup + env ref, deploy, demo flow, MVP §6.1 checkmarks, MIT, Copilot co-author. `docs/architecture.md` = Mermaid graph (3 agents + Supabase + externals) + ASCII + case state machine + memory-loop narrative. `LICENSE` = MIT 2026 Arqam Waheed. `docs/dev-post-draft.md` = DEV frontmatter (`devchallenge`/`earthdaychallenge`/`ai`/`nextjs` — `backboard`/`auth0` noted for UI picker since DEV caps 4 tags), personal-why 2 sentences, hero + video embed placeholders, architecture, 3 code embeds w/ real file paths (rank-with-memory, agent-token, finder), explicit Backboard + Auth0 justification sections, what's-next. `docs/demo-script.md` = 75s/90s ceiling w/ stopwatch-timed beats mapped to PRD §10 + techdesign §16 prize moments + operator pre-flight (no fabricated data clause). `docs/submission-checklist.md` = PRD §13 as checklist, technical items ticked, video/post/live-URL/tenant items left unchecked. `docs/known-issues.md` captures the single risk-TODO found (`src/lib/memory/backboard.ts:18` Backboard endpoint shape — fallback proxy handles correctness loss, narration loss documented). lint/tsc/build all green.

## Open Questions
- Auth0 tenant + AI-Agents preview status (determines `user-consented` vs `m2m-fallback` demo-default).
- Resend domain verification vs. `onboarding@resend.dev` (100/day).
- Seed rehabber dataset source for 15 US entries (curate manually from DNR lists).
- Demo video host (YouTube unlisted vs. Loom free).

## Next Actions
1. Provision tenants: Supabase (migrations + photos bucket), Auth0 (AI Agents preview + `referral:send` scope + PAR), Backboard (namespace verify), Resend (domain or `onboarding@resend.dev`).
2. Seed real rehabbers for demo region (≥2 within 25km of demo photo coords so ranking shift is visible).
3. Record 60–90s demo video per `docs/demo-script.md`; capture `docs/hero.png` + `docs/architecture.png`.
4. Publish `docs/dev-post-draft.md` on DEV by T-2h (2026-04-20 04:59 UTC).

## Open Questions
- Auth0 tenant + AI-Agents preview status on the chosen tenant (determines whether user-consented or M2M-fallback is the demo-default path).
- Resend domain verification (or stay on `onboarding@resend.dev` for demo — rate-limited to 100/day).
- Seed rehabber dataset source (15 US entries) — curate manually or scrape public directory?
- Demo video host: YouTube unlisted vs. Loom free?

## Next Actions
1. Phase 9: seed 15 rehabbers + demo polish.
2. Hour-8 scope-freeze checkpoint.

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
