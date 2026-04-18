---
title: "Terra Triage — a 3-agent wildlife dispatcher you can run on $0 of free tier"
published: false
description: "Snap an injured animal. A multi-agent dispatcher IDs the species, grades the injury, and pages the nearest licensed rehabber on your behalf — in under 60 seconds."
tags: devchallenge, earthdaychallenge, ai, nextjs
cover_image:
canonical_url:
series: DEV Earth Day Challenge 2026
---

<!-- Required additional tags (DEV allows 4 in-frontmatter; add these in the UI tag picker): backboard, auth0 -->

## Why I built this

Last spring I found a stunned songbird on the sidewalk and spent forty minutes cold-calling vets who don't take wildlife. By the time I reached a rehabber, the bird was already gone. Terra Triage is the app I wished existed that afternoon.

![Terra Triage dispatcher console](https://raw.githubusercontent.com/ArqamWaheed/terra-triage/main/docs/hero.png)

> **Snap an injured animal. A multi-agent dispatcher IDs the species, grades the injury, and pages the nearest licensed rehabber on your behalf — in under 60 seconds.**

## 60-second demo

{% embed https://youtu.be/REPLACE_ME_UNLISTED %}

(Unlisted YouTube; full recording script in [`docs/demo-script.md`](https://github.com/ArqamWaheed/terra-triage/blob/main/docs/demo-script.md).)

## Architecture

Three agents cooperating through Supabase state, each with exactly one job.

![Architecture](https://raw.githubusercontent.com/ArqamWaheed/terra-triage/main/docs/architecture.png)

- **Finder** — Gemini 2.0-flash with a structured-JSON schema, one retry at temp 0, text-only fallback. Never lies: if confidence < 0.35 the card renders "Unknown animal" and still returns the canonical safety line "*When in doubt, call — don't carry.*"
- **Dispatcher** — Auth0-authenticated, scoped to `referral:send` only. Sends a Resend email with an inline signed-URL photo and an HMAC-signed magic-link for the rehabber.
- **Memory** — Backboard-backed signal store. Every outcome event reshapes the next ranking.

Full Mermaid diagram: [`docs/architecture.md`](https://github.com/ArqamWaheed/terra-triage/blob/main/docs/architecture.md).

## Code — the three moments that matter

### 1. Backboard memory query on every rank

```ts
// src/lib/agents/rank-with-memory.ts
export async function rankRehabbersWithMemory(
  input: CaseInput,
  rehabbers: PublicRehabber[],
): Promise<RankedRehabber[]> {
  const signals = await getMemory().query(rehabbers.map((r) => r.id));
  return rankRehabbers(input, rehabbers, signals);
}
```

The ranking function itself is a pure weighted scorer — species match (0.35), distance (0.25), capacity (0.20), accept rate (0.15), response time (0.05) — but **every weight except distance is sourced from Backboard**. No memory, no ranking.

### 2. Auth0 PAR + scoped token exchange

```ts
// src/lib/auth/agent-token.ts — excerpt
export async function getAgentToken(ctx: AgentTokenContext): Promise<AgentToken> {
  const session = await getSession();
  if (session?.tokenSet?.scope?.split(" ").includes("referral:send")) {
    return {
      token: session.tokenSet.accessToken,
      mode: "user-consented",
      scope: "referral:send",
      expiresAt: session.tokenSet.expiresAt,
    };
  }
  // M2M fallback — still scoped, still audited, still narratable in demo.
  return mintM2MToken({ audience: env.AUTH0_AGENT_AUDIENCE, scope: "referral:send" });
}
```

PAR is set with `pushedAuthorizationRequests: true` on the `Auth0Client`, so the browser only ever sees a `request_uri` handle. Consent context travels in a custom `consent_context` query param so the Auth0 consent screen can say *"email Marcus at Hudson Valley Raptors on your behalf"* verbatim.

### 3. Gemini structured-JSON triage

```ts
// src/lib/agents/finder.ts — excerpt
const result = await client.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: TRIAGE_SCHEMA,  // species, confidence, severity(1..5), safety_advice, should_touch
    temperature: 0.2,
  },
}).generateContent([{ inlineData: { data: resized.toString("base64"), mimeType: "image/jpeg" } }, PROMPT]);
```

Photos are pre-resized to ≤768px JPEG via `sharp` before the vision call — the hash of the resized bytes is the cache key in `triage_cache`, so hitting refresh on the demo costs $0.

## Why this is best-in-class Backboard use

Memory is the **protagonist**, not a log sink.

- Rehabber ranking is never `ORDER BY distance` — every call goes through `rankRehabbersWithMemory`, which reads five memory keys per rehabber.
- The outcome reducer `applyOutcomeToSignals` mutates `accept_rate`, `capacity`, `species_scope`, `response_ms`, and `geo_accuracy` in a pure function so the memory write is auditable.
- `/admin/cases` renders the same dataset twice: the `rank_explain` JSON that was pinned at dispatch time vs. a fresh `rankRehabbersWithMemory(...)` call right now. You can **see** Backboard changing the world.
- A `FallbackMemory` proxy (Backboard-primary, local JSONB fallback) means the demo survives a tenant outage — every Backboard upsert is mirrored to `memory_entries` with `source='backboard' | 'local_fallback'`.

## Why this is best-in-class Auth0-for-Agents use

The Dispatcher is a **first-class OAuth client**, not a hard-coded cron job.

- PAR is on. The user-facing consent modal is human-readable and action-specific.
- Scope is `referral:send` — the Dispatcher cannot read other cases, cannot send anything other than an intake email.
- `getAgentToken` returns `{token, mode}` where `mode ∈ {user-consented, m2m-fallback}`. The UI renders an **auth-mode badge** so the demo narrator can literally point at it: *"this referral was sent under the user's token, not a service account."*
- The Dispatcher throws `AUTH_SCOPE_MISSING` if the scope isn't present — there is no "safe default" that silently downgrades.

## What's next

- Multi-region rehabber registry (currently 15 US-curated rows; want public DNR lists ingested).
- SMS fallback via a free Supabase edge function + rehabber email-to-SMS gateways.
- Insurance-grade PDF case export for the accepting rehabber (species, severity, chain-of-custody timestamps).

## Try it

- **Live URL:** https://terra-triage.vercel.app (seeded demo data)
- **Repo:** https://github.com/ArqamWaheed/terra-triage — MIT, full ops playbook in `README-ops.md`.
- **Stack:** Next.js 16, Supabase, Gemini 2.0-flash, Auth0 for AI Agents, Backboard, Resend, Leaflet, Tailwind v4, shadcn.

Built solo for the DEV Earth Day Challenge 2026. Co-authored with GitHub Copilot CLI.

---

*Tags: #devchallenge #earthdaychallenge #ai #nextjs #backboard #auth0*
