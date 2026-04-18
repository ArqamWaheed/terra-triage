import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function OutcomeConfirmPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Card className="p-6 text-center space-y-3">
        <h1 className="text-lg font-semibold">Thanks — outcome recorded.</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ve notified the rest of Terra Triage. You can close this tab.
        </p>
        <p className="text-xs text-muted-foreground">
          Future referrals will adapt to this result — species scope, capacity,
          and response-time signals have been updated.
        </p>
      </Card>
    </main>
  );
}
