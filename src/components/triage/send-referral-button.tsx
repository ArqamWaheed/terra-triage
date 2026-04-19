"use client";

import { useState, useTransition } from "react";

import { sendReferralAction } from "@/app/case/[id]/actions";
import { AuthModeBadge } from "@/components/auth/auth-mode-badge";
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
  | {
      kind: "ok";
      msg: string;
      authMode: "user-consented" | "m2m-fallback";
      transport: string;
      referralId: string;
    }
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
          authMode: res.authMode,
          transport: res.transport,
          referralId: res.referralId,
        });
      } else {
        setStatus({ kind: "err", msg: `${res.code}: ${res.message}` });
      }
    });
  };

  const previewMode: "user-consented" | "m2m-fallback" =
    authMode === "m2m-fallback" ? "m2m-fallback" : "user-consented";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Sending…" : "Send referral"}
        </Button>
        {status.kind === "idle" || status.kind === "err" ? (
          <AuthModeBadge mode={previewMode} />
        ) : null}
      </div>
      {status.kind === "ok" ? (
        <div className="mt-2 space-y-1">
          <p
            role="status"
            className="text-xs text-emerald-700 dark:text-emerald-400"
          >
            {status.msg}
            <span className="ml-2 text-muted-foreground">
              · via {status.transport}
            </span>
            {status.transport === "demo-capture" ? (
              <a
                href={`/demo/inbox/${status.referralId}`}
                className="ml-2 underline"
                target="_blank"
                rel="noopener"
              >
                View captured email →
              </a>
            ) : null}
          </p>
          <AuthModeBadge mode={status.authMode} />
        </div>
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
