import "server-only";

import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Lazy, env-guarded Auth0 v4 client. Build never requires Auth0 env vars;
 * any auth-gated code path MUST call `getAuth0()` and handle `null`.
 *
 * Routes are mounted at `/api/auth/*` (instead of the default `/auth/*`) so
 * the UI can link to `/api/auth/login?returnTo=...` — matches the legacy
 * Auth0-Next.js URL shape and keeps things tidy under `/api`.
 */

const REQUIRED = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
] as const;

let cached: Auth0Client | null | undefined;

export function auth0Configured(): boolean {
  return REQUIRED.every((k) => {
    const v = process.env[k];
    return typeof v === "string" && v.length > 0;
  });
}

export function getAuth0(): Auth0Client | null {
  if (cached !== undefined) return cached;
  if (!auth0Configured()) {
    cached = null;
    return null;
  }
  const appBaseUrl =
    process.env.APP_BASE_URL ??
    process.env.AUTH0_BASE_URL ??
    "http://localhost:3000";

  cached = new Auth0Client({
    domain: process.env.AUTH0_DOMAIN!,
    clientId: process.env.AUTH0_CLIENT_ID!,
    clientSecret: process.env.AUTH0_CLIENT_SECRET!,
    secret: process.env.AUTH0_SECRET!,
    appBaseUrl,
    // PAR exercises the Auth0-for-Agents primitive we narrate in the demo.
    pushedAuthorizationRequests: true,
    authorizationParameters: {
      scope: "openid profile email offline_access",
      audience: process.env.AUTH0_AGENT_AUDIENCE ?? undefined,
    },
    routes: {
      login: "/api/auth/login",
      callback: "/api/auth/callback",
      logout: "/api/auth/logout",
    },
  });
  return cached;
}

/**
 * App-Router safe session accessor. Returns null if Auth0 isn't configured
 * or the user isn't signed in.
 */
export async function getSession() {
  const a = getAuth0();
  if (!a) return null;
  try {
    return await a.getSession();
  } catch {
    return null;
  }
}

export interface AgentTokenRequest {
  scope?: string;
  consentContext?: string;
}

/**
 * Fetch a user-consented scoped agent access token. Uses Auth0 PAR under the
 * hood (`pushedAuthorizationRequests: true` on the client). Returns null if:
 *  - Auth0 isn't configured,
 *  - the user has no session,
 *  - or the token exchange fails (caller should fall back to M2M).
 *
 * NOTE: token refresh relies on the caller having an existing session that
 * was originally obtained with the `referral:send` scope + agent audience.
 * The consent UX lives at `/api/auth/login?consent=referral:send`.
 */
export async function getAccessTokenForAgent({
  scope = "referral:send",
}: AgentTokenRequest = {}): Promise<{
  token: string;
  scope?: string;
  expiresAt: number;
} | null> {
  const a = getAuth0();
  if (!a) return null;
  const audience = process.env.AUTH0_AGENT_AUDIENCE;
  if (!audience) return null;
  try {
    const tok = await a.getAccessToken();
    // SDK returns the cached session token; ensure scope contains what we need.
    if (tok.scope && !tok.scope.split(/\s+/).includes(scope)) {
      return null;
    }
    return { token: tok.token, scope: tok.scope, expiresAt: tok.expiresAt };
  } catch {
    return null;
  }
}
