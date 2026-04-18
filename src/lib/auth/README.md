# `src/lib/auth` — Auth0 for AI Agents wiring

Terra Triage exercises **Auth0 for AI Agents** as the consent + scoped-token
layer for the Dispatcher agent. This doc is the operator's quick reference.

## Two modes

1. **User-consented (preferred).**
   User clicks *Send referral* → Next.js hits `/api/auth/consent` → Auth0
   PAR (**P**ushed **A**uthorization **R**equest) flow redirects to the
   consent screen requesting `scope=referral:send` +
   `audience=$AUTH0_AGENT_AUDIENCE`. On approval the session's access token
   carries the scope, and `Auth0Client.getAccessToken()` returns it for the
   dispatcher. Each dispatch is a discrete action the user approved.

2. **M2M fallback.** If the tenant doesn't have the AI-Agents preview
   primitives enabled, the dispatcher falls back to a `client_credentials`
   grant on `/oauth/token` with the same `audience` and `referral:send`
   scope. Server logs print `[dispatcher] auth mode: m2m-fallback`. The
   button surface also shows an *M2M fallback* badge so demos stay honest.

The active mode is returned from the server action and rendered on the
*Send referral* button as a small badge.

## Configuring the tenant

In Auth0:

1. **Application → `terra-triage-dispatcher`** (type: *Regular Web
   Application* or *AI Agent* if the preview is available in your tenant).
   - Callback URL: `${APP_BASE_URL}/api/auth/callback`
   - Logout URL: `${APP_BASE_URL}`
   - Login URL: `${APP_BASE_URL}/api/auth/login`
   - Grant types: Authorization Code + Refresh Token (+ Client Credentials
     for M2M).
   - **Turn on PAR** under *Advanced → OAuth → Pushed Authorization
     Requests* (the SDK also sends `pushedAuthorizationRequests: true`).
2. **API → `https://api.terra-triage/agents`** (used as
   `AUTH0_AGENT_AUDIENCE`). Add scope `referral:send`.
3. **(Optional) M2M application** authorised against the same API with
   `referral:send`. Put the client id/secret in `AUTH0_M2M_CLIENT_ID` /
   `AUTH0_M2M_CLIENT_SECRET`. If unset, the dispatcher reuses the main
   app's client id/secret (many tenants allow this).

## Env vars

See [`.env.example`](../../../.env.example) for the full list. The
dispatcher requires `AUTH0_AGENT_AUDIENCE` and `MAGIC_LINK_SECRET`;
everything else degrades gracefully.

## Route table

| Path                           | Owner       | Purpose                                              |
| ------------------------------ | ----------- | ---------------------------------------------------- |
| `/api/auth/login`              | Auth0 SDK   | Default login (no custom scope)                      |
| `/api/auth/logout`             | Auth0 SDK   | End session                                          |
| `/api/auth/callback`           | Auth0 SDK   | PAR / authorization_code callback                    |
| `/api/auth/profile`            | Auth0 SDK   | JSON user profile                                    |
| `/api/auth/access-token`       | Auth0 SDK   | JSON access token (for client demos; do not ship)    |
| `/api/auth/consent`            | this repo   | Re-prompts for `referral:send` with `prompt=consent` |

## Files

| File              | Role                                                      |
| ----------------- | --------------------------------------------------------- |
| `client.ts`       | Lazy Auth0 v4 `Auth0Client` + `getSession` + token helper |
| `agent-token.ts`  | `getAgentToken()` — user-consented → M2M fallback         |
