import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const BASIC_REALM = 'Basic realm="admin", charset="UTF-8"';

/**
 * Enforce the shared `ADMIN_BASIC_AUTH` credential on admin surfaces.
 * Returns a NextResponse when the request must be rejected, or null on success.
 * Used by both the edge middleware (for `/admin/*` pages) and by individual
 * route handlers under `/api/admin/*` which the middleware matcher does NOT
 * cover.
 */
export function checkAdminBasicAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_BASIC_AUTH;
  if (!expected) {
    return new NextResponse("Admin panel not configured", { status: 503 });
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
