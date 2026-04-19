import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAuth0 } from "@/lib/auth/client";

const BASIC_REALM = 'Basic realm="admin", charset="UTF-8"';

function checkAdminBasicAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_BASIC_AUTH;
  if (!expected) {
    // No credentials configured — lock the admin panel shut rather than
    // expose it. Returns 503 so it is obvious in ops.
    return new NextResponse("Admin panel not configured", {
      status: 503,
    });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("basic ")) {
    return new NextResponse("Auth required", {
      status: 401,
      headers: { "WWW-Authenticate": BASIC_REALM },
    });
  }
  let decoded = "";
  try {
    decoded = Buffer.from(auth.slice(6).trim(), "base64").toString("utf8");
  } catch {
    decoded = "";
  }
  const a = Buffer.from(decoded, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new NextResponse("Forbidden", {
      status: 401,
      headers: { "WWW-Authenticate": BASIC_REALM },
    });
  }
  return null;
}

export async function middleware(req: NextRequest) {
  // Admin ops panel: basic auth, independent of Auth0. Composes by short-
  // circuiting before the Auth0 middleware runs.
  if (req.nextUrl.pathname.startsWith("/admin")) {
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
