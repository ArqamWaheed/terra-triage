# Terra Triage — Product Requirements Document

> **One-line pitch:** *Snap a photo of an injured wild animal and a multi-agent system identifies the species, triages the injury, and dispatches the referral to the nearest licensed rehabber — in under 60 seconds.*

---

## 1. Document Meta

| Field | Value |
|---|---|
| Document | Terra Triage PRD |
| Version | 1.0 |
| Date | 2026-04-18 |
| Author | Solo hackathon dev |
| Event | DEV Weekend Challenge: Earth Day Edition |
| Submission deadline | **2026-04-20 06:59 UTC** (42h build window) |
| Status | Approved for build |

---

## 2. Vision & North Star

Terra Triage collapses the chaotic gap between *"I just found a hurt animal"* and *"a trained rehabber is on the way"* from hours of frantic Googling into a single guided 60-second flow. We win Earth Day by routing more wildlife casualties into licensed care instead of well-meaning but fatal DIY rescue attempts.

**North-Star Metric (judged demo):** time from photo upload → rehabber referral email sent ≤ **90 seconds**.

---

## 3. Problem Statement

When a citizen finds an injured wild animal today, they:
1. Don't know what species it is (songbird? protected raptor? rabies-vector mammal?).
2. Don't know if it's actually injured or just a fledgling/hibernating/playing dead.
3. Don't know who to call — rehabbers are volunteer-run, geographically sparse, and often missing from Google.
4. Pick up the animal anyway, stress it to death, or dump it at an unequipped vet.

The result: preventable wildlife mortality and overwhelmed rehabbers who receive panicked 2am phone calls with zero intake info. Terra Triage replaces that scramble with a guided, AI-triaged, pre-authorized referral.

---

## 4. Target Users

### Persona A — "Panicked Finder" (Priya, 34, suburban commuter)
- Just saw a stunned hawk on the sidewalk. On her phone. Mild freakout.
- Wants: *tell me what it is, tell me if I should touch it, tell me who to call — right now.*
- Tech comfort: medium. Will not install an app. Will click one link.

### Persona B — "Overloaded Rehabber" (Marcus, 58, licensed raptor rehabber)
- Runs a 2-person non-profit out of his barn. 40 intakes/week in spring.
- Wants: *clean intake form pre-filled with species, photo, location, and finder's contact — not a voicemail.*
- Tech comfort: low-to-medium. Checks email. Hates logins.

---

## 5. User Stories

| # | Story | Persona |
|---|---|---|
| US-1 | As a finder, I want to upload a photo from my phone camera, so that I don't have to describe the animal in words. | A |
| US-2 | As a finder, I want instant species + severity identification, so that I know whether this is an emergency. | A |
| US-3 | As a finder, I want clear "do / don't do" safety advice, so that I don't hurt myself or the animal. | A |
| US-4 | As a finder, I want to see the nearest rehabber on a map, so that I trust the recommendation. | A |
| US-5 | As a finder, I want the system to send the referral for me after I approve, so that I don't have to cold-call strangers. | A |
| US-6 | As a finder, I want a tracking link to see if the rehabber accepted, so that I have closure. | A |
| US-7 | As a rehabber, I want a pre-filled intake email with photo + GPS + species + severity, so that I can accept/decline in one click. | B |
| US-8 | As a rehabber, I want the system to remember my species scope, radius, and current capacity, so that I stop getting irrelevant referrals. | B |
| US-9 | As a rehabber, I want to mark a case outcome (accepted / transferred / released / deceased), so that the system improves. | B |
| US-10 | As a judge, I want to see Auth0 + Backboard + Gemini working end-to-end on free tiers, so that the project qualifies for prize categories. | — |

---

## 6. Feature Scope

### 6.1 MVP (must ship in 42 hours) — 10 features

1. Mobile-first responsive landing page with **"Report an animal"** CTA (Next.js/Vercel).
2. Photo upload (camera capture on mobile, file picker on desktop) → Supabase Storage.
3. Geolocation capture (`navigator.geolocation`) with manual lat/lng fallback.
4. Gemini multimodal call returning `{species, confidence, severity (1–5), safety_advice, should_touch: bool}`.
5. Triage result screen: big species name, severity badge, bulleted do/don't list.
6. Leaflet + OSM map showing the finder pin + nearest 3 rehabbers from seeded DB.
7. Auth0-authenticated **Dispatch Agent** that, on user approval, composes and sends an intake email via Resend to the top-ranked rehabber on behalf of the user.
8. Case record persisted in Supabase Postgres with status enum (`new → referred → accepted → closed`).
9. **Backboard memory agent** that stores per-rehabber preferences (species scope, radius km, capacity, avg response time) and re-ranks future referrals.
10. Rehabber one-click outcome page (magic-link, no password) that updates case status and feeds the memory agent.

### 6.2 Stretch (only if time permits)

