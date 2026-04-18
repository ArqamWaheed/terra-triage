"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface SendReferralButtonProps {
  caseId: string;
  rehabberId: string;
  className?: string;
}

export function SendReferralButton({
  caseId,
  rehabberId,
  className,
}: SendReferralButtonProps) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className={className}>
      <Button
        type="button"
        disabled
        aria-disabled="true"
        title={`case=${caseId} rehabber=${rehabberId}`}
        onClick={() =>
          setMsg(
            "Auth0 consent flow ships in Phase 6. No referral email sent yet.",
          )
        }
      >
        Send referral — Auth0 required (Phase 6)
      </Button>
      {msg ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
