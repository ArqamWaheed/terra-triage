# README-ops.md — secrets map

Every env var used at runtime, where it's read, and what breaks if it's
missing. See [`.env.example`](./.env.example) for the full template.

| Var                         | Used in                                                                                | Required? | Failure mode when missing                              |
| --------------------------- | -------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------ |
| `GROQ_API_KEY`              | `src/lib/agents/finder.ts`                                                             | required  | Finder cannot identify species; throws TriageError.    |
| `BACKBOARD_API_KEY`         | `src/lib/memory/backboard.ts` (via `src/lib/memory/index.ts`)                          | optional  | Memory backend switches to local JSONB fallback.       |
| `BACKBOARD_ASSISTANT_ID`    | `src/lib/memory/backboard.ts` (via `src/lib/memory/index.ts`)                          | optional  | Assistant resolved by name on first call (extra hop).  |
| `AUTH0_DOMAIN`              | `src/lib/auth/client.ts`, `src/lib/auth/agent-token.ts`                                | runtime   | Auth0 disabled; *Send referral* button hidden / 503.   |
| `AUTH0_CLIENT_ID`           | `src/lib/auth/client.ts`                                                               | runtime   | same as above                                          |
| `AUTH0_CLIENT_SECRET`       | `src/lib/auth/client.ts`                                                               | runtime   | same as above                                          |
| `AUTH0_SECRET`              | `src/lib/auth/client.ts` — cookie encryption key (32-byte hex)                         | runtime   | Auth0 client init throws; middleware no-op in prod.    |
| `AUTH0_BASE_URL`            | `src/lib/auth/client.ts`                                                               | runtime   | Defaults to `http://localhost:3000`.                   |
| `APP_BASE_URL`              | `src/lib/auth/client.ts`, `src/lib/agents/dispatcher.ts` (magic-link URLs)             | runtime   | Defaults to `AUTH0_BASE_URL`.                          |
| `AUTH0_AGENT_AUDIENCE`      | `src/lib/auth/client.ts`, `src/lib/auth/agent-token.ts`                                | runtime   | Dispatcher errors `AUTH_SCOPE_MISSING`.                |
| `AUTH0_M2M_CLIENT_ID`       | `src/lib/auth/agent-token.ts` — M2M fallback                                           | optional  | Reuses `AUTH0_CLIENT_ID`.                              |
| `AUTH0_M2M_CLIENT_SECRET`   | `src/lib/auth/agent-token.ts`                                                          | optional  | Reuses `AUTH0_CLIENT_SECRET`.                          |
| `SUPABASE_URL`              | `src/lib/db/supabase.ts`                                                               | runtime   | All server DB / storage calls throw.                   |
| `SUPABASE_SERVICE_ROLE`     | `src/lib/db/supabase.ts`                                                               | runtime   | same as above                                          |
| `NEXT_PUBLIC_SUPABASE_URL`  | `src/lib/db/supabase.ts`                                                               | runtime   | Anon-client calls throw.                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/db/supabase.ts`                                                           | runtime   | same as above                                          |
| `RESEND_API_KEY`            | `src/lib/agents/dispatcher.ts`                                                         | optional  | Dispatcher falls straight through to Gmail SMTP.       |
| `RESEND_FROM`               | `src/lib/agents/dispatcher.ts`                                                         | optional  | Defaults to `onboarding@resend.dev`.                   |
| `GMAIL_SMTP_USER`           | `src/lib/email/gmail-smtp.ts`                                                          | optional  | No SMTP fallback; Resend failure becomes hard error.   |
| `GMAIL_SMTP_APP_PASSWORD`   | `src/lib/email/gmail-smtp.ts`                                                          | optional  | same as above                                          |
| `MAGIC_LINK_SECRET`         | `src/lib/agents/dispatcher.ts` — HMAC for outcome magic-links                          | **required at dispatch time** | Dispatch fails fast with `MISSING_MAGIC_SECRET`.       |
| `ADMIN_BASIC_AUTH`          | *Phase 8* `/admin`                                                                     | optional  | Admin board 401s.                                      |

## Build vs runtime

`pnpm build` does **not** require any of these. Every module reads env
vars lazily and guards for absence. CI has zero secrets configured.