- S-1: PWA install manifest + offline shell.
- S-2: Auto-translate safety advice to browser locale via Gemini.
- S-3: SMS fallback via free Supabase edge function → rehabber's email-to-SMS gateway.
- S-4: Public "cases this week" transparency dashboard.
- S-5: Finder can attach a second photo + short voice note (Gemini transcribes).

### 6.3 Explicit Non-Goals

- ❌ Native iOS/Android apps.
- ❌ Real-time video/chat with a vet.
- ❌ Payment processing / donations / tipping.
- ❌ Transport/Uber-for-animals logistics.
- ❌ Government permit verification for rehabbers (trust seeded list).
- ❌ Multi-tenant rehabber dashboards with analytics.
- ❌ Paid map tiles, paid SMS, paid email.
- ❌ Medical diagnosis beyond coarse severity 1–5.

---

## 7. UX Flow

### 7.1 Finder happy path
1. Lands on `/` → taps **"Report an animal"**.
2. Grants camera + location permission → snaps photo.
3. Sees spinner ≤ 5s → triage card: *"Red-tailed Hawk · Severity 4/5 · Do NOT touch"*.
4. Sees map with 3 nearest rehabbers, top one highlighted with ETA/distance.
5. Taps **"Send referral"** → Auth0 modal (one-tap social login) → consent screen *"Allow Terra Triage to email Marcus @ Hudson Valley Raptors on your behalf?"*.
6. Confirmation screen with case ID + tracking link bookmarked via URL.

### 7.2 Rehabber happy path
1. Receives intake email with photo thumbnail, species, severity, GPS map link, finder contact.
2. Clicks **"Accept"** or **"Decline — at capacity"** magic-link button.
3. Lands on outcome page → optional fields (intake notes, species corrected, final outcome).
4. Backboard memory updated: capacity −1, species scope reinforced, response-time metric logged.

---

## 8. Functional Requirements

- **FR-1** (US-1, MVP-2): Accept JPEG/PNG/HEIC up to 10 MB; client-side downscale to ≤1600px before upload.
- **FR-2** (US-2, MVP-4): Gemini `gemini-2.5-flash` multimodal call with structured JSON output; retry once on parse failure; fall back to text-only prompt.
- **FR-3** (US-3, MVP-5): Safety advice always includes: touch-or-not, containment, transport, and "when in doubt, call, don't carry" line.
- **FR-4** (US-4, MVP-6): Rehabber ranking = `score(species_match, distance_km, capacity, historical_accept_rate)` computed by Backboard agent.
- **FR-5** (US-5, MVP-7): Auth0-issued token scopes the dispatch agent to `email:send-referral` only; user sees and approves the exact action.
- **FR-6** (US-6, MVP-8): Case state machine enforced at DB level via Postgres check constraint.
- **FR-7** (US-7, MVP-7): Email template renders inline photo (signed Supabase URL, 7-day expiry), species, severity, GPS link, finder name + email.
- **FR-8** (US-8, MVP-9): Backboard stores rehabber profile as durable memory keyed by rehabber ID; updated on every outcome event.
- **FR-9** (US-9, MVP-10): Outcome magic-link signed with HMAC, single-use, 72h TTL.
- **FR-10**: All PII (finder email, location) purged 30 days after case close.

---

## 9. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Latency | Upload → triage result ≤ 6s p95 on 4G. Referral send ≤ 3s. |
| Mobile-first | Designed at 375px width first; tap targets ≥ 44px. |
| Accessibility | WCAG 2.1 AA: semantic HTML, alt text, focus rings, prefers-reduced-motion, colour-blind-safe severity badges. |
| PWA-ready | Valid manifest + installable icon; offline shell stretch only. |
| Privacy | Exact GPS shown only to the accepting rehabber; public map snaps to 1km grid. |
| Browser support | Latest 2 versions of Chrome, Safari, Firefox on iOS/Android/desktop. |
| Observability | Vercel logs + Supabase logs free tier; no paid APM. |

---

## 10. Success Criteria (mapped to judging rubric)

| Rubric Axis | Success Criterion | How we measure |
|---|---|---|
| **Relevance (Earth Day)** | App demonstrably routes at least one live wildlife case from photo → referral email during demo. | Live demo video. |
| **Creativity** | Multi-agent design (triage agent + dispatch agent + memory agent) visibly collaborating. | Architecture diagram in README + demo narration. |
| **Technical execution** | All 10 MVP features functional; 0 paid services; runs on free tiers end-to-end. | Live URL + public repo. |
| **Writing quality** | README + DEV post explain problem, stack, and agent interplay clearly with diagrams. | Submission post. |
| **Category tech — Auth0 for AI Agents** | Dispatch agent acts on user's behalf under scoped Auth0 token with visible consent. | Demo shows consent modal + scoped action. |
| **Category tech — Backboard** | Memory agent demonstrably changes ranking after a simulated outcome event. | Demo shows "before / after" ranking shift. |
| **North-Star** | Photo → referral email sent ≤ 90s end-to-end. | Demo stopwatch. |

---

## 11. $0 Cost Stack & Free-Tier Budget

