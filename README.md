# Terra Triage

> *Snap a photo of an injured wild animal and a multi-agent system identifies the species, triages the injury, and dispatches the referral to the rehabber most likely to say yes, in under 60 seconds.*

## What it does

Terra Triage collapses the chaotic gap between *"I just found a hurt animal"* and *"a trained rehabber is on the way"* into a single guided 60-second flow. It pairs a Groq-powered vision **Finder agent**, an Auth0-scoped **Dispatcher agent**, and a Backboard-backed **Memory agent** so that every referral outcome improves the next ranking. Most dispatch apps pick the closest rehabber. Terra Triage picks the one who will actually accept, because Backboard remembers who said no last time.

## Architecture

```
                     ┌─────────────────────────────────────┐
                     │  Phone Browser (PWA, 375px-first)   │
                     │  Next.js client · Leaflet · camera  │
                     └──────┬───────────────────────┬──────┘
                            │ HTTPS                 │ tile GET
                            ▼                       ▼
                ┌─────────────────────────┐   ┌───────────────┐
                │  Vercel Edge / Node     │   │ OSM tile CDN  │
                │  Next.js Route Handlers │   └───────────────┘
                │  + Server Actions       │
                └────┬────────┬────────┬──┘
          intake    │        │        │  dispatch / outcome
                    ▼        ▼        ▼
         ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
         │ Finder Agent │ │ Memory Agent │ │ Dispatcher Agent │
         │ (Groq Llama) │ │ (Backboard)  │ │ (Auth0 + Resend) │
         └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘
                │                │                  │
                ▼                ▼                  ▼
         ┌──────────┐     ┌────────────┐     ┌─────────────┐
         │ Groq     │     │ Backboard  │     │ Auth0 for   │
         │ Llama-4  │     │ Memory API │     │ AI Agents   │
         │ Scout    │     │            │     │             │
         └──────────┘     └────────────┘     └──────┬──────┘
                                                    │ scoped token
                                                    ▼
                                             ┌─────────────┐
                                             │ Resend API  │
                                             └─────────────┘

                ┌──────────────────────────────────────────┐
                │  Supabase (Postgres + Storage + RLS)     │
                │  cases · rehabbers · referrals ·         │
                │  memory_entries · photos bucket          │
                └──────────────────────────────────────────┘
```

Data-flow notes live alongside the agent source files.

## Agents

| Agent | Role | Inputs | Outputs | External |
|---|---|---|---|---|
| **Finder** | Photo → triage card | photo URL, geo | `{species, confidence, severity, safety_advice, should_touch}` | Groq Llama-4 Scout (vision, JSON mode) |
| **Dispatcher** | Pick rehabber, get user consent, send intake email | `case_id`, `user_sub` | `referrals` row, provider email id | Auth0 (scoped token), Resend |
| **Memory** | Persist rehabber signals, re-rank on every query | `rehabber_id`, outcome event | upserted memory entries | Backboard (Postgres JSONB fallback) |

Source: [`src/lib/agents/finder.ts`](src/lib/agents/finder.ts) · [`src/lib/agents/dispatcher.ts`](src/lib/agents/dispatcher.ts) · [`src/lib/memory/index.ts`](src/lib/memory/index.ts).

## Tech stack

- **Next.js 16** (App Router, RSC, Server Actions) + TypeScript
- **Supabase**, Postgres + Storage + RLS
- **Groq Llama-4 Scout**, multimodal vision + structured JSON triage (free tier, sub-second latency)
- **Auth0 for AI Agents**, PAR + scoped `referral:send` token (user-consented on-behalf-of flow, M2M fallback)
- **Backboard**, durable rehabber memory (local JSONB fallback behind identical interface)
- **Resend**, transactional email (Gmail SMTP fallback on 429/5xx)
- **Leaflet + OSM**, map tiles, fair-use
- **Tailwind v4** + **shadcn/ui**, dispatcher-console motif
- **sharp**, server-side photo resize before vision call

## Prize category alignment

### Backboard, memory is the protagonist

