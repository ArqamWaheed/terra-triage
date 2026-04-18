# Terra Triage — Technical Design Document

> Companion to `PRD.md` v1.0. Scope = MVP §6.1 only. Budget = $0. Deadline = 2026-04-20 06:59 UTC.

---

## 1. Overview

Terra Triage is a mobile-first PWA that turns a phone photo of an injured wild animal into a licensed-rehabber referral email in ≤90s. The system is a thin Next.js front-end talking to three cooperating agent roles (Finder / Dispatcher / Memory) that wrap Gemini multimodal inference, Auth0 for AI Agents scoped consent, and Backboard persistent memory. All state lives in Supabase (Postgres + Storage). Deployment is Vercel free tier. No paid services, no native app, no backend server beyond Next.js route handlers.

> **TL;DR — Key Tech Decisions**
> - **Framework:** Next.js 15 App Router + TS + Tailwind, deployed on Vercel Hobby.
> - **DB/Storage/Auth-fallback:** Supabase free tier. RLS on. Signed URLs for photos.
> - **Agents:** 3 logical roles orchestrated in one Node runtime; Backboard is memory layer, not agent host.
> - **Vision:** `gemini-2.5-flash` with JSON schema output; one retry; text-only fallback.
> - **Auth:** Auth0 for AI Agents — Token Vault + CIBA-style consent for the Dispatcher's `referral:send` scope.
> - **Email:** Resend free tier (100/day). Fallback: Gmail SMTP via Supabase edge fn.
> - **Maps:** Leaflet + OSM tiles. MapLibre/Carto fallback.
> - **Non-goals:** queues, microservices, Docker, paid APM, native apps.

---

## 2. System Architecture

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
         │  (Gemini)    │ │ (Backboard)  │ │ (Auth0 + Resend) │
         └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘
                │                │                  │
                ▼                ▼                  ▼
         ┌──────────┐     ┌────────────┐     ┌─────────────┐
         │ Gemini   │     │ Backboard  │     │ Auth0 for   │
         │ 2.5-flash│     │ Memory API │     │ AI Agents   │
         └──────────┘     └────────────┘     └──────┬──────┘
                                                    │ scoped token
                                                    ▼
                                             ┌─────────────┐
                                             │ Resend API  │
                                             └─────────────┘

                ┌──────────────────────────────────────────┐
                │  Supabase (Postgres + Storage + RLS)     │
                │  cases · rehabbers · referrals ·         │
                │  memory_entries · users · photos bucket  │
                └──────────────────────────────────────────┘
                             ▲  all agents read/write through RLS
