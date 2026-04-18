import { NextResponse, type NextRequest } from "next/server";

import { getAuth0 } from "@/lib/auth/client";

export async function GET(req: NextRequest) {
  const a = getAuth0();
  if (!a) {
    return NextResponse.json(
      { error: "auth_not_configured" },
      { status: 503 },
    );
  }
  const audience = process.env.AUTH0_AGENT_AUDIENCE;
  if (!audience) {
    return NextResponse.json(
      { error: "missing_agent_audience" },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/";
  const ctx = url.searchParams.get("ctx") ?? undefined;

  return a.startInteractiveLogin({
    returnTo,
    authorizationParameters: {
      scope: "openid profile email offline_access referral:send",
      audience,
      prompt: "consent",
      ...(ctx ? { consent_context: ctx } : {}),
    },
  });
}
