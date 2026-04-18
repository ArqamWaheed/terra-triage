# memory.md

> **READ THIS FIRST. UPDATE THIS LAST.** If anything below is stale, fix it before ending your turn.

## Project
Terra Triage — multi-agent wildlife triage web app for DEV Earth Day hackathon. Deadline: **2026-04-20 06:59 UTC**. Prize targets: Backboard (primary), Auth0 (secondary).

## Current Goal
All planning docs shipped. Next: scaffold Next.js app and start MVP build against the 42h sequence in techdesign.

## Active Task
idle

## Recent Decisions
- 2026-04-18 — Picked Terra Triage from top-5 shortlist; primary=Backboard, secondary=Auth0 for AI Agents.
- 2026-04-18 — Stack locked: Next.js (App Router, TS) on Vercel free; Supabase Postgres; Gemini free API; MapLibre + OSM; Resend/Gmail SMTP; $0 budget.
- 2026-04-18 — Agents are server-only TS modules orchestrated by Next.js Server Actions (no LangChain, no queue).
- 2026-04-18 — Backboard is sole ranker w/ JSONB `memory_entries` fallback behind same interface (demo stays intact even if preview API fails).
- 2026-04-18 — Auth0 for AI Agents primitives (agent identity + PAR + scoped `referral:send` + Token Vault + single-use token) are load-bearing in Dispatcher.
- 2026-04-18 — research.md, PRD.md, techdesign-terratriage.md, agents.md, memory.md, .github/copilot-instructions.md all authored; TOP_5_WINNING_IDEAS.md deleted.
- 2026-04-18 — LLM locked: **Gemini 2.5 Flash** (multimodal, generous free tier, structured JSON, bonus prize-category optionality). Grok rejected (weaker vision, not a prize category).
- 2026-04-18 — Pinned to `gemini-2.0-flash` (1,500 RPD free vs 250 on 2.5 Flash); adding pre-upload image resize ≤768px + SHA-keyed response cache in Supabase + demo-mode fallback.

## Open Questions
- Final Auth0 tenant name + whether we use social providers or passwordless only.
- Seed rehabber dataset source (15 US entries) — curate manually or scrape public directory?
- Demo video host: YouTube unlisted vs. Loom free?

## Next Actions
1. `npx create-next-app@latest` at repo root (TS, App Router, Tailwind, ESLint).
2. Supabase project + apply schema from techdesign §4 (cases, rehabbers, referrals, memory_entries, users).
3. Auth0 tenant + configure agent identity + `referral:send` scope.
4. Implement intake flow: photo upload → Gemini triage → triage card (Hour 0–12 of build sequence).
5. Hour-8 scope-freeze checkpoint: stop adding features, finalize MVP.

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

## Compression Protocol
- **Recent Decisions > 5**: collapse oldest entries into a single `Historical Summary:` line at the top of the section; delete the individual lines.
- **Open Question resolved**: move it to Recent Decisions (dated) and delete from Open Questions.
- **Next Actions done**: delete; do not archive.
- **On `/compress`**: rewrite this file end-to-end, prune every section to ≤ 10 lines, append a timestamp to Context Compression Log.
