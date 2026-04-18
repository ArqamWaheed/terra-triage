# Demo Script — 60–90s screen recording

Target length: **75 seconds**. Hard ceiling: 90s. Stopwatch overlay visible throughout (per techdesign §16 "Relevance / Earth Day" row).

All "before/after" memory shifts must be produced by the operator performing real actions on a running instance during the recording — **no fabricated data**.

---

## 0:00–0:05 — Cold open

**Screen:** Phone mock-up, Terra Triage landing page.
**Narration:** *"Terra Triage. Snap an injured animal — get a rehabber emailed in under 60 seconds."*
**Covers:** PRD §10 North-Star.

## 0:05–0:18 — Finder agent (MVP #2, #3, #4, #5)

**Screen:** Tap **Report an animal** → browser camera → take photo → grant geolocation.
**Narration:** *"The Finder agent — Gemini 2.0-flash, structured JSON — returns species, severity, and a do/don't list in about four seconds."*
**Beats:**
- 0:10 — stopwatch starts.
- 0:13 — triage card appears: species name, severity badge, do/don't columns, canonical "*When in doubt, call — don't carry.*"
**Covers:** PRD §6.1 #4, #5.

## 0:18–0:25 — Ranked rehabbers (MVP #6)

**Screen:** Leaflet map auto-scrolls in, top rehabber pulses, side panel lists top 3 with distance/capacity/species-match chips.
**Narration:** *"Three nearest licensed rehabbers. Ranked by the Memory agent — not by distance alone."*
**Covers:** PRD §6.1 #6.

## 0:25–0:40 — Auth0 consent + Dispatcher (MVP #7, prize moment)

**Screen:** Tap **Send referral** → Auth0 consent modal → approve → spinner → "Referral sent" banner with auth-mode badge reading `user-consented`.
**Narration:** *"The Dispatcher agent has its own Auth0 identity. Scope: `referral:send` only. One tap — the user sees exactly what the agent will do on their behalf, and approves."*
**Beats:**
- 0:28 — consent modal framed; read the consent text aloud.
- 0:35 — auth-mode badge on screen; say the word *"scoped."*
**Covers:** techdesign §16 Auth0 rows, PRD §12.1.

## 0:40–0:55 — Rehabber outcome → Memory shift (MVP #8, #9, #10, prize moment)

**Screen:** Switch to rehabber's inbox → open intake email → click **Decline — at capacity** magic-link → outcome form → submit.
**Narration:** *"The rehabber's magic-link is HMAC-signed, single-use, 72-hour TTL. Their response feeds the Memory agent."*
**Covers:** PRD §6.1 #10, FR-9.

## 0:55–1:10 — Before vs. after (**Backboard prize moment**)

**Screen:** Open `/admin/cases` → expand the original case → side-by-side panel: *Dispatched ranking* (left) vs. *Re-ranked now (memory effect)* (right). Top rehabber on the right has visibly moved from X to Y.
**Narration:** *"Same case, same candidates. The only thing that changed is Backboard memory — capacity, accept-rate, species-scope. The ranking rewrote itself."*
**Covers:** techdesign §16 Backboard row, PRD §12.2, §6.1 #9.

## 1:10–1:15 — Close

**Screen:** Logo + live URL + GitHub link.
**Narration:** *"Terra Triage. Open source, zero paid services, under ninety seconds from photo to help."*
**Covers:** PRD §10 Technical-execution row.

---

## Operator pre-flight

- [ ] Live URL warm; demo finder account logged out (to showcase consent flow fresh).
- [ ] Second browser profile logged into the rehabber inbox.
- [ ] `/admin/cases` open in a third tab.
- [ ] OBS scene — browser capture + phone mirror + stopwatch widget.
- [ ] Seed dataset includes two rehabbers within 25km of the demo photo's coordinates so rank shift is visible.
- [ ] Submit **one prior case + decline** before hitting record, so the "after" panel has real history (**not fabricated** — these are genuine memory writes).