```

---

## 3. Component Breakdown

### 3.1 Frontend — Next.js App Router PWA
- Routes: `/`, `/report` (capture), `/case/[id]` (tracking), `/rehabber/outcome/[token]`, `/admin/cases`.
- Client-side image downscale to ≤1600px (canvas) before upload (FR-1).
- `navigator.geolocation` with manual lat/lng textbox fallback (US-1, FR).
- PWA manifest + icon; offline shell + queued capture (stretch S-1) deferred past hour-8 freeze.
- State: URL-first, React Server Components where possible, `useActionState` for form submits.
- Styling: Tailwind + shadcn/ui dispatcher-console motif (severity badges, ETA chip, "AGENT DISPATCHED" banner — per research §7).

### 3.2 Edge/API Layer — Next.js Route Handlers + Server Actions
- All writes via Server Actions (auto-CSRF, typed).
- External calls (Gemini, Backboard, Resend, Auth0 token exchange) always server-side — no secrets in client.
- Rate limiting via Vercel Edge Middleware using an in-memory LRU keyed by IP + path (free; no Upstash).
- One background primitive: `waitUntil()` for fire-and-forget Backboard writes on outcome events.

### 3.3 Agent Orchestrator
Three logical roles, each a server-only module. No framework (LangChain etc.) — pure functions. Orchestrator is `app/lib/agents/orchestrator.ts`.

| Agent | Role | Inputs | Outputs | External dep |
|---|---|---|---|---|
| **Finder** | Photo → triage card | photo URL, geo | `{species, confidence, severity, safety_advice, should_touch}` | Gemini |
| **Dispatcher** | Pick rehabber, get consent, send email | case_id, user_sub | referral row, email id | Backboard (read), Auth0 (token), Resend |
| **Memory** | Store/update rehabber signal + rerank | rehabber_id, outcome_event | updated memory entry | Backboard |

Orchestrator is stateless; sequencing enforced by case status enum (§4).

### 3.4 Database — Supabase Postgres
- Single project, single schema `public`.
- RLS on every table. Policies keyed to `auth.uid()` (Auth0 JWT mapped to Supabase via `sub` claim) or HMAC magic-link for rehabber outcome pages (no login for rehabbers — PRD §Persona B).
- Storage bucket `photos` (private), accessed via 7-day signed URLs per FR-7.

### 3.5 External Services

| Service | Purpose | Free-tier note |
|---|---|---|
| Gemini 2.5-flash | species/severity | 15 RPM; cache last 5 results |
| Backboard | rehabber memory + reranking | hackathon credits; ~500 ops budgeted |
| Auth0 for AI Agents | scoped on-behalf-of token for Dispatcher | preview; feature-flag |
| OSM + Leaflet | map tiles | fair-use; demo volume only |
| Resend | rehabber email | 100/day |
| Supabase | DB + Storage + realtime cases/[id] | 500MB DB, 1GB storage |

---

## 4. Data Model

```sql
-- users: Auth0-linked. We store Auth0 'sub' as primary id.
create table users (
  id text primary key,                     -- Auth0 sub (e.g. "auth0|abc")
  email text not null,
  display_name text,
  created_at timestamptz default now()
);
create index on users(email);

-- rehabbers: seeded, ~15 hand-curated US rehabbers.
create table rehabbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text,
  email text not null,
  phone text,
  lat double precision not null,
  lng double precision not null,
  species_scope text[] not null default '{}',  -- ['raptor','songbird','mammal_small']
  radius_km integer not null default 50,
  capacity integer not null default 5,         -- remaining intake slots
  active boolean not null default true,
  created_at timestamptz default now()
);
create index rehabbers_active_idx on rehabbers(active);
create index rehabbers_geo_idx on rehabbers using gist (
  ll_to_earth(lat, lng)
);

-- cases: one per finder submission.
create type case_status as enum ('new','triaged','referred','accepted','declined','closed');
create table cases (
  id uuid primary key default gen_random_uuid(),
  finder_user_id text references users(id),   -- nullable: anonymous intake allowed
  finder_email text,
  photo_path text not null,                    -- supabase storage key
  lat double precision not null,
  lng double precision not null,
  species text,
  species_confidence numeric(3,2),
  severity smallint check (severity between 1 and 5),
  safety_advice jsonb,                         -- {touch:bool, containment:string, transport:string, line:string}
  status case_status not null default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index cases_status_idx on cases(status);
create index cases_created_idx on cases(created_at desc);

-- referrals: Dispatcher's audit log.
create table referrals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  rehabber_id uuid not null references rehabbers(id),
  rank_score numeric(6,3) not null,            -- Backboard-derived score at send time
  rank_explain jsonb,                          -- snapshot of signals used
  email_provider_id text,                      -- Resend message id
  magic_token_hash text not null,              -- HMAC(token) for outcome link
  magic_expires_at timestamptz not null,
  sent_at timestamptz default now(),
  outcome text,                                -- 'accepted' | 'declined' | 'transferred' | 'closed'
  outcome_at timestamptz,
  outcome_notes text
);
create index referrals_case_idx on referrals(case_id);
create index referrals_rehabber_idx on referrals(rehabber_id);

