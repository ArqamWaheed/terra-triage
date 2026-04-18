import { getPublicRehabbers } from "@/lib/db/rehabbers";
import { rankRehabbersWithMemory } from "@/lib/agents/rank-with-memory";
import type { Case } from "@/lib/db/types";

import { RehabberMap } from "./rehabber-map";
import { RankedList } from "./ranked-list";
import { SendReferralButton } from "./send-referral-button";

export interface TriageDispatchPaneProps {
  caseRow: Pick<Case, "id" | "lat" | "lng" | "species">;
}

/**
 * Server component. Fetches active rehabbers, ranks them against the case,
 * renders the map + top-3 list + (stubbed) referral action. Safe to drop
 * into /case/[id]/page.tsx (owned by Phase 3) once Phase 4 wires it up.
 */
export async function TriageDispatchPane({ caseRow }: TriageDispatchPaneProps) {
  const rehabbers = await getPublicRehabbers();
  const ranked = await rankRehabbersWithMemory(
    { species: caseRow.species, lat: caseRow.lat, lng: caseRow.lng },
    rehabbers,
  );
  const top = ranked[0];

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
        />
      ) : null}
    </section>
  );
}

export default TriageDispatchPane;
