"use client";

import { useState, useTransition } from "react";

import { sendReferralAction } from "@/app/case/[id]/actions";
import { Button } from "@/components/ui/button";

export interface SendReferralButtonProps {
  caseId: string;
  rehabberId: string;
  rehabberName?: string;
  authenticated: boolean;
  authMode?: "user-consented" | "m2m-fallback" | null;
  className?: string;
}

type UiStatus =
  | { kind: "idle" }
  | { kind: "ok"; msg: string; mode: string; transport: string }
  | { kind: "err"; msg: string };

function consentHref(caseId: string, rehabberName?: string): string {
  const ctx = rehabberName
    ? `Email referral to ${rehabberName}`
    : "Dispatch wildlife referral";
  const returnTo = `/case/${caseId}`;
  const qs = new URLSearchParams({ returnTo, ctx });
  return `/api/auth/consent?${qs.toString()}`;
}

export function SendReferralButton({
  caseId,
  rehabberId,
  rehabberName,
  authenticated,
  authMode,
  className,
}: SendReferralButtonProps) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<UiStatus>({ kind: "idle" });

  if (!authenticated) {
    const href = consentHref(caseId, rehabberName);
    return (
      <div className={className}>
        <a
          href={href}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Send referral - sign in with Auth0
        </a>
        <p className="mt-2 text-xs text-muted-foreground">
          You&apos;ll be asked to grant the{" "}
          <code className="rounded bg-muted px-1 py-0.5">referral:send</code>{" "}
          scope before we email the rehabber on your behalf.
        </p>
      </div>
    );
  }

  const submit = () => {
    setStatus({ kind: "idle" });
    start(async () => {
      const res = await sendReferralAction(caseId, rehabberId);
      if (res.ok) {
        setStatus({
          kind: "ok",
          msg: `Referral sent${
            rehabberName ? ` to ${rehabberName}` : ""
          } · message id ${res.emailProviderId}`,
          mode: res.mode,
          transport: res.transport,
        });
      } else {
        setStatus({ kind: "err", msg: `${res.code}: ${res.message}` });
      }
    });
  };

  const modeLabel =
    status.kind === "ok"
      ? status.mode === "user-consented"
        ? "User-consented"
        : "M2M fallback"
      : authMode === "m2m-fallback"
        ? "M2M fallback"
        : "User-consented";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Sending…" : "Send referral"}
        </Button>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {modeLabel}
        </span>
      </div>
      {status.kind === "ok" ? (
        <p
          role="status"
          className="mt-2 text-xs text-emerald-700 dark:text-emerald-400"
        >
          {status.msg}
          <span className="ml-2 text-muted-foreground">
            · via {status.transport}
          </span>
        </p>
      ) : null}
      {status.kind === "err" ? (
        <p
          role="alert"
          className="mt-2 flex items-center gap-2 text-xs text-destructive"
        >
          <span>{status.msg}</span>
          <button
            type="button"
            className="underline"
            onClick={submit}
            disabled={pending}
          >
            Retry
          </button>
        </p>
      ) : null}
    </div>
  );
}