-- memory_entries: local mirror of Backboard writes for observability + fallback.
create table memory_entries (
  id bigserial primary key,
  rehabber_id uuid not null references rehabbers(id) on delete cascade,
  key text not null,                           -- 'capacity' | 'accept_rate' | 'species_scope' | 'response_ms'
  value jsonb not null,
  source text not null default 'backboard',    -- 'backboard' | 'local_fallback'
  created_at timestamptz default now()
);
create index memory_entries_rehab_key_idx on memory_entries(rehabber_id, key, created_at desc);

-- Storage
-- bucket: photos (private). Path: `cases/{case_id}/original.jpg`.
```

**RLS notes**
- `cases`: `select` if `finder_user_id = auth.uid()` OR row returned through signed tracking URL handler (service role bypass).
- `rehabbers`: public `select` of non-PII columns only via a view `rehabbers_public` (no email/phone). Full-row access requires service role.
- `referrals`: writable only by service role; readable to rehabber via HMAC magic-token route.
- `memory_entries`: service role only.

---

## 5. Agent Flows

### 5.1 Intake Flow (photo → triage card)

```
Finder(Browser)        Next.js Server        Gemini        Supabase
      │ POST photo+geo      │                    │              │
      ├────────────────────▶│                    │              │
      │                     │  upload()          │              │
      │                     ├───────────────────────────────────▶│
      │                     │  INSERT case(status='new')        │
      │                     ├───────────────────────────────────▶│
      │                     │  multimodal(photo, prompt)        │
      │                     ├───────────────────▶│              │
      │                     │  JSON triage      │              │
      │                     │◀───────────────────┤              │
      │                     │  UPDATE case(status='triaged',...)│
      │                     ├───────────────────────────────────▶│
      │  triage card JSON   │                    │              │
      │◀────────────────────┤                    │              │
```

### 5.2 Dispatch Flow (consent → scoped token → email)

```
Finder       Next.js       Auth0-for-Agents    Backboard     Resend     Supabase
  │ "Send referral"│             │                 │            │          │
  ├───────────────▶│             │                 │            │          │
  │                │ rank_rehabbers(case)          │            │          │
  │                ├─────────────────────────────▶│            │          │
  │                │ ranked[]                      │            │          │
  │                │◀─────────────────────────────┤            │          │
  │ consent modal  │  request_consent(scope=referral:send)      │          │
  │◀──────────────┤──────────────▶│               │            │          │
  │  approve       │               │               │            │          │
  ├───────────────▶│               │               │            │          │
  │                │ exchange → scoped_token(aud=terra-triage-agent)      │
  │                │◀──────────────┤               │            │          │
  │                │ send(email, bearer=scoped_token)           │          │
  │                ├───────────────────────────────────────────▶│          │
  │                │ message_id                    │            │          │
  │                │◀──────────────────────────────────────────┤          │
  │                │ INSERT referral, UPDATE case(status='referred')       │
  │                ├────────────────────────────────────────────────────────▶│
  │ success        │                                                        │
  │◀──────────────┤                                                        │
```

### 5.3 Learning Flow (outcome → memory update → rerank)

```
Rehabber       Next.js         Supabase        Backboard
  │ click magic-link│              │                │
  ├────────────────▶│              │                │
  │                 │ verify HMAC  │                │
  │                 ├─────────────▶│                │
  │ outcome form    │              │                │
  │◀───────────────┤              │                │
  │ submit outcome  │              │                │
  ├────────────────▶│              │                │
  │                 │ UPDATE referral.outcome       │
  │                 ├─────────────▶│                │
  │                 │ memory.write(rehabber_id,     │
  │                 │   {capacity-=1, accept_rate,  │
  │                 │    species_scope_reinforced}) │
  │                 ├──────────────────────────────▶│
  │                 │ (next dispatch call returns updated ranking)
