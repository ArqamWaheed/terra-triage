"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { runTriageForCase } from "@/app/case/[id]/actions";

export interface TriageRunningProps {
  caseId: string;
}

export function TriageRunning({ caseId }: TriageRunningProps) {
  const router = useRouter();
  const started = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = await runTriageForCase(caseId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
      >
        <div className="flex items-center gap-2 font-medium text-destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Triage failed
        </div>
        <p className="text-muted-foreground">{error}</p>
        <Button type="button" size="sm" onClick={run} className="gap-2">
          <RefreshCw className="size-4" aria-hidden="true" />
          Retry triage
        </Button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm"
    >
      <Loader2
        className="size-5 animate-spin text-primary motion-reduce:animate-none"
        aria-hidden="true"
      />
      <div>
        <p className="font-medium">Running triage…</p>
        <p className="text-muted-foreground">
          Identifying species and grading severity. Takes ~5–10s.
        </p>
      </div>
      {pending ? null : null}
    </div>
  );
}

export default TriageRunning;
