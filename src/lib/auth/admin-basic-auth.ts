import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const BASIC_REALM = 'Basic realm="admin", charset="UTF-8"';

// Edge-runtime safe constant-time comparison. `node:crypto` is unavailable in
// the Next.js middleware edge runtime, so we implement it in pure JS.
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

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
    decoded = atob(auth.slice(6).trim());
  } catch {
    decoded = "";
  }
  if (!timingSafeEqualStr(decoded, expected)) {
    return new NextResponse("Forbidden", {
      status: 401,
      headers: { "WWW-Authenticate": BASIC_REALM },
    });
  }
  return null;
}