```

---

## 6. API Surface

| Method | Path | Auth | Purpose | Req → Res |
|---|---|---|---|---|
| POST | `/api/cases` | anon allowed | Create case, upload photo, run Finder agent | `multipart{photo, lat, lng, email?}` → `{case_id, triage}` |
| GET | `/api/cases/:id` | finder token OR service | Tracking poll | → `{status, triage, referral?}` |
| POST | `/api/dispatch/:caseId` | Auth0 user | Kick off Dispatcher (returns consent URL or sends) | `{}` → `{consent_url}` or `{referral_id}` |
| GET | `/api/auth/callback` | — | Auth0 OIDC callback | code → session cookie |
| POST | `/api/auth/agent-token` | Auth0 user | Exchange user session for agent scoped token | → `{token, exp}` (server-only actually) |
| GET | `/api/rehabber/outcome/:token` | HMAC | Render outcome form | → HTML |
| POST | `/api/rehabber/outcome/:token` | HMAC | Write outcome + memory | `{outcome, notes?, species_correction?}` → `{ok}` |
| GET | `/admin/cases` | basic-auth env | Ops board | → HTML |

All server actions co-located under `app/(actions)/*.ts` using `"use server"`.

---

## 7. Gemini Multimodal Usage

**Model:** `gemini-2.5-flash` (free tier). Temperature 0.2. `responseMimeType: application/json` + response schema.

**Prompt template** (`app/lib/agents/finder.ts`):
```ts
const SYSTEM = `You are a wildlife triage assistant for licensed rehabbers.
You receive ONE photo and GPS coords. Identify the species and grade injury severity.
Be conservative: if unsure, say so. You are NOT a veterinarian; output triage, not diagnosis.
Safety advice MUST include: whether to touch, how to contain, how to transport, and the line
"When in doubt, call — don't carry."`;

const SCHEMA = {
  type: "object",
  required: ["species","confidence","severity","safety_advice","should_touch"],
  properties: {
    species:        { type: "string" },
    species_common: { type: "string" },
    confidence:     { type: "number", minimum: 0, maximum: 1 },
    severity:       { type: "integer", minimum: 1, maximum: 5 },
    should_touch:   { type: "boolean" },
    safety_advice: {
      type: "object",
      required: ["containment","transport","line"],
      properties: {
        containment: { type: "string" },
        transport:   { type: "string" },
        line:        { type: "string" }
      }
    },
    uncertainty_notes: { type: "string" }
  }
};
```

**Safety / grounding**
- System prompt hard-codes "not a veterinarian" disclaimer.
- Always emit the literal "When in doubt, call — don't carry." string (FR-3).
- Reject output if `confidence < 0.35` → set `species = "Unknown animal"`, severity inferred from visual cues only, surface `uncertainty_notes` to UI.

**Fallback chain**
1. JSON parse fail → one retry with `temperature=0`.
2. Retry fail → text-only prompt, regex-extract species + severity keywords.
3. Still fail → UI shows "We couldn't ID this — here are the nearest rehabbers by location only." Dispatcher still functions.

---

## 8. Auth Flow (Auth0 for AI Agents)

**Primitives exercised** (named so judges see them):
- **Agent identity:** registered Auth0 application `terra-triage-dispatcher` (type: AI Agent).
- **Token Vault:** holds the user-consented access token for the dispatcher on-behalf-of the user.
- **CIBA-style consent step:** user approves the exact action `referral:send` in an Auth0 modal before the agent gets a token.
- **Scoped audience:** token `aud = https://api.terra-triage/agents`, single scope `referral:send`.

**Sequence** (detail of §5.2):
1. User clicks "Send referral" → Next.js server action starts `/oauth/par` (Pushed Authorization Request) with `scope=referral:send` + `resource=https://api.terra-triage/agents` + a human-readable `consent_context` describing the chosen rehabber.
2. User is redirected to Auth0 consent screen: *"Terra Triage wants to email Marcus @ Hudson Valley Raptors on your behalf."*
3. On approval, Auth0 returns code → server exchanges for **agent access token** stored in Token Vault (`sub=user, act=agent`).
4. Server action retrieves token from Vault, calls internal `dispatcher.send(token)` which:
   - Validates `scope` includes `referral:send`.
   - Calls Resend with a payload that embeds `referral_id` so token cannot be reused for other cases.
5. Token is single-use; invalidated after email send (explicit revoke call).

**Storage:** refresh tokens never touch our DB. Short-lived access tokens pass through server memory only. Session cookie (HttpOnly, Secure, SameSite=Lax) binds the user; no localStorage tokens.

**Fallback if Auth0 AI Agents API unavailable:** ship standard Auth0 OIDC login + a manually minted M2M token with the `referral:send` scope, and narrate agent identity in the demo (per PRD R-2).

---

## 9. Backboard Memory Integration

**What's stored per rehabber** (key → value shape):

| Key | Shape | Updated when |
|---|---|---|
| `capacity` | `{ remaining:int, updated_at }` | on outcome accepted/declined |
| `accept_rate` | `{ n:int, accepted:int, rate:float }` | on any outcome |
| `species_scope` | `{ [species]: weight:float }` | outcome + species_correction |
| `response_ms` | `{ n:int, avg_ms:int }` | sent→outcome delta |
| `geo_accuracy` | `{ km_median:float, n:int }` | when outcome has location correction |

**Retrieval shape** (Backboard query on dispatch):
```ts
const signals = await backboard.memory.query({
  namespace: "terra-triage/rehabbers",
  ids: candidateRehabberIds,          // pre-filtered by radius via Postgres
  keys: ["capacity","accept_rate","species_scope","response_ms"]
});
const ranked = candidates.map(r => ({
  r,
  score:
      0.35 * speciesMatch(r, case.species, signals)
    + 0.25 * distanceScore(r, case)
    + 0.20 * capacityScore(signals[r.id])
    + 0.15 * acceptRate(signals[r.id])
    + 0.05 * responseSpeed(signals[r.id])
})).sort((a,b) => b.score - a.score);
```

**Write path** (after outcome):
```ts
await backboard.memory.upsert({
  namespace: "terra-triage/rehabbers",
  id: rehabberId,
  entries: [
    { key: "capacity",    value: { remaining: Math.max(0, cap-1) }},
    { key: "accept_rate", value: newRate },
    { key: "species_scope", value: speciesWeights },
    { key: "response_ms", value: newAvg }
  ]
});
// mirror to memory_entries for observability
```

**Demo before/after moment**
1. Case A submitted (Red-tailed Hawk) → ranking shows Rehabber X top.
2. Simulated decline from X + acceptance from Y (second run).
3. Case B (identical species) → Y is now top. `/admin/cases` surfaces the `rank_explain` JSON side-by-side. This is the Backboard protagonist moment (research §4 primary).

**Fallback:** identical interface backed by `memory_entries` JSONB queries (PRD R-3). Swap is a single import change.

---

## 10. Deployment Topology

| Env | Where | Branch |
|---|---|---|
| prod | `terra-triage.vercel.app` (Vercel Hobby) | `main` |
| preview | Vercel preview per PR | any |
| local | `next dev` + Supabase local (optional) | — |

**Secrets (Vercel env):**
- `GEMINI_API_KEY`
- `BACKBOARD_API_KEY`
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AGENT_AUDIENCE`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`
- `RESEND_API_KEY`, `RESEND_FROM` (use `onboarding@resend.dev` fallback)
- `MAGIC_LINK_SECRET` (HMAC)
- `ADMIN_BASIC_AUTH` (user:pass)

**GitHub Actions:** single `ci.yml` — `pnpm install && pnpm typecheck && pnpm lint && pnpm build`. No deploy step (Vercel auto-deploys). ~2 min.

**Supabase:** single project, region `us-east-1`. SQL migrations in `/supabase/migrations/*.sql`. Seed script `/supabase/seed/rehabbers.sql` (~15 rows).

---

## 11. Security & Privacy

- RLS on every table (§4).
- Photos: private bucket; 7-day signed URLs embedded in rehabber emails (FR-7).
- Finder PII (email, exact GPS): visible only to the accepted rehabber; public map snaps to 1km grid (PRD §9).
- Scoped agent token: one scope, short TTL, single-use for the Dispatcher (§8).
- Magic-link outcome: HMAC-SHA256, 72h TTL, single-use, invalidated on first outcome write (FR-9).
- Rate limiting: edge middleware — 5 photo uploads/min/IP, 20 dispatch calls/hr/user.
- PII purge: nightly Vercel cron (`/api/cron/purge`) deletes photos + finder email for `closed` cases older than 30 days (FR-10).
- CSP: strict; no third-party JS except Leaflet + tile server.
- Secrets: Vercel env only; never in `NEXT_PUBLIC_*`.

---

## 12. Observability

| Signal | Where |
|---|---|
| HTTP / function logs | Vercel dashboard |
| DB queries, auth events | Supabase logs |
| Agent decisions | `memory_entries` + `referrals.rank_explain` JSONB |
| Ops board | `/admin/cases` (basic-auth) — lists cases, triage JSON, referrals, rank explain |
| Errors | `console.error` → Vercel; no Sentry (paid avoidance) |

---

## 13. Failure Modes & Fallbacks

| Failure | Symptom | Fallback | Ships? |
|---|---|---|---|
| Gemini 429 / 5xx | Finder agent errors | Cache of 5 pre-computed demo results; else location-only dispatch | ✅ |
| Gemini low confidence | `<0.35` | UI labels "Unknown", safety advice still shown, dispatch by proximity only | ✅ |
| Backboard down | Memory read fails | Swap to `memory_entries` JSONB backend — same interface | ✅ (loses Backboard prize only if we never demo it working) |
| Auth0 AI Agents API preview broken | Consent flow throws | Standard Auth0 OIDC + pre-minted scoped M2M token; narrate as agent identity | ✅ |
| Resend 429 | Dispatch fails to send | Queue in `referrals` with `email_provider_id=null`; retry via Gmail SMTP edge fn | ✅ |
| Supabase down | Global outage | n/a — hackathon window; readme-document the dep | ❌ graceful 503 |
| OSM tiles rate-limit | Map blank | MapLibre + Carto base tiles | ✅ |

Non-negotiable: **photo → triage card + safety advice** must work even if every external except Gemini fails.

---

## 14. Accessibility & Mobile-First

- Tailwind breakpoints start at 375px (iPhone SE).
- Tap targets ≥ 44×44 CSS px.
- Severity badge: colour + icon + text (not colour-only) — colour-blind safe.
- `prefers-reduced-motion` disables consent-modal and "AGENT DISPATCHED" animations.
- Semantic HTML: `<main>`, `<form>`, `<button type="submit">`; labels tied with `htmlFor`.
- PWA manifest: `name`, `short_name`, `theme_color`, `icons` (192/512), `display: standalone`.
- **Offline capture queue** (stretch only): IndexedDB holds `{photo blob, geo, ts}`; retries on `online` event.

---

## 15. 42-Hour Build Sequence

> Hour 0 = kickoff. All times local to dev. **Hour-8 Scope Freeze** is non-negotiable.

| Block | Hours | Milestones | MVP feature |
|---|---|---|---|
| A | 0–2 | Repo scaffold: `create-next-app`, Tailwind, shadcn, Vercel link, env skeleton, Supabase project created, migrations file. | — |
| B | 2–4 | DB schema applied, seed 15 rehabbers, RLS policies, Storage bucket. Landing `/` + CTA. | #1 |
| C | 4–6 | `/report` capture: camera, geo, downscale, upload to Storage, create case row (status=new). | #2, #3 |
| D | 6–8 | Finder agent: Gemini call w/ schema, JSON parse + retry, triage card UI. | #4, #5 |
| **🔒** | **8** | **SCOPE FREEZE** — all 10 MVP features enumerated as issues; stretch items closed. Walk, eat. | — |
| E | 8–12 | Leaflet map + nearest-3 query; case→referral plumbing; UI "Send referral" CTA wired to placeholder. | #6 |
| F | 12–16 | Auth0 app + AI Agents config; login; consent flow; server-side token exchange. | #7 (auth half) |
| G | 16–20 | Dispatcher agent: Resend email template (inline photo, species, GPS link); send with scoped token; referrals row write. | #7 (dispatch half) |
| H | 20–22 | Sleep 2h (solo dev reality). | — |
| I | 22–26 | Backboard memory: namespace setup, query on rank, upsert on outcome; `memory_entries` mirror; local fallback behind interface. | #9 |
| J | 26–30 | Rehabber outcome magic-link: HMAC sign/verify, outcome form, status update, memory write. | #8, #10 |
| K | 30–33 | `/admin/cases` ops page; rank_explain visualisation; demo seed dataset polish. | — |
| L | 33–36 | End-to-end rehearsal; timing (< 90s); fix longest pole. PWA manifest + icon. | NFR |
| M | 36–39 | Demo video (60–90s) script + record. Hero screenshot. Architecture diagram (Excalidraw). | submission |
| N | 39–41 | DEV post drafted, tags, code embeds, prize-category justification sections. | submission |
| O | 41–42 | Buffer: final publish + share. **Publish by T-2h (04:59 UTC 04-20).** | — |

**Pre-freeze red line:** if at hour 8 any of Gemini call, photo upload, or case row write is broken, cut the map (US-4) to a static list and keep going.

---

## 16. Prize-Category Proof Moments

| Prize | Exact demo moment | Where in video | Backing artifact |
|---|---|---|---|
| **Backboard** | Same-species case submitted twice; after a simulated decline, top rehabber swaps from X to Y. Narrator says "the memory agent reranked." | 0:35–0:55 | `/admin/cases` rank_explain JSON side-by-side screenshot in DEV post |
| **Backboard** (depth) | 3 memory keys visibly read (`capacity`, `accept_rate`, `species_scope`) on dispatcher call. | 0:45 | Code embed of `backboard.memory.query(...)` |
| **Auth0 for AI Agents** | User taps "Send referral" → Auth0 consent modal appears with human-readable "email Marcus on your behalf" → scoped `referral:send` approved → email sent. | 0:20–0:35 | Screenshot of consent modal in post; code embed of PAR + token exchange |
| **Auth0 for AI Agents** (depth) | Narrator: "agent has its own identity `terra-triage-dispatcher`; token scope is `referral:send` only; token is single-use." | 0:30 | Auth0 app config screenshot |
| **Relevance / Earth Day** | Live hawk photo → referral email sent ≤ 90s on stopwatch. | 0:00–1:00 | Stopwatch overlay in video |
| **Technical execution** | Live URL loads on mobile; RLS blocks cross-user access (demoed in admin page). | B-roll | Live URL + public repo |

---

## 17. Open Technical Questions

1. **Auth0 AI Agents preview:** is PAR + Token Vault available on free tenants, or is a waitlist required? → **confirm before hour 12**.
2. **Backboard memory namespaces:** does the free tier allow the `terra-triage/rehabbers` namespace shape we assume, or do we need one namespace per rehabber? → **confirm hour 1**.
3. **Anonymous intake:** PRD Q1 leans yes — confirm we ship case creation without Auth0 login and only auth-gate the dispatch step.
4. **Rehabber email deliverability:** Resend free from `onboarding@resend.dev` works but looks unbranded — acceptable for demo, or do we add a free domain on Cloudflare?
5. **Severity-5 flow:** PRD Q4 — do we short-circuit to "call local animal control" instead of dispatching a rehabber? Default: still dispatch, but banner the finder UI.
6. **Seeded rehabbers region:** one US state only (CA DFW list) or multi-state? → pick one for demo stability.
7. **Admin auth:** basic-auth env is fine for demo; confirm we don't need Auth0 RBAC.
8. **Geo index:** do we actually need the `earthdistance` / `cube` extensions on Supabase free, or is naive haversine in SQL sufficient for 15 rows?

---

*End of Technical Design v1.0 — aligned to PRD v1.0 MVP §6.1. Any stretch item requires explicit PRD revision.*
