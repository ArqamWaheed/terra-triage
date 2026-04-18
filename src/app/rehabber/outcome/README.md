# Rehabber outcome magic-link flow

## Overview

When the Dispatcher (Phase 6) sends a referral email, it mints a per-referral
magic token and stores only its hash in `referrals.magic_token_hash`. The
rehabber clicks **Accept** or **Decline** in the email, lands here, reviews the
case, and submits an outcome. The outcome is written once, signals flow to
Backboard / the local mirror via `getMemory().upsert`, and the ranker adapts
for future cases (Phase 7 demo moment).

## Files

- `[token]/page.tsx` — loads the referral, verifies the token, shows the case +
  form (or a read-only confirmation if already submitted).
- `[token]/actions.ts` — `submitOutcome` server action: re-verifies, updates
  `referrals` + `cases`, writes memory entries.
- `[token]/outcome-form.tsx` — client radio/notes form using `useActionState`.
- `[token]/confirm/page.tsx` — thank-you page.
- `src/app/api/rehabber/outcome/[token]/route.ts` — compatibility redirect for
  the URL shape embedded in Phase 6 emails (`/api/rehabber/outcome/:token`).

## Token format

Set by `src/lib/agents/dispatcher.ts::makeMagicToken` and mirrored by
`src/lib/auth/magic-link.ts`:

```
payload = `${referralId}.${expMs}`
mac     = hex HMAC-SHA256(MAGIC_LINK_SECRET, payload)
token   = `${payload}.${mac}`
db hash = sha256(token) stored in referrals.magic_token_hash
```

`verifyMagicToken(token, expectedHash)`:

1. Split on `.` — must be 3 parts.
2. Recompute `mac` with the current secret; `timingSafeEqual`.
3. Check `Date.now() <= exp`.
4. `timingSafeEqual(sha256(token), expectedHash)` — defense-in-depth.

## Security

- `MAGIC_LINK_SECRET` is required at runtime (>=16 chars). Build never needs
  it; the verifier only runs on request handlers / server components.
- Timing-safe comparison at both MAC and hash steps.
- The stored hash is `sha256(token)`, so stealing the DB row does not give an
  attacker the secret.
- 72-hour TTL baked into the token; expiry checked even if the hash matches.
- `referrals.magic_token_hash` is indexed (`referrals_magic_hash_idx`) for
  O(log n) lookups when we switch to hash-first lookup; today we decode
  `referralId` from the token and do a primary-key lookup.

## Single-use enforcement

Logic-level, no DB constraint needed:

- The page returns a read-only "already recorded" card if `referral.outcome`
  is non-null.
- The server action UPDATEs with a `.is('outcome', null)` predicate, so a
  concurrent second submission returns `ALREADY_SUBMITTED` and does not mutate
  anything.

## Case-status rule (from `actions.ts::caseStatusFor`)

| outcome     | cases.status becomes |
| ----------- | -------------------- |
| accepted    | `accepted`           |
| declined    | `referred` (no change — other rehabbers can still accept) |
| transferred | `closed`             |
| closed      | `closed`             |

## Regenerating tokens for local testing

The plain token is not stored. To test the page without running the full
dispatcher:

```ts
// scripts/mint-token.ts (not checked in)
import { signMagicToken } from "@/lib/auth/magic-link";
const { token, hash } = signMagicToken(
  "<referral-uuid>",
  Date.now() + 72 * 60 * 60 * 1000,
);
// UPDATE referrals SET magic_token_hash = '<hash>', magic_expires_at = ...
// Visit /rehabber/outcome/<token>
```

Or resend the referral via the dispatcher — it rotates the token/hash each
call.

## Memory side effects (per outcome)

Via `applyOutcomeToSignals` → `getMemory().upsert(rehabberId, entries)`:

- `capacity.remaining` decrements by 1 on `accepted`.
- `accept_rate` updates `n` / `accepted` / `rate` on every outcome.
- `species_scope[<species>]` reinforces +0.1 on accept, −0.05 on decline
  (clamped [0, 1]).
- `response_ms` rolling avg = `Date.now() - referral.sent_at`.
- If the rehabber typed a `species_correction`, it becomes the species we
  reinforce (and on `accepted`, the original species is also reinforced so
  both keys move toward this rehabber).
