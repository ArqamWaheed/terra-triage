# Terra Triage — Hackathon Research Brief

> Fast-load context file. Re-read every session. Keep prose terse.

---

## 1. North Star

**Pitch (one-liner, craft carefully — this is the sentence DEV will reprint):**
> *"Snap an injured animal. A multi-agent dispatcher IDs the species, grades the injury, and pages the nearest licensed rehabber on your behalf — in under 60 seconds."*

**Target prizes (ranked):**
1. 🥇 **Backboard** (primary — uncontested field)
2. 🥈 **Auth0 for AI Agents** (secondary — 1 competitor; Terra Triage fits the marketed story better)
3. 🥉 **Overall Winner** (4 slots — novelty + visceral theme fit)

---

## 2. Hackathon Facts

| Field | Value |
|---|---|
| Event | DEV Weekend Challenge: Earth Day Edition |
| Deadline | **2026-04-20 06:59 UTC** |
| Winners | 10 total — 4 overall ($250 ea) + 6 category ($300 ea) |
| Rule | Max 1 prize per participant; can target multiple categories in one submission |
| Tiebreak | **Post reaction count** — share aggressively post-publish |
| Tag | `#weekendchallenge` |
| Template | Use the exact template on the challenge page — missing headers risk DQ |

---

## 3. Judging Rubric Deep-Dive

| Criterion | What it actually rewards | Terra Triage lever |
|---|---|---|
| **Relevance to Theme** | Visceral, unambiguous Earth-Day fit. Not "tangentially eco." | Literally saving wildlife — maximum visceral |
| **Creativity** | Novel framing / under-served angle. Not another carbon tracker. | "Report → action" loop; agent dispatches, not just reports |
| **Technical Execution** | Ships a **real** functional product. Simulations lose (see EcoTrack). | Live multi-agent pipeline, working Gemini ID, real Auth0 M2M |
| **Writing Quality** | DEV literally quoted winners' pitches verbatim. Hero image, arch diagram, 60–90s demo, 2–3 code embeds, personal "why" in first 2 sentences, "what's next" close. | Craft the one-liner first; write the post around it |
| **Prize Category Tech (optional)** | Best-in-class use — make the sponsor tech the *protagonist*, not plumbing. | Backboard = multi-agent memory is the core. Auth0 = agent-to-agent M2M. |

---

## 4. Prize Category Targeting

### Primary: Backboard 🟢 (0 competitors)
- Killer features: persistent memory, 17k LLM routing, RAG (hybrid BM25+vector), multi-agent portable memory, adaptive context.
- Terra Triage uses: **multi-agent orchestration + cross-agent memory + learning rehabber preferences over time**.
- Make Backboard the *protagonist*: memory that evolves per local rehabber network is the narrative hook.

### Secondary: Auth0 for AI Agents 🟠 (1 competitor — GheiaGrid)
- GheiaGrid uses Auth0 to secure IoT sensors (M2M+JWKS). That's not really "for agents."
- Terra Triage uses Auth0 for the **marketed story**: agent-to-agent M2M, Token Vault to act on user's behalf (email rehabber), CIBA for human-in-the-loop dispatch consent.
- **Narrative win** — we fit the category name better than the incumbent.

### Why not the others
| Category | Reason to skip |
|---|---|
| Google Gemini | Free API → saturation surge expected in final 24h. Use it, don't lead with it. |
| Snowflake | GheiaGrid dominates. No natural fit for wildlife dispatch. |
| Solana | GheiaGrid dominates. Forced fit = weak narrative. |
| GitHub Copilot | Winnable only via meta-narrative; dilutes our primary story. |

---

## 5. Competitive Landscape

| Project | Threat | Notes |
|---|---|---|
| **GheiaGrid** (@kheai + @yeemun122) | 🔴 MAX | Targets 5/6 categories (Auth0, Snowflake, Gemini, Solana, Copilot). **Does NOT use Backboard.** Polished Next.js 15 + Framer Motion. Beat them by owning Backboard + out-fitting Auth0's actual agentic story. |
| **EcoTrack AI** (@saras_growth_space) | 🟡 Low | Frontend-only simulation. No real AI. Loses on Technical Execution. |
| **TELMED AI** (@cmarvelous) | 🟡 Low | Off-theme + broken post (Liquid syntax error). |

**Saturation summary:** Backboard empty. Auth0/Snowflake/Solana/Copilot each have 1 strong entry (GheiaGrid). Gemini will surge late. Overall pool likely 50–150 submissions.

---

## 6. Winning Patterns (from prior 3 Community-Edition winners)

Winners: **TerraRun**, **UTMACH Rides**, **BagichaLink**.

| # | Pattern | How Terra Triage satisfies it |
|---|---|---|
| 1 | Built for a **specific, named community** | **Wildlife rehabbers + citizens who find injured animals.** Name a real network in the post (e.g., "built after I found a hawk on my street and had no idea who to call"). |
| 2 | **Real functional product**, not a simulation | Live Gemini vision, live Backboard multi-agent, real email dispatch via Auth0 Token Vault. Seed a JSON registry of real rehabbers in one region. |
| 3 | **One-line pitch** DEV can reprint verbatim | See North Star. Tighten relentlessly. |
| 4 | **Visceral / physical-world** tie | Injured animal. A hawk. An otter. Photo → saved life. Maximum visceral. |
| 5 | **Playful + practical fusion** | "Triage" framing = ER/medical language. Treat the UI like a dispatcher console. Add a ⚠️ severity tag + ETA counter. Practical core with theatrical UX. |

