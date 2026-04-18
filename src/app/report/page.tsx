import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ReportPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Report an animal</h1>
        <p className="text-muted-foreground">
          Intake flow (photo upload → species ID → triage → dispatch) ships in Phase 3.
        </p>
      </header>

      <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        Coming in Phase 3. In the meantime, if you&apos;ve found an injured wild animal,
        contact a licensed wildlife rehabilitator in your area — don&apos;t carry it if
        you&apos;re unsure.
      </div>

      <Link href="/" className="self-start">
        <Button variant="outline" size="lg">
          Return home
        </Button>
      </Link>
    </main>
  );
}
