import { Badge } from "@/components/ui/badge";

export type AuthBadgeMode = "user-consented" | "m2m-fallback";

export interface AuthModeBadgeProps {
  mode: AuthBadgeMode;
  className?: string;
}

/**
 * Surfaces which auth path the dispatcher actually used for a referral send.
 *
 * `user-consented` — the user signed in with Auth0 and the agent token came
 * from a PAR/RAR exchange scoped to `referral:send`. This is the primary
 * Auth0-prize narrative: scoped consent on record.
 *
 * `m2m-fallback` — no user-consented scope was available, so the dispatcher
 * minted a client-credentials (M2M) token. Still scope-gated, but not tied
 * to an individual user's consent.
 */
export function AuthModeBadge({ mode, className }: AuthModeBadgeProps) {
  if (mode === "user-consented") {
    return (
      <Badge
        variant="default"
        className={className}
        aria-label="Dispatched with user-consented scoped token"
      >
        Dispatched with your scoped consent token (Auth0 RAR)
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={className}
      aria-label="Dispatched with service token fallback"
    >
      Dispatched via service token (consent unavailable)
    </Badge>
  );
}

export default AuthModeBadge;
