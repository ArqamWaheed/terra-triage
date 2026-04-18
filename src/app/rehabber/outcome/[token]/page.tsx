import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MagicLinkError, verifyMagicToken } from "@/lib/auth/magic-link";
import { getServiceSupabase } from "@/lib/db/supabase";
import type { Case, Referral, Rehabber } from "@/lib/db/types";

import { OutcomeForm } from "./outcome-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Outcome = "accepted" | "declined" | "transferred" | "closed";

function isOutcome(x: string | undefined): x is Outcome {
  return x === "accepted" || x === "declined" || x === "transferred" || x === "closed";
}

async function loadReferralByToken(token: string) {
  const firstDot = token.indexOf(".");
  if (firstDot <= 0) return { kind: "invalid" as const };
  const referralId = token.slice(0, firstDot);

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("referrals")
    .select("*")
    .eq("id", referralId)
    .maybeSingle();
  if (error || !data) return { kind: "not_found" as const };
  const referral = data as Referral;

  try {
    verifyMagicToken(token, referral.magic_token_hash);
  } catch (err) {
    if (err instanceof MagicLinkError) {
      if (err.code === "EXPIRED") return { kind: "expired" as const, referral };
      return { kind: "invalid" as const };
    }
    return { kind: "invalid" as const };
  }

  const [{ data: caseRow }, { data: rehabRow }] = await Promise.all([
    sb.from("cases").select("*").eq("id", referral.case_id).maybeSingle(),
    sb.from("rehabbers").select("*").eq("id", referral.rehabber_id).maybeSingle(),
  ]);
  if (!caseRow || !rehabRow) return { kind: "not_found" as const };

  // 7-day signed URL for the finder photo.
  const { data: signed } = await sb.storage
    .from("photos")
    .createSignedUrl((caseRow as Case).photo_path, 7 * 24 * 60 * 60);

  return {
    kind: "ok" as const,
    referral,
    caseData: caseRow as Case,
    rehabber: rehabRow as Rehabber,
    photoUrl: signed?.signedUrl ?? null,
  };
}

function MessagePage({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Card className="p-6">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="mt-2 text-sm text-muted-foreground">{body}</div>
      </Card>
    </main>
  );
}

export default async function OutcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ o?: string }>;
}) {
  const { token } = await params;
  const { o } = await searchParams;

  const result = await loadReferralByToken(token);

  if (result.kind === "invalid") {
    return (
      <MessagePage
        title="Invalid link"
        body="This outcome link is malformed or has been tampered with."
      />
    );
  }
  if (result.kind === "not_found") {
    notFound();
  }
  if (result.kind === "expired") {
    return (
      <MessagePage
        title="Link expired"
        body="This outcome link has expired. Ask the finder to resend the referral, or contact Terra Triage."
      />
    );
  }

  const { referral, caseData, rehabber, photoUrl } = result;

  if (referral.outcome) {
    return (
      <MessagePage
        title="Already recorded"
        body={
          <span>
            You submitted <strong>{referral.outcome}</strong> for this case on{" "}
            {referral.outcome_at
              ? new Date(referral.outcome_at).toLocaleString()
              : "—"}
            . This link is single-use and cannot be changed.
          </span>
        }
      />
    );
  }

  const initialOutcome = isOutcome(o) ? o : undefined;
  const lat = caseData.lat.toFixed(5);
  const lng = caseData.lng.toFixed(5);
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <main className="mx-auto max-w-xl px-6 py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Wildlife referral</h1>
        <p className="text-sm text-muted-foreground">
          Hi {rehabber.name}
          {rehabber.org ? ` (${rehabber.org})` : ""} — a finder near you needs
          help.
        </p>
      </header>

      <Card className="gap-0 p-0">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt="Finder photo"
            className="aspect-video w-full object-cover"
          />
        ) : null}
        <div className="space-y-3 p-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {caseData.species ?? "Unknown animal"}
            </Badge>
            {caseData.species_confidence != null ? (
              <Badge variant="outline">
                {Math.round(caseData.species_confidence * 100)}% confidence
              </Badge>
            ) : null}
            <Badge variant="outline">
              severity {caseData.severity ?? "?"}/5
            </Badge>
          </div>
          <div className="grid gap-1 text-muted-foreground">
            <div>
              <span className="text-foreground">Location:</span>{" "}
              <a
                href={mapsUrl}
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                {lat}, {lng}
              </a>
            </div>
            {caseData.finder_email ? (
              <div>
                <span className="text-foreground">Finder:</span>{" "}
                <a
                  href={`mailto:${caseData.finder_email}`}
                  className="underline"
                >
                  {caseData.finder_email}
                </a>
              </div>
            ) : null}
            <div className="text-xs">
              Photo link expires{" "}
              {new Date(referral.magic_expires_at).toLocaleString()}.
            </div>
          </div>
          {caseData.safety_advice?.line ? (
            <p className="rounded-md bg-muted/60 p-3 text-xs italic">
              {caseData.safety_advice.line}
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="p-5">
        <OutcomeForm token={token} initialOutcome={initialOutcome} />
      </Card>
    </main>
  );
}
