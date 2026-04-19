"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type UiStatus =
  | { kind: "idle" }
  | { kind: "ok"; caseId: string; photoReused: boolean }
  | { kind: "err"; msg: string };

export function SeedDemoButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<UiStatus>({ kind: "idle" });

  const submit = () => {
    setStatus({ kind: "idle" });
    start(async () => {
      try {
        const res = await fetch("/api/admin/seed-demo-case", {
          method: "POST",
        });
        if (!res.ok) {
          const txt = await res.text();
          setStatus({ kind: "err", msg: `${res.status}: ${txt.slice(0, 200)}` });
          return;
        }
        const body = (await res.json()) as {
          caseId: string;
          photoReused?: boolean;
        };
        setStatus({
          kind: "ok",
          caseId: body.caseId,
          photoReused: Boolean(body.photoReused),
        });
        setTimeout(() => window.location.reload(), 400);
      } catch (err) {
        setStatus({
          kind: "err",
          msg: err instanceof Error ? err.message : String(err),
        });
      }
    });
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={submit} disabled={pending} size="sm">
          {pending ? "Seeding..." : "Seed demo case"}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Idempotent - Central Park NYC coords, reuses an existing photo if available.
        </span>
      </div>
      {status.kind === "ok" ? (
        <p role="status" className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
          Seeded case{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">
            {status.caseId.slice(0, 8)}
          </code>
          {status.photoReused
            ? " - reused an existing photo, Finder ran against it."
            : " - no photo in bucket, used placeholder triage payload."}
        </p>
      ) : null}
      {status.kind === "err" ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          Seed failed - {status.msg}
        </p>
      ) : null}
    </div>
  );
}
