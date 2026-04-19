import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, MapPin, X } from "lucide-react";

import { SeverityBadge } from "@/components/triage/severity-badge";
import { TriageDispatchPane } from "@/components/triage/triage-dispatch-pane";
import { TriageRunning } from "@/components/triage/triage-running";
import { Badge } from "@/components/ui/badge";
import { getServiceSupabase } from "@/lib/db/supabase";
import type { Case, Referral, SafetyAdvice } from "@/lib/db/types";

type Params = Promise<{ id: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CasePage({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const c = data as Case;

  const { data: referralsData } = await supabase
    .from("referrals")
    .select("id, rehabber_id, sent_at, outcome, outcome_at, outcome_notes")
    .eq("case_id", id)
    .order("sent_at", { ascending: true });
  const referrals = (referralsData ?? []) as Array<
    Pick<
      Referral,
      | "id"
      | "rehabber_id"
      | "sent_at"
      | "outcome"
      | "outcome_at"
      | "outcome_notes"
    >
  >;

  const rehabberIds = Array.from(new Set(referrals.map((r) => r.rehabber_id)));
  const rehabberMap = new Map<string, { name: string; org: string }>();
  if (rehabberIds.length > 0) {
    const { data: rehabRows } = await supabase
      .from("rehabbers")
      .select("id, name, org")
      .in("id", rehabberIds);
    for (const row of rehabRows ?? []) {
      rehabberMap.set(row.id, { name: row.name, org: row.org });
    }
  }

  let photoUrl: string | null = null;
  if (c.photo_path) {
    const { data: signed } = await supabase.storage
      .from("photos")
      .createSignedUrl(c.photo_path, 60);
    photoUrl = signed?.signedUrl ?? null;
  }

  const isPending = c.status === "new";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 py-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Home
      </Link>

      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Case {c.id.slice(0, 8)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isPending ? "Thanks - your report is in." : "Triage complete"}
        </h1>
      </header>

      <article
        aria-labelledby="triage-card-heading"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={
              c.species
                ? `Submitted photo of ${c.species}`
                : "Submitted animal photo"
            }
            className="aspect-video w-full rounded-xl border border-border object-cover"
          />
        ) : (
          <div className="aspect-video w-full rounded-xl border border-dashed border-border" />
        )}

        {isPending ? (
          <>
            <p className="text-sm text-muted-foreground">
              Keep this tab open - we&apos;re identifying the animal now.
            </p>
            <TriageRunning caseId={c.id} />
          </>
        ) : (
          <TriageCardBody caseRow={c} />
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <dt>Location</dt>
          <dd className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden="true" />
            {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
          </dd>
        </dl>
      </article>

      {!isPending ? (
        <TriageDispatchPane
          caseRow={{ id: c.id, lat: c.lat, lng: c.lng, species: c.species }}
        />
      ) : null}

      {referrals.length > 0 ? (
        <section
          aria-labelledby="referral-status-heading"
          className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <h2
            id="referral-status-heading"
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
          >
            Rehabber responses
          </h2>
          <ul className="flex flex-col divide-y divide-border">
            {referrals.map((r) => {
              const who = rehabberMap.get(r.rehabber_id);
              return (
                <li key={r.id} className="flex flex-col gap-1 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {who?.org ?? "Licensed rehabber"}
                    </span>
                    <ReferralStatusBadge outcome={r.outcome} />
                  </div>
                  {r.outcome_notes ? (
                    <p className="text-xs text-muted-foreground">
                      “{r.outcome_notes}”
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            This page updates when you reload it.
          </p>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Keep this URL - it&apos;s your only link to this case for now.
      </p>
    </main>
  );
}

function ReferralStatusBadge({
  outcome,
}: {
  outcome: Referral["outcome"];
}) {
  if (!outcome) {
    return (
      <Badge variant="outline" className="text-[11px]">
        Awaiting response
      </Badge>
    );
  }
  if (outcome === "accepted") {
    return (
      <Badge className="bg-emerald-600 text-white text-[11px]">
        <Check className="size-3" aria-hidden="true" /> Accepted
      </Badge>
    );
  }
  if (outcome === "declined") {
    return (
      <Badge variant="outline" className="text-[11px]">
        <X className="size-3" aria-hidden="true" /> Declined
      </Badge>
    );
  }
  if (outcome === "transferred") {
    return (
      <Badge variant="secondary" className="text-[11px]">
        Transferred to another rehabber
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[11px]">
      Closed
    </Badge>
  );
}

function TriageCardBody({ caseRow }: { caseRow: Case }) {
  const species = caseRow.species ?? "Unknown animal";
  const sa: SafetyAdvice | null = caseRow.safety_advice ?? null;
  const confidence = caseRow.species_confidence ?? 0;
  const confidencePct = Math.round(confidence * 100);
  const severity = (caseRow.severity ?? 3) as 1 | 2 | 3 | 4 | 5;
  const shouldTouch = sa?.touch ?? false;

  const line = sa?.line?.trim() || "When in doubt, call - don't carry.";

  const dos: string[] = [];
  const donts: string[] = [];
  if (shouldTouch) {
    dos.push("Gently contain with gloves or a towel.");
  } else {
    donts.push("Do not pick the animal up with bare hands.");
  }
  if (sa?.containment) dos.push(sa.containment);
  if (sa?.transport) dos.push(sa.transport);
  donts.push("No food or water.");
  donts.push("No loud noises, music, or pets nearby.");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2
          id="triage-card-heading"
          className="text-lg font-semibold leading-tight"
        >
          {species}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={severity} />
          <Badge variant="outline" className="font-mono text-[11px]">
            {confidencePct}% confident
          </Badge>
          {species === "Unknown animal" ? (
            <Badge variant="secondary">Unidentified</Badge>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl bg-primary/5 p-3 text-sm font-medium">
        {line}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ul className="flex flex-col gap-1.5 rounded-xl border border-border p-3 text-sm">
          <li className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Do
          </li>
          {dos.map((d, i) => (
            <li key={i} className="flex gap-2">
              <Check
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>{d}</span>
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-1.5 rounded-xl border border-border p-3 text-sm">
          <li className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Don&apos;t
          </li>
          {donts.map((d, i) => (
            <li key={i} className="flex gap-2">
              <X
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>

      {species === "Unknown animal" ? (
        <p className="text-xs text-muted-foreground">
          Automated identification was low-confidence. The licensed rehabber
          you&apos;re matched with will confirm species and next steps.
        </p>
      ) : null}
    </div>
  );
}