---

## 7. Terra Triage Fit Scorecard

| Pattern | Score | Notes |
|---|:-:|---|
| Named community | ✅ | Rehabbers + finders — frame as "for my neighborhood's wildlife" |
| Functional product | ✅ | Multi-agent pipeline ships end-to-end |
| One-line pitch | ✅ | Craft hour 0; iterate throughout |
| Visceral tie | ✅ | Saving an animal is maximally physical |
| Playful + practical | ⚠️→✅ | **Action required:** add dispatcher-console theatre (severity badges, ETA, "AGENT DISPATCHED" banner) to lock in the playful half |

**Overall: 4.5/5 → 5/5 with dispatcher-console styling.**

---

## 8. Writing Quality Playbook

**The #1 rule:** The sentence a judge could quote is the single most valuable sentence in the post. Write it first. Iterate 5+ times.

**Post structure (use DEV template exactly):**
1. Personal "why" (2 sentences max) — "I found an injured hawk and had no idea who to call."
2. **Hero image** (dispatcher console screenshot)
3. The one-liner pitch
4. 60–90s **screen recording** demo (photo upload → ID → dispatch → confirmation)
5. **Architecture diagram** (3 agents + Backboard memory + Auth0 layer)
6. 2–3 juicy code embeds (Backboard multi-agent orchestration, Auth0 Token Vault call, Gemini severity prompt)
7. **Explicit prize-category justifications** — separate short sections:
   - "Why this is best-in-class Backboard use" (multi-agent portable memory is the protagonist)
   - "Why this is best-in-class Auth0-for-Agents use" (M2M between agents + Token Vault acting on user's behalf)
8. "What's next" (3 bullets — multi-region rehabber registry, SMS via Twilio, insurance-grade case export)

**Reaction-maximizing moves (tiebreak):**
- Post at high-traffic window (Mon/Tue AM US East)
- Share in the DEV launch post comments
- Cross-post to r/wildliferehab, bird-watching Twitter, local rehabber networks
- Ask 5 friends to leave a substantive comment (algorithm loves depth)

---

## 9. Do-NOT-Do List

- ❌ **Simulation / mocked AI** (EcoTrack's mistake — kills Technical Execution)
- ❌ **Generic "AI for good" framing** — too abstract, no community
- ❌ **Another carbon dashboard** — saturated category
- ❌ **Copy GheiaGrid's IoT+Solana angle** — they own it mathematically
- ❌ **Leading with Gemini** — saturation surge incoming
- ❌ **Skipping the demo video** — 60–90s recording is table-stakes
- ❌ **Generic stock hero image** — judges scroll fast; make it a real screenshot
- ❌ **Missing DEV template headers** — auto-DQ risk
- ❌ **Vague prize-category justification** — explicitly state why your Backboard/Auth0 use is best

---

## 10. Risk Register

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Backboard API quirks eat hours 0–6** | Start with their quickstart in hour 1. Have OpenAI+pgvector fallback ready but never ship it — Backboard MUST remain the protagonist. |
| 2 | **Multi-agent orchestration over-scoped for 48h** | Ship 3 agents minimum (Identifier · Locator · Scribe). Cut the Auth0 Token Vault email send if time-starved — keep Auth0 M2M between agents as the category hook. Never cut the demo video. |
| 3 | **No real rehabber registry → feels fake** | Seed 10–20 real rehabbers from one US state (e.g., California DFW public list). Screenshot the registry in the post. Mention "expanding to [regions]" in "What's next". |

---

## 11. Submission Deliverables

- [ ] **DEV post** following exact template; title contains the one-liner pitch
- [ ] **GitHub repo** (public) — clear README, setup instructions, `.env.example`
- [ ] **60–90s demo video** (Loom or YouTube unlisted) — photo → dispatch shown live
- [ ] **Hero image** — dispatcher console screenshot
- [ ] **Architecture diagram** — embedded in post
- [ ] **Tags**: `#weekendchallenge` + `#backboard` + `#auth0` + `#earthday` + `#webdev`
- [ ] **Prize-category justifications** as explicit post subsections
- [ ] **Live deployed URL** (Vercel / Cloud Run) tested on mobile
- [ ] **Published before 2026-04-20 06:59 UTC** — buffer 2h

---

## Sources

- Challenge page: https://dev.to/challenges/weekend-2026-04-16
- Launch post: https://dev.to/devteam/join-our-dev-weekend-challenge-1000-in-prizes-across-ten-winners-submissions-due-april-20-at-47i1
- Prior winners announcement: https://dev.to/devteam/congrats-to-the-winners-of-our-first-dev-weekend-challenge-1gml
- GheiaGrid (main competitor): https://dev.to/kheai/gheiagrid-reimagining-decentralized-urban-farming-carbon-mining-934
- Backboard: https://backboard.io/
- Auth0 for AI Agents: https://auth0.com/ai/docs
- Google Gemini: https://ai.google.dev/gemini-api/docs
