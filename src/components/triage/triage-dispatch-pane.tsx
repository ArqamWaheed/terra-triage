import { getPublicRehabbers } from "@/lib/db/rehabbers";
import { rankRehabbersWithMemory } from "@/lib/agents/rank-with-memory";
import { auth0Configured, getSession } from "@/lib/auth/client";
import type { Case } from "@/lib/db/types";

import { RehabberMap } from "./rehabber-map";
import { RankedList } from "./ranked-list";
import { SendReferralButton } from "./send-referral-button";

export interface TriageDispatchPaneProps {
  caseRow: Pick<Case, "id" | "lat" | "lng" | "species">;
}

/**
 * Server component. Fetches active rehabbers, ranks them against the case,
 * renders the map + top-3 list + Auth0-gated referral action.
 */
export async function TriageDispatchPane({ caseRow }: TriageDispatchPaneProps) {
  const rehabbers = await getPublicRehabbers();
  const ranked = await rankRehabbersWithMemory(
    { species: caseRow.species, lat: caseRow.lat, lng: caseRow.lng },
    rehabbers,
  );
  const top = ranked[0];

  const session = auth0Configured() ? await getSession() : null;
  const authenticated = Boolean(session?.user);
  // If Auth0 is configured but the user has no session, we're still going
  // to use m2m-fallback mode under the hood once they authenticate without
  // the referral:send scope. For UI surface, we mark the likely mode.
  const hasUserToken =
    authenticated &&
    typeof session?.tokenSet?.scope === "string" &&
    session.tokenSet.scope.split(/\s+/).includes("referral:send");
  const authMode: "user-consented" | "m2m-fallback" | null = authenticated
    ? hasUserToken
      ? "user-consented"
      : "m2m-fallback"
    : null;

  return (
    <section
      aria-labelledby="dispatch-pane-heading"
      className="flex flex-col gap-4"
    >
      <h2 id="dispatch-pane-heading" className="text-lg font-semibold">
        Nearest rehabbers
      </h2>
      <RehabberMap
        finder={{ lat: caseRow.lat, lng: caseRow.lng }}
        ranked={ranked}
      />
      <RankedList ranked={ranked} />
      {top ? (
        <SendReferralButton
          caseId={caseRow.id}
          rehabberId={top.rehabber.id}
          rehabberName={top.rehabber.name}
          authenticated={authenticated}
          authMode={authMode}
        />
      ) : null}
    </section>
  );
}

export default TriageDispatchPane;
