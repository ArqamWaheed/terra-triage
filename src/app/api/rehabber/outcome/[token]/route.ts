import { NextResponse, type NextRequest } from "next/server";

/**
 * Phase 6 emails link to `/api/rehabber/outcome/${token}?o=accepted|declined`.
 * Phase 8 owns the interactive outcome flow at `/rehabber/outcome/[token]`.
 * This handler preserves the Phase 6 email URL shape by redirecting into the
 * page route, carrying the `?o=` hint as a pre-selected outcome.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const o = req.nextUrl.searchParams.get("o");
  const url = new URL(`/rehabber/outcome/${token}`, req.nextUrl.origin);
  if (o) url.searchParams.set("o", o);
  return NextResponse.redirect(url, 303);
}
