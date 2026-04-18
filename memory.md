# memory.md

> **READ THIS FIRST. UPDATE THIS LAST.** If anything below is stale, fix it before ending your turn.

## Project
Terra Triage — multi-agent wildlife triage web app for DEV Earth Day hackathon. Deadline: **2026-04-20 06:59 UTC**. Prize targets: Backboard (primary), Auth0 (secondary).

## Current Goal
All planning docs shipped. Next: scaffold Next.js app and start MVP build against the 42h sequence in techdesign.

## Active Task
Phase 3 intake shipped. Next: Phase 4 — Finder agent (Gemini 2.0 Flash) + triage_cache SHA lookup + populate species/severity/safety_advice on `/case/[id]`.

## Recent Decisions
- 2026-04-18 — Phase 3 intake shipped: `/report` (client) with hidden `capture="environment"` file input + `navigator.geolocation.getCurrentPosition` (manual lat/lng fallback on deny/error) + optional finder email + client-side downscale (`src/lib/utils/image.ts`, OffscreenCanvas → `<canvas>` fallback, 1600px longest edge @ 0.85 JPEG). Server action `src/app/report/actions.ts` (`createCase`) — zod-validated (`src/lib/schemas/case.ts`), service-role supabase: insert row (`photo_path=''` placeholder) → upload to `photos` bucket at `cases/{id}/original.{ext}` → update row → `redirect('/case/{id}')`; defensive cleanup (delete row/blob on failure). Placeholder `/case/[id]` server component: UUID guard, signed URL (60s TTL), triage fields show "Pending triage". Installed `zod@4.3.6`. React 19.2 `set-state-in-effect` forced initial-state derivation + useMemo for object URL.
- 2026-04-18 — Phase 2a (DB) shipped: `supabase/migrations/0001_init.sql` (schema + `triage_cache` SHA cache + `rehabbers_public` view + `photos` storage bucket), `0002_rls.sql` (RLS on all tables, anon reads only the view, service-role elsewhere, photos bucket locked to service role), `seed/rehabbers.sql` (15 demo rows, example.org addrs, explicit "do not email" header comment), `src/lib/db/{supabase.ts,types.ts}`, `README-db.md`. Added deps: `@supabase/supabase-js`, `@supabase/ssr`, `server-only`. Skipped `earthdistance` GIST (free tier) — btree on lat/lng + TS haversine per §17 Q8. `cases.updated_at` plpgsql trigger. tsc/lint/build green.
- 2026-04-18 — Phase 2b landing shipped: dispatcher-console landing at `/`, `/report` placeholder, `SeverityBadge` (1–5 with lucide icons + text, not color-only), inline-currentColor logo at `public/terra-triage-logo.svg`, metadata + viewport (themeColor `#0a0a0a`). Mobile-first 375px, semantic HTML, `motion-reduce` respected. Build+lint+tsc green.
- 2026-04-18 — Phase 1 scaffold committed (27f2a87): Next.js 16 App Router + TS + Tailwind v4 + ESLint + src/ via pnpm. shadcn/ui initialised (button/card/badge/input/label/separator). Folder skeleton (`src/lib/{agents,db,auth,email,memory,utils}`, `src/components/triage`, `supabase/{migrations,seed}`) with .gitkeep. `.env.example`, CI workflow, placeholder page. `pnpm build` green.
- 2026-04-18 — Next.js **16.2.4** pulled (create-next-app latest) — newer than the "Next.js 15" label in the commit message; no action needed, App Router compatible.
- 2026-04-18 — Scaffolded into temp dir then moved; deleted generated `AGENTS.md` + `CLAUDE.md` to avoid shadowing our `agents.md`. Kept generated `README.md`.
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
1. Phase 4: Finder agent — `src/lib/agents/finder.ts` calling Gemini 2.0 Flash w/ photo + SHA-keyed `triage_cache` lookup; wire into a "Run triage" server action off `/case/[id]` (or auto-run post-upload). Populate species/severity/safety_advice/status='triaged'.
2. Phase 5: Dispatcher + rehabber ranking (Backboard primary, local_fallback behind same interface).
3. Phase 6: Auth0 tenant + agent identity + `referral:send` scope; swap placeholder "Send referral" button.
4. Hour-8 scope-freeze checkpoint: stop adding features, finalize MVP.

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