| Service | Tier | Free Limit | Our Expected Usage | Fallback if exhausted |
|---|---|---|---|---|
| **Vercel** (Next.js host + serverless) | Hobby | 100 GB bandwidth / mo, 100 GB-hr functions | <1 GB for demo | Netlify free tier |
| **Supabase** (Postgres + Storage + Auth fallback + Realtime) | Free | 500 MB DB, 1 GB storage, 5 GB bandwidth | <50 MB DB, ~200 MB photos | Neon (DB) + Cloudflare R2 (storage) |
| **Auth0** (Auth0 for AI Agents) | Free | 25k MAU, agent features in preview | <20 users for demo | Supabase Auth (loses category prize) |
| **Backboard** (agent memory) | Free credits | Hackathon credits | ~500 memory ops | Postgres JSONB table (loses category prize) |
| **Google Gemini API** (`gemini-2.5-flash`) | Free | ~15 RPM, 1500 req/day | <200 req during build+demo | Gemini Pro free tier or on-device transformers.js |
| **OpenStreetMap tiles + Leaflet** | Free | Fair-use | Demo-level usage | MapLibre + Carto free tiles |
| **Resend** (email) | Free | 100 emails/day, 3000/mo | <30 emails demo | Supabase edge function + Gmail SMTP (dev only) |
| **GitHub** (repo + Actions CI) | Free | 2000 Actions min/mo | Minimal | GitLab free |
| **Domain** | none | use `*.vercel.app` | n/a | — |
| **Total monthly cost** | | | **$0.00** | |

---

## 12. Prize-Category Alignment

### 12.1 Auth0 for AI Agents
- Dispatch agent is a **first-class OAuth client**, not a hard-coded cron job.
- On "Send referral" tap, user sees Auth0 consent modal: *"Terra Triage wants to send an email on your behalf to a licensed wildlife rehabber."*
- Token is scoped to `referral:send` only; cannot read other cases.
- Agent identity, scopes, and human-in-the-loop approval step all visible in the demo — directly exercises the category's required primitives.

### 12.2 Backboard
- Memory agent is the *only* source of rehabber ranking — not a static SQL `ORDER BY distance`.
- Stores per-rehabber durable memory: species scope, radius, capacity, accept/decline history, response-time rolling avg.
- Demo explicitly shows: (1) initial ranking, (2) simulated decline, (3) ranking re-shuffles on next referral — proving memory influenced behaviour.
- Uncontested category → high EV use of 42 hours.

---

## 13. Submission Deliverables

- [ ] **DEV.to post** titled "Terra Triage — …" with required tags: `#devchallenge`, `#earthdaychallenge`, plus `#ai`, `#nextjs`.
- [ ] **Public GitHub repo** with MIT licence, README (problem, stack, agent diagram, local setup, env vars), architecture diagram (Excalidraw PNG).
- [ ] **60–120s demo video** (Loom, unlisted YouTube, or MP4 in repo): finder flow → rehabber flow → memory agent before/after.
- [ ] **Live URL** on `terra-triage.vercel.app` (or similar) with seeded demo data.
- [ ] **Pinned one-line pitch** at top of DEV post + repo README (see §top of this doc).
- [ ] Screenshots: triage card, map view, consent modal, intake email.

---

## 14. Risks & Mitigations (Top 5)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Gemini free tier rate-limits mid-demo | Med | High | Cache last 5 triage results; pre-record fallback video clip. |
| R-2 | Auth0 for AI Agents API is preview-only and unstable | Med | High (prize) | Build feature-flagged; if broken, ship with standard Auth0 + scoped M2M token and still narrate agent identity in demo. |
| R-3 | Backboard onboarding eats 4+ hours | Med | Med | Time-box to 3h; if blocked, wrap own Postgres JSONB memory behind identical interface so swap is trivial. |
| R-4 | Seeded rehabber dataset is thin/inaccurate | High | Low | Hand-curate 15 US rehabbers from public state DNR lists; flag as "demo data" in UI. |
| R-5 | Solo dev scope creep blows 42h budget | High | High | Hard-freeze scope at §6.1 by hour 8; stretch items forbidden until all 10 MVP features demo-green. |

---

## 15. Open Questions

1. Should finders be allowed to submit **without** Auth0 login (anonymous case) and only auth at referral-send step? *(leaning yes — lower friction)*
2. How do we handle non-US finders when seeded rehabbers are US-only? *(likely: show "no rehabber in range — here's a global directory link" graceful degradation)*
3. Do we need explicit user consent for Gemini to process the photo under GDPR? *(add checkbox + plain-language notice, log consent)*
4. Should severity 5 ("critical, likely fatal") trigger a different flow (e.g., "contact local animal control" instead of rehabber)?
5. What's the minimum viable "outcome" taxonomy — 4 states or 8? *(start with 4: accepted / declined / transferred / closed-no-action)*
6. Do we expose the Backboard memory as a read-only "why this rehabber?" tooltip for transparency bonus points?

---

*End of PRD v1.0.*
