import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token format (matches Phase 6 dispatcher.ts::makeMagicToken):
 *   raw    = `${referralId}.${expMs}.${mac}`
 *   mac    = hex HMAC-SHA256(MAGIC_LINK_SECRET, `${referralId}.${expMs}`)
 *   stored = sha256(raw) in referrals.magic_token_hash
 *
 * Verification therefore: parse referralId+expMs from the raw token, recompute
 * mac with the secret, timing-safe compare against the mac in the token, check
 * expiry, then sha256(raw) compare against the stored hash.
 */

export class MagicLinkError extends Error {
  readonly code:
    | "MALFORMED"
    | "BAD_SIGNATURE"
    | "EXPIRED"
    | "HASH_MISMATCH"
    | "MISSING_SECRET";
  constructor(code: MagicLinkError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "MagicLinkError";
  }
}

function requireSecret(): string {
  const s = process.env.MAGIC_LINK_SECRET;
  if (!s || s.length < 16) {
    throw new MagicLinkError(
      "MISSING_SECRET",
      "MAGIC_LINK_SECRET is required (>=16 chars) to verify magic tokens",
    );
  }
  return s;
}

export function signMagicToken(
  referralId: string,
  expMs: number,
): { token: string; hash: string } {
  const secret = requireSecret();
  const payload = `${referralId}.${expMs}`;
  const mac = createHmac("sha256", secret).update(payload).digest("hex");
  const token = `${payload}.${mac}`;
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export function hashMagicToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface VerifiedMagicToken {
  referralId: string;
  exp: number;
}

export function verifyMagicToken(
  token: string,
  expectedHash: string,
): VerifiedMagicToken {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new MagicLinkError("MALFORMED", "token must have 3 dot-joined parts");
  }
  const [referralId, expStr, macHex] = parts;
  if (!referralId || !expStr || !macHex) {
    throw new MagicLinkError("MALFORMED", "empty token segment");
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) {
    throw new MagicLinkError("MALFORMED", "exp is not a number");
  }

  const secret = requireSecret();
  const macExpected = createHmac("sha256", secret)
    .update(`${referralId}.${exp}`)
    .digest("hex");
  const a = Buffer.from(macHex, "hex");
  const b = Buffer.from(macExpected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new MagicLinkError("BAD_SIGNATURE", "HMAC mismatch");
  }

  if (Date.now() > exp) {
    throw new MagicLinkError("EXPIRED", "magic link expired");
  }

  // Defense-in-depth: also compare sha256(raw) to the stored hash.
  const actualHash = hashMagicToken(token);
  const ea = Buffer.from(actualHash, "hex");
  const eb = Buffer.from(expectedHash, "hex");
  if (ea.length !== eb.length || !timingSafeEqual(ea, eb)) {
    throw new MagicLinkError("HASH_MISMATCH", "stored hash differs");
  }

  return { referralId, exp };
}
