import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";

import { Resend } from "resend";

import { getAgentToken, type AgentAuthMode } from "@/lib/auth/agent-token";
import { getServiceSupabase } from "@/lib/db/supabase";
import { getRehabberPrivate } from "@/lib/db/rehabbers";
import { sendViaGmail } from "@/lib/email/gmail-smtp";
import { renderReferralEmail } from "@/lib/email/template";
import type { Case } from "@/lib/db/types";

export type DispatcherErrorCode =
  | "AUTH_SCOPE_MISSING"
  | "EMAIL_SEND_FAILED"
  | "CASE_INVALID_STATE"
  | "CASE_NOT_FOUND"
  | "REHABBER_NOT_FOUND"
  | "RATE_LIMITED"
  | "MISSING_MAGIC_SECRET";

export class DispatcherError extends Error {
  readonly code: DispatcherErrorCode;
  constructor(code: DispatcherErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DispatcherError";
  }
}

export interface DispatchReferralInput {
  caseId: string;
  rehabberId: string;
  userSub?: string;
  rankExplain?: Record<string, unknown> | null;
  rankScore?: number;
}

export interface DispatchReferralResult {
  referralId: string;
  emailProviderId: string;
  mode: AgentAuthMode;
  transport: "resend" | "gmail-smtp";
}

// ---------------------------------------------------------------------------
// Rate limiting — 20 dispatches per userSub per UTC day. Module-level LRU.
// ---------------------------------------------------------------------------
const DAILY_LIMIT = 20;
const rateLimitBucket = new Map<string, number>();
// Simple LRU cap; prevents unbounded growth across long-running processes.
const MAX_KEYS = 5000;

function rateKey(userSub: string | undefined): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  return `${userSub ?? "anon"}:${ymd}`;
}