- Rehabber ranking is **never** a static `ORDER BY distance`. Every call goes through `rankRehabbersWithMemory` ([`src/lib/agents/rank-with-memory.ts`](src/lib/agents/rank-with-memory.ts)) which pulls `capacity`, `accept_rate`, `species_scope`, `response_ms`, and `geo_accuracy` out of Backboard before scoring.
- Outcomes flow back in via `applyOutcomeToSignals` ([`src/lib/memory/helpers.ts`](src/lib/memory/helpers.ts)), accept increments `accept_rate`, decrements `capacity`, reinforces `species_scope` +0.1; decline clamps `species_scope` -0.05; species correction retrains both the new and original scope.
- `/admin/cases` shows the **before vs. after** ranking side-by-side from the same dataset, proving memory changed behaviour.
- A `FallbackMemory` proxy ([`src/lib/memory/index.ts`](src/lib/memory/index.ts)) guarantees the demo even if the Backboard tenant hiccups: every upsert is mirrored to `memory_entries` with `source='backboard' | 'local_fallback'`.

### Auth0 for AI Agents, scoped on-behalf-of

- The Dispatcher is a **first-class OAuth client**, not a cron job. It never sends email without a user-consented token.
- "Send referral" routes the finder through `/api/auth/consent?ctx=send-referral-to-<rehabber>` which calls Auth0 with `prompt=consent`, `scope=referral:send`, and `audience=AUTH0_AGENT_AUDIENCE`. **PAR** is enabled on the client so the authorization request itself is pushed server-to-server, the browser only sees a `request_uri` handle ([`src/lib/auth/client.ts`](src/lib/auth/client.ts)).
- `getAgentToken` ([`src/lib/auth/agent-token.ts`](src/lib/auth/agent-token.ts)) returns a `{token, mode}` pair, `user-consented` when the session has `referral:send`, `m2m-fallback` otherwise. The mode is logged per dispatch and surfaced in the UI as an auth-mode badge.
- The dispatcher asserts the scope before ever touching Resend and throws `AUTH_SCOPE_MISSING` if absent ([`src/lib/agents/dispatcher.ts`](src/lib/agents/dispatcher.ts)).

## $0 stack

Every dependency is free-tier. Groq, Backboard, Auth0, Supabase, Resend, and Vercel all ship generous free plans; every agent has a local fallback so the demo works even if a vendor tenant hiccups.

## Local setup

```bash
pnpm install
cp .env.example .env.local   # then fill in the keys you have; build works without any
pnpm dev
```

Environment variables are documented in [`.env.example`](.env.example). Supabase migrations live in `supabase/migrations/` and are applied via the Supabase CLI (`supabase db push`) or the SQL editor. Seeded rehabbers and RLS policies are included in the migrations.

## Deploy

1. Push to GitHub; import into Vercel (Hobby tier).
2. Add the env vars from `.env.example` in the Vercel dashboard (production + preview).
3. Point a Supabase project at the same env vars; run migrations; ensure the `photos` bucket is private.
4. Configure the Auth0 tenant with a regular web app + a separate M2M client; grant `referral:send` scope on the agent API.
5. Deploy. Set `APP_BASE_URL` to the production URL so magic-link emails resolve correctly.

## Demo flow

1. `/report` → take a photo, grant location, upload → Finder agent (Groq) returns a triage card with species + severity + do/don't.
2. Tap **Send referral** → Auth0 consent modal (`referral:send`) → Dispatcher fires a scoped token exchange → Resend delivers the intake email.
3. Rehabber clicks the magic-link in the email → `/rehabber/outcome/[token]` → picks *accept / decline / transferred / closed* → Memory agent upserts the signal into Backboard.
4. Submit a second, same-species case. Visit `/admin/cases` → the **re-ranked now (memory effect)** panel shows the top rehabber has shifted. Backboard did that.

## Status

MVP feature-complete:

- [x] Mobile-first responsive landing + CTA
- [x] Photo upload with camera capture + downscale
- [x] Geolocation capture with manual fallback
- [x] Groq multimodal structured triage
- [x] Triage result screen (species, severity, do/don't)
- [x] Leaflet map with top-3 rehabbers
- [x] Auth0-scoped Dispatcher agent + Resend email
- [x] Supabase case state machine (`new → triaged → referred → accepted → closed`)
- [x] Backboard memory agent re-ranking
- [x] Rehabber magic-link outcome page

Stretch items remain intentionally out of scope.

## License

[MIT](LICENSE) © 2026 Arqam Waheed.

## Credits

Built solo for the [DEV Earth Day Challenge 2026](https://dev.to/challenges). Co-authored with GitHub Copilot CLI.
