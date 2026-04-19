import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { checkAdminBasicAuth } from "@/lib/auth/admin-basic-auth";
import { getAuth0 } from "@/lib/auth/client";

export async function middleware(req: NextRequest) {
  // Admin ops panel + demo inbox: basic auth, independent of Auth0.
  if (
    req.nextUrl.pathname.startsWith("/admin") ||
    req.nextUrl.pathname.startsWith("/demo/inbox")
  ) {
    const blocked = checkAdminBasicAuth(req);
    if (blocked) return blocked;
    return NextResponse.next();
  }

  const a = getAuth0();
  if (!a) return NextResponse.next();
  // Auth0 middleware owns /api/auth/* (login, logout, callback, profile,
  // access-token) and also performs silent session refresh on other paths.
  return a.middleware(req);
}

export const config = {
  matcher: [
    // Run on everything except Next internals + static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml)$).*)",
  ],
};
