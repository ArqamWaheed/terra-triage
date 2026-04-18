import "server-only";

import { getAccessTokenForAgent } from "@/lib/auth/client";

export type AgentAuthMode = "user-consented" | "m2m-fallback";

export interface AgentTokenResult {
  token: string;
  mode: AgentAuthMode;
  scope: string;
  expiresAt: number;
}

export interface GetAgentTokenInput {
  caseId: string;
  rehabberId: string;
  userSub?: string;
}

const M2M_SCOPE = "referral:send";
// Cache M2M tokens in-process (stateless serverless instances will just
// re-mint per cold start — still well within free-tier quotas).
let m2mCache: { token: string; scope: string; expiresAt: number } | null = null;

async function mintM2MToken(): Promise<AgentTokenResult | null> {
  const domain = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AGENT_AUDIENCE;
  const clientId =
    process.env.AUTH0_M2M_CLIENT_ID ?? process.env.AUTH0_CLIENT_ID;
  const clientSecret =
    process.env.AUTH0_M2M_CLIENT_SECRET ?? process.env.AUTH0_CLIENT_SECRET;

  if (!domain || !audience || !clientId || !clientSecret) return null;

  if (m2mCache && m2mCache.expiresAt - Date.now() / 1000 > 30) {
    return {
      token: m2mCache.token,
      mode: "m2m-fallback",
      scope: m2mCache.scope,
      expiresAt: m2mCache.expiresAt,
    };
  }

  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience,
      scope: M2M_SCOPE,
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    access_token?: string;
    scope?: string;
    expires_in?: number;
  };
  if (!json.access_token) return null;

  const expiresAt = Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600);
  const scope = json.scope ?? M2M_SCOPE;
  m2mCache = { token: json.access_token, scope, expiresAt };
  return { token: json.access_token, mode: "m2m-fallback", scope, expiresAt };
}

/**
 * Single source of truth for the dispatcher agent token. Prefers the
 * user-consented PAR flow (Auth0 for AI Agents primitive); falls back to a
 * client_credentials token with the same scoped audience if the session
 * token doesn't carry `referral:send` (e.g. tenant lacks AI-Agents preview
 * primitives — see techdesign §8 final note).
 */
export async function getAgentToken(
  input: GetAgentTokenInput,
): Promise<AgentTokenResult | null> {
  const consentContext =
    `Email referral for case=${input.caseId} ` +
    `→ rehabber=${input.rehabberId}` +
    (input.userSub ? ` on-behalf-of user=${input.userSub}` : "");

  const user = await getAccessTokenForAgent({
    scope: "referral:send",
    consentContext,
  });
  if (user?.token) {
    console.info("[dispatcher] auth mode: user-consented");
    return {
      token: user.token,
      mode: "user-consented",
      scope: user.scope ?? "referral:send",
      expiresAt: user.expiresAt,
    };
  }
  const m2m = await mintM2MToken();
  if (m2m) {
    console.info("[dispatcher] auth mode: m2m-fallback");
  }
  return m2m;
}
