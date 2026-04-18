import { NextResponse, type NextRequest } from "next/server";

import { getAuth0 } from "@/lib/auth/client";

async function handle(req: NextRequest) {
  const a = getAuth0();
  if (!a) {
    return NextResponse.json(
      { error: "auth_not_configured" },
      { status: 503 },
    );
  }
  return a.middleware(req);
}

export const GET = handle;
export const POST = handle;
