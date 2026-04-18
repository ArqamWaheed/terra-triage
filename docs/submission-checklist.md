# Submission Checklist

Mirrors PRD §13. Technical deliverables are complete; submission artifacts are drafted and awaiting the operator's recording/publishing pass.

## Technical

- [x] Public GitHub repo with MIT licence (`LICENSE`)
- [x] README (problem, stack, agent diagram, local setup, env vars) — `README.md`
- [x] Architecture diagram — `docs/architecture.md` (Mermaid + ASCII)
- [x] All 10 MVP features from PRD §6.1 shipped & build-green
- [x] `.env.example` documents every required secret
- [x] PWA manifest + icons — `public/manifest.webmanifest`, `public/icons/icon-{192,512}.png`
- [x] Ops playbook — `README-ops.md`
- [x] DB/migrations notes — `README-db.md`

## Submission artifacts (operator action required)

- [ ] **Pinned one-line pitch** at top of DEV post + repo README — verify the PRD §top pitch matches verbatim
- [ ] **Hero image** — capture `/admin/cases` detail view with before/after panel → save as `docs/hero.png`, then `docs/architecture.png` for the Mermaid export
- [ ] **Screenshots** — triage card, map view, Auth0 consent modal, intake email in rehabber's inbox
- [ ] **60–120s demo video** — record per `docs/demo-script.md`; upload as unlisted YouTube or Loom; update `{% embed %}` URL in `docs/dev-post-draft.md`
- [ ] **DEV.to post** — publish `docs/dev-post-draft.md`; add `backboard` + `auth0` tags in the DEV tag picker (frontmatter already contains the four-tag max: `#devchallenge`, `#earthdaychallenge`, `#ai`, `#nextjs`)
- [ ] **Live URL** — deploy to `terra-triage.vercel.app` (or similar) with seeded demo data
- [ ] Seed two rehabbers within 25km of the demo photo's coordinates (demo-script pre-flight)

## Tenant provisioning (operator action required)

- [ ] Supabase project created, migrations applied, `photos` bucket private, RLS verified
- [ ] Auth0 tenant — AI Agents preview enabled, PAR turned on, `referral:send` scope defined, application registered per `src/lib/auth/README.md`
- [ ] Backboard account — API key in env, `terra-triage/rehabbers` namespace verified (techdesign §17 Q2)
- [ ] Resend — domain verified OR accept `onboarding@resend.dev` for demo (100/day)
- [ ] Gmail SMTP fallback — app password generated for 429/5xx escalation
- [ ] `MAGIC_LINK_SECRET` + `ADMIN_BASIC_AUTH` set in Vercel prod env

## Prize-category justification

- [x] Backboard — memory-is-protagonist proof path (`/admin/cases` before/after)
- [x] Auth0 for AI Agents — PAR + scoped token + user-consented mode badge
- [x] Explicit prize sections drafted in `docs/dev-post-draft.md` and `README.md`

## Publish

- [ ] Publish DEV post by **T-2h (2026-04-20 04:59 UTC)** per techdesign §15 block O
- [ ] Cross-post to r/wildliferehab and relevant communities (research §8)
- [ ] Share live URL + repo in the DEV launch post comments
