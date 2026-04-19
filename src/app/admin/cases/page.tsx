import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MemorySignalsTimeline } from "@/components/admin/memory-signals-timeline";
import { SeedDemoButton } from "@/components/admin/seed-demo-button";
import { rankRehabbersWithMemory } from "@/lib/agents/rank-with-memory";
import { getPublicRehabbers } from "@/lib/db/rehabbers";
import { getLatestMemoryEntries } from "@/lib/db/memory-entries";
import { getServiceSupabase } from "@/lib/db/supabase";
import type { Case, Referral } from "@/lib/db/types";
import { getMemory } from "@/lib/memory";
import type { SignalsByRehabber } from "@/lib/memory/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 20;

interface RehabberLite {
  id: string;
  name: string;
  org: string | null;
}

interface CaseRow extends Case {
  referralCount: number;
  topReferral: (Referral & { rehabber: RehabberLite | null }) | null;
}

async function loadCasesPage(page: number): Promise<{
  rows: CaseRow[];
  total: number;
}> {
  const sb = getServiceSupabase();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: cases, count } = await sb
    .from("cases")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const caseList = (cases ?? []) as Case[];
  if (caseList.length === 0) return { rows: [], total: count ?? 0 };

  const caseIds = caseList.map((c) => c.id);
  const { data: referrals } = await sb
    .from("referrals")
    .select("*")
    .in("case_id", caseIds)
    .order("sent_at", { ascending: false });
  const refList = (referrals ?? []) as Referral[];

  const rehabberIds = Array.from(new Set(refList.map((r) => r.rehabber_id)));
  const { data: rehabbers } = rehabberIds.length
    ? await sb
        .from("rehabbers")
        .select("id,name,org")
        .in("id", rehabberIds)
    : { data: [] as RehabberLite[] };
  const rehabberMap = new Map<string, RehabberLite>(
    (rehabbers ?? []).map((r) => [r.id, r as RehabberLite]),
  );

  const byCase = new Map<string, Referral[]>();
  for (const r of refList) {
    const arr = byCase.get(r.case_id) ?? [];
    arr.push(r);
    byCase.set(r.case_id, arr);
  }

  const rows: CaseRow[] = caseList.map((c) => {
    const cref = byCase.get(c.id) ?? [];
    const top = cref[0];
    return {
      ...c,
      referralCount: cref.length,
      topReferral: top
        ? { ...top, rehabber: rehabberMap.get(top.rehabber_id) ?? null }
        : null,
    };
  });

  return { rows, total: count ?? 0 };
}

function statusVariant(
  s: Case["status"],
): "default" | "secondary" | "outline" | "destructive" {
  if (s === "accepted") return "default";
  if (s === "closed") return "outline";
  if (s === "declined") return "destructive";
  return "secondary";
}

