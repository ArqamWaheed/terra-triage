import "server-only";

import type { Case, Rehabber } from "@/lib/db/types";

export interface ReferralEmailInput {
  rehabber: Pick<Rehabber, "name" | "email" | "org">;
  caseRow: Pick<
    Case,
    | "id"
    | "lat"
    | "lng"
    | "species"
    | "severity"
    | "safety_advice"
    | "finder_email"
  >;
  photoUrl: string; // signed URL, 7-day TTL
  acceptUrl: string;
  declineUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function severityLabel(s: number | null): string {
  if (!s) return "Unknown";
  return `${s}/5`;
}

/**
 * Deterministic, zero-dep HTML email. We bypass @react-email/components so
 * the render is a single function call — easier to snapshot-test, no JSX
 * runtime needed by Resend's raw `html`/`text` fields.
 */
export function renderReferralEmail(input: ReferralEmailInput): RenderedEmail {
  const { rehabber, caseRow, photoUrl, acceptUrl, declineUrl } = input;
  const lat = caseRow.lat.toFixed(5);
  const lng = caseRow.lng.toFixed(5);
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const species = caseRow.species ?? "Unknown animal";
  const sev = severityLabel(caseRow.severity);
  const advice = caseRow.safety_advice;
  const line = advice?.line ?? "When in doubt, call - don't carry.";

  const subject = `Terra Triage: ${species} · severity ${sev} · near ${lat}, ${lng}`;

  const html = `<!doctype html>
<html lang="en">
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0a0a0a;background:#fafafa;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;border-bottom:1px solid #f0f0f0">
      <h1 style="margin:0;font-size:18px">New wildlife referral</h1>
      <p style="margin:4px 0 0;color:#525252;font-size:14px">
        Hi ${esc(rehabber.name)}${rehabber.org ? ` (${esc(rehabber.org)})` : ""}, a finder near you needs help.
      </p>
    </div>
    <img src="${esc(photoUrl)}" alt="Finder photo (signed URL, 7-day TTL)"
         style="width:100%;max-height:360px;object-fit:cover;display:block;background:#111" />
    <div style="padding:20px 24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 0;color:#525252">Species</td><td style="padding:4px 0;font-weight:600">${esc(species)}</td></tr>
        <tr><td style="padding:4px 0;color:#525252">Severity</td><td style="padding:4px 0;font-weight:600">${esc(sev)}</td></tr>
        <tr><td style="padding:4px 0;color:#525252">Location</td><td style="padding:4px 0"><a href="${esc(mapsUrl)}" style="color:#0a7;text-decoration:underline">${esc(lat)}, ${esc(lng)} · open in Google Maps</a></td></tr>
        ${caseRow.finder_email ? `<tr><td style="padding:4px 0;color:#525252">Finder</td><td style="padding:4px 0"><a href="mailto:${esc(caseRow.finder_email)}" style="color:#0a7">${esc(caseRow.finder_email)}</a></td></tr>` : ""}
      </table>
      ${advice ? `
      <h2 style="font-size:14px;margin:20px 0 6px">Finder safety advice</h2>
      <ul style="padding-left:18px;margin:0;font-size:14px;color:#262626">
        <li><strong>Touch:</strong> ${advice.touch ? "OK with care" : "Do NOT touch"}</li>
        <li><strong>Containment:</strong> ${esc(advice.containment)}</li>
        <li><strong>Transport:</strong> ${esc(advice.transport)}</li>
      </ul>
      <p style="margin:12px 0 0;font-style:italic;color:#525252;font-size:13px">${esc(line)}</p>
      ` : ""}
      <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap">
        <a href="${esc(acceptUrl)}"
           style="background:#059669;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          I can take this case
        </a>
        <a href="${esc(declineUrl)}"
           style="background:#f5f5f5;color:#171717;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;border:1px solid #e5e5e5">
          Decline
        </a>
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#737373">
        Terra Triage · case <code>${esc(caseRow.id)}</code> · photo link expires in 7 days.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    `New wildlife referral - Terra Triage`,
    ``,
    `Species: ${species}`,
    `Severity: ${sev}`,
    `Location: ${lat}, ${lng}  (${mapsUrl})`,
    caseRow.finder_email ? `Finder: ${caseRow.finder_email}` : null,
    ``,
    advice ? `Touch: ${advice.touch ? "OK with care" : "Do NOT touch"}` : null,
    advice ? `Containment: ${advice.containment}` : null,
    advice ? `Transport: ${advice.transport}` : null,
    ``,
    line,
    ``,
    `Accept: ${acceptUrl}`,
    `Decline: ${declineUrl}`,
    ``,
    `Photo (7-day signed URL): ${photoUrl}`,
    `Case id: ${caseRow.id}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { subject, html, text };
}