function checkAndBumpRate(userSub: string | undefined): void {
  const key = rateKey(userSub);
  const cur = rateLimitBucket.get(key) ?? 0;
  if (cur >= DAILY_LIMIT) {
    throw new DispatcherError(
      "RATE_LIMITED",
      `Daily dispatch cap (${DAILY_LIMIT}) reached`,
    );
  }
  rateLimitBucket.set(key, cur + 1);
  if (rateLimitBucket.size > MAX_KEYS) {
    // Drop oldest-inserted entries.
    const over = rateLimitBucket.size - MAX_KEYS;
    let dropped = 0;
    for (const k of rateLimitBucket.keys()) {
      if (dropped++ >= over) break;
      rateLimitBucket.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Magic token — HMAC-SHA256(`${referralId}.${exp}`, MAGIC_LINK_SECRET).
// Store sha256(raw) in DB; raw token travels in the URL and is verified by
// Phase 8's outcome route using the same HMAC derivation.
// ---------------------------------------------------------------------------
function requireMagicSecret(): string {
  const s = process.env.MAGIC_LINK_SECRET;
  if (!s || s.length < 16) {
    throw new DispatcherError(
      "MISSING_MAGIC_SECRET",
      "MAGIC_LINK_SECRET is required (>=16 chars) to dispatch referrals",
    );
  }
  return s;
}

function makeMagicToken(
  referralId: string,
  expMs: number,
): { raw: string; hash: string } {
  const secret = requireMagicSecret();
  const payload = `${referralId}.${expMs}`;
  const mac = createHmac("sha256", secret).update(payload).digest("hex");
  const raw = `${payload}.${mac}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

// ---------------------------------------------------------------------------
// Resend + Gmail-SMTP escalation
// ---------------------------------------------------------------------------
const RESEND_RETRYABLE = new Set([429, 500, 502, 503, 504]);

function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ??
    process.env.AUTH0_BASE_URL ??
    "http://localhost:3000"
  );
}

async function sendEmail(params: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ messageId: string; transport: "resend" | "gmail-smtp" }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const res = await resend.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (!res.error && res.data?.id) {
      return { messageId: res.data.id, transport: "resend" };
    }
    // Resend v6 returns { name, message, statusCode } on error.
    const status =
      (res.error as { statusCode?: number } | null)?.statusCode ?? 0;
    if (!RESEND_RETRYABLE.has(status)) {
      throw new DispatcherError(
        "EMAIL_SEND_FAILED",
        `Resend error: ${res.error?.message ?? "unknown"}`,
      );
    }
    // fallthrough to Gmail SMTP
  }
  try {
    const info = await sendViaGmail(params);
    return { messageId: info.messageId, transport: "gmail-smtp" };
  } catch (err) {
    throw new DispatcherError(
      "EMAIL_SEND_FAILED",
      `All email transports failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------
export async function dispatchReferral(
  input: DispatchReferralInput,
): Promise<DispatchReferralResult> {
  // 0. Env guard — fail fast, never log the secret.
  requireMagicSecret();
  checkAndBumpRate(input.userSub);

  const sb = getServiceSupabase();

  // 1. Load + validate case.
  const { data: caseRow, error: caseErr } = await sb
    .from("cases")
    .select("*")
    .eq("id", input.caseId)
    .maybeSingle();
  if (caseErr || !caseRow) {
    throw new DispatcherError(
      "CASE_NOT_FOUND",
      caseErr?.message ?? `case ${input.caseId} not found`,
    );
  }
  const c = caseRow as Case;
  if (c.status !== "triaged" && c.status !== "referred") {
    throw new DispatcherError(
      "CASE_INVALID_STATE",
      `case status must be triaged|referred, got ${c.status}`,
    );
  }

  // 2. Private rehabber contact info.
  const rehabber = await getRehabberPrivate(input.rehabberId);
  if (!rehabber) {
    throw new DispatcherError(
      "REHABBER_NOT_FOUND",
      `rehabber ${input.rehabberId} not found`,
    );
  }

  // 3. Scoped agent token — asserts referral:send before we send anything.
  const auth = await getAgentToken({
    caseId: c.id,
    rehabberId: rehabber.id,
    userSub: input.userSub,
  });
  if (!auth) {
    throw new DispatcherError(
      "AUTH_SCOPE_MISSING",
      "No agent token available (neither user-consented nor M2M fallback).",
    );
  }
  if (!auth.scope.split(/\s+/).includes("referral:send")) {
    throw new DispatcherError(
      "AUTH_SCOPE_MISSING",
      `scope 'referral:send' missing from agent token`,
    );
  }

  // 4. 7-day signed photo URL.
  const { data: signed, error: signErr } = await sb.storage
    .from("photos")
    .createSignedUrl(c.photo_path, 7 * 24 * 60 * 60);
  if (signErr || !signed?.signedUrl) {
    throw new DispatcherError(
      "EMAIL_SEND_FAILED",
      `signed URL failed: ${signErr?.message ?? "unknown"}`,
    );
  }

  // 5. Insert referral row FIRST — if email send fails later, the row
  //    remains with email_provider_id=null for retry (techdesign §13).
  const magicExpiresAtMs = Date.now() + 72 * 60 * 60 * 1000;
  // Referral ID: generate client-side so we can derive the magic token before
  // the insert. We rely on a random UUID; column default would also accept it.
  const referralId = cryptoRandomUuid();
  const { raw: magicRaw, hash: magicHash } = makeMagicToken(
    referralId,
    magicExpiresAtMs,
  );

  const { error: insErr } = await sb.from("referrals").insert({
    id: referralId,
    case_id: c.id,
    rehabber_id: rehabber.id,
    rank_score: input.rankScore ?? 0,
    rank_explain: input.rankExplain ?? null,
    magic_token_hash: magicHash,
    magic_expires_at: new Date(magicExpiresAtMs).toISOString(),
  });
  if (insErr) {
    throw new DispatcherError(
      "EMAIL_SEND_FAILED",
      `referral insert failed: ${insErr.message}`,
    );
  }

  // 6. Render + send.
  const base = appBaseUrl();
  const acceptUrl = `${base}/api/rehabber/outcome/${magicRaw}?o=accepted`;
  const declineUrl = `${base}/api/rehabber/outcome/${magicRaw}?o=declined`;
  const email = renderReferralEmail({
    rehabber: { name: rehabber.name, email: rehabber.email, org: rehabber.org },
    caseRow: c,
    photoUrl: signed.signedUrl,
    acceptUrl,
    declineUrl,
  });

  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
  let sendResult: { messageId: string; transport: "resend" | "gmail-smtp" };
  try {
    sendResult = await sendEmail({
      to: rehabber.email,
      from,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (err) {
    // Leave the referral row with email_provider_id=null for retry.
    if (err instanceof DispatcherError) throw err;
    throw new DispatcherError(
      "EMAIL_SEND_FAILED",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 7. Update referral + promote case to 'referred'.
  await sb
    .from("referrals")
    .update({ email_provider_id: sendResult.messageId })
    .eq("id", referralId);

  if (c.status === "triaged") {
    await sb
      .from("cases")
      .update({ status: "referred" })
      .eq("id", c.id)
      .eq("status", "triaged");
  }

  return {
    referralId,
    emailProviderId: sendResult.messageId,
    mode: auth.mode,
    transport: sendResult.transport,
  };
}

function cryptoRandomUuid(): string {
  // Node 19+ / Next 16 runtimes include crypto.randomUUID; keep a defensive
  // fallback using getRandomValues-like randomBytes.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20,
  )}-${h.slice(20)}`;
}