async function CaseDetail({ caseId }: { caseId: string }) {
  const sb = getServiceSupabase();
  const { data: caseRow } = await sb
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();
  if (!caseRow) {
    return <p className="text-sm text-destructive">Case not found.</p>;
  }
  const c = caseRow as Case;

  const { data: referrals } = await sb
    .from("referrals")
    .select("*")
    .eq("case_id", caseId)
    .order("sent_at", { ascending: false });
  const refList = (referrals ?? []) as Referral[];

  const rehabberIds = Array.from(new Set(refList.map((r) => r.rehabber_id)));
  const { data: rehabbers } = rehabberIds.length
    ? await sb
        .from("rehabbers")
        .select("id,name,org")
        .in("id", rehabberIds)
    : { data: [] as RehabberLite[] };
  const rehabberMap = new Map<string, RehabberLite>(
    (rehabbers ?? []).map((r) => [r.id, r as RehabberLite]),
  );

  let memSnap: SignalsByRehabber = {};
  if (rehabberIds.length) {
    try {
      memSnap = await getMemory().query(rehabberIds);
    } catch (err) {
      console.error("[admin] memory snapshot failed", err);
    }
  }

  // Backboard prize demo: re-rank NOW with current memory signals, show
  // side-by-side with each referral's pinned rank_explain.
  let rerank: Awaited<ReturnType<typeof rankRehabbersWithMemory>> = [];
  try {
    const pubs = await getPublicRehabbers();
    rerank = await rankRehabbersWithMemory(
      { species: c.species, lat: c.lat, lng: c.lng },
      pubs,
    );
  } catch (err) {
    console.error("[admin] re-rank failed", err);
  }

  const triage = {
    species: c.species,
    species_confidence: c.species_confidence,
    severity: c.severity,
    safety_advice: c.safety_advice,
  };

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-foreground/10 bg-muted/30 p-4">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Triage (JSONB)
        </h3>
        <pre className="mt-1 overflow-x-auto rounded bg-background p-3 font-mono text-[11px] leading-5 ring-1 ring-foreground/10">
          {JSON.stringify(triage, null, 2)}
        </pre>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Referrals ({refList.length})
        </h3>
        <div className="mt-2 space-y-3">
          {refList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals yet.</p>
          ) : (
            refList.map((r) => {
              const reh = rehabberMap.get(r.rehabber_id);
              const now = rerank.find((x) => x.rehabber.id === r.rehabber_id);
              return (
                <div
                  key={r.id}
                  className="rounded-md border border-foreground/10 bg-background p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">
                      {reh?.name ?? r.rehabber_id.slice(0, 8)}
                    </span>
                    {reh?.org ? (
                      <span className="text-muted-foreground">
                        · {reh.org}
                      </span>
                    ) : null}
                    <Badge variant="outline">
                      score {Number(r.rank_score).toFixed(3)}
                    </Badge>
                    <Badge
                      variant={
                        r.outcome === "accepted"
                          ? "default"
                          : r.outcome
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {r.outcome ?? "pending"}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(r.sent_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        rank_explain at dispatch
                      </div>
                      <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-[11px] leading-5">
                        {JSON.stringify(r.rank_explain ?? {}, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        re-ranked now (memory effect)
                      </div>
                      <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-[11px] leading-5">
                        {now
                          ? JSON.stringify(
                              {
                                score: now.score,
                                km: now.km,
                                explain: now.explain,
                                signals: now.signals,
                              },
                              null,
                              2,
                            )
                          : "(not in current top ranking)"}
                      </pre>
                    </div>
                  </div>
                  {r.outcome_notes ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Notes: {r.outcome_notes}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Memory snapshot - rehabbers involved
        </h3>
        <pre className="mt-1 overflow-x-auto rounded bg-background p-3 font-mono text-[11px] leading-5 ring-1 ring-foreground/10">
          {JSON.stringify(memSnap, null, 2)}
        </pre>
      </section>
    </div>
  );
}

async function GlobalMemoryTimeline() {
  let entries: Awaited<ReturnType<typeof getLatestMemoryEntries>> = [];
  try {
    entries = await getLatestMemoryEntries(20);
  } catch (err) {
    console.error("[admin] memory timeline load failed", err);
  }

  const ids = Array.from(new Set(entries.map((e) => e.rehabber_id)));
  const sb = getServiceSupabase();
  const { data: rehabbers } = ids.length
    ? await sb.from("rehabbers").select("id,name,org").in("id", ids)
    : { data: [] as { id: string; name: string; org: string | null }[] };
  const labels: Record<string, string> = {};
  for (const r of rehabbers ?? []) {
    labels[r.id] = r.org ? `${r.name} · ${r.org}` : r.name;
  }

  return (
    <Card className="p-4">
      <MemorySignalsTimeline
        entries={entries}
        rehabberLabels={labels}
        title="Memory signals - latest 20 across all rehabbers"
      />
    </Card>
  );
}

export default async function AdminCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; case?: string }>;
}) {
  const { page: pageParam, case: caseParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { rows, total } = await loadCasesPage(page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageLink = (p: number, caseId?: string) => {
    const params = new URLSearchParams();
    if (p !== 1) params.set("page", String(p));
    if (caseId) params.set("case", caseId);
    const qs = params.toString();
    return `/admin/cases${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Admin · Cases</h1>
          <p className="text-xs text-muted-foreground">
            {total} case{total === 1 ? "" : "s"} · page {page} / {pages}
          </p>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground">
          Basic-auth gated · /admin/*
        </p>
      </header>

      <Card className="p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Demo controls
        </h2>
        <SeedDemoButton className="mt-2" />
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Id</th>
                <th className="px-3 py-2">Species</th>
                <th className="px-3 py-2">Sev</th>
                <th className="px-3 py-2">Conf</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Finder</th>
                <th className="px-3 py-2"># Refs</th>
                <th className="px-3 py-2">Top referral</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No cases yet.
                  </td>
                </tr>
              ) : (
                rows.flatMap((r) => {
                  const isOpen = caseParam === r.id;
                  const short = r.id.slice(0, 8);
                  return [
                    <tr
                      key={r.id}
                      className="border-t border-foreground/10 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={pageLink(page, isOpen ? undefined : r.id)}
                          className="font-mono text-[11px] underline"
                          scroll={false}
                        >
                          {short}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{r.species ?? "-"}</td>
                      <td className="px-3 py-2">{r.severity ?? "-"}</td>
                      <td className="px-3 py-2">
                        {r.species_confidence != null
                          ? `${Math.round(r.species_confidence * 100)}%`
                          : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusVariant(r.status)}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.finder_email ?? "-"}
                      </td>
                      <td className="px-3 py-2">{r.referralCount}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.topReferral ? (
                          <>
                            <span>
                              {r.topReferral.rehabber?.name ?? "-"}
                            </span>
                            <span className="ml-1 text-muted-foreground">
                              · {r.topReferral.outcome ?? "pending"}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>,
                    isOpen ? (
                      <tr key={`${r.id}-detail`} className="bg-muted/20">
                        <td colSpan={9} className="px-3 py-2">
                          <CaseDetail caseId={r.id} />
                        </td>
                      </tr>
                    ) : null,
                  ].filter(Boolean);
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <nav className="flex items-center justify-between text-sm">
        <Link
          href={pageLink(Math.max(1, page - 1), caseParam)}
          aria-disabled={page <= 1}
          className={
            page <= 1
              ? "pointer-events-none text-muted-foreground"
              : "underline"
          }
        >
          ← Prev
        </Link>
        <span className="text-xs text-muted-foreground">
          page {page} / {pages}
        </span>
        <Link
          href={pageLink(Math.min(pages, page + 1), caseParam)}
          aria-disabled={page >= pages}
          className={
            page >= pages
              ? "pointer-events-none text-muted-foreground"
              : "underline"
          }
        >
          Next →
        </Link>
      </nav>

      <GlobalMemoryTimeline />
    </main>
  );
}
