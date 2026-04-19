import Image from "next/image";
import Link from "next/link";
import { Camera, Stethoscope, Send, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/triage/severity-badge";

const STEPS = [
  {
    Icon: Camera,
    title: "Snap",
    body: "Photo + drop-pin location. No app install, no account required.",
  },
  {
    Icon: Stethoscope,
    title: "Triage",
    body: "Agents ID the species and score injury severity 1–5.",
  },
  {
    Icon: Send,
    title: "Dispatch",
    body: "Referral auto-sent to the nearest licensed rehabber.",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-10 px-5 py-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/terra-triage-logo.svg"
            alt=""
            width={40}
            height={40}
            className="text-primary"
            priority
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Terra Triage</h1>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Wildlife Dispatch Console
            </p>
          </div>
        </div>

        <p className="text-base leading-relaxed text-foreground/90">
          Snap a photo of an injured wild animal and a multi-agent system identifies
          the species, triages the injury, and dispatches the referral to the nearest
          licensed rehabber in under 60 seconds.
        </p>

        <Link href="/report" className="w-full">
          <Button
            size="lg"
            className="h-12 w-full gap-2 text-base transition-colors motion-reduce:transition-none"
          >
            Report an animal
            <ArrowRight aria-hidden="true" />
          </Button>
        </Link>
      </header>

      <section aria-labelledby="how-it-works" className="flex flex-col gap-4">
        <h2
          id="how-it-works"
          className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          How it works
        </h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map(({ Icon, title, body }, i) => (
            <li
              key={title}
              className="flex gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
                aria-hidden="true"
              >
                <Icon className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span>{title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="severity-preview" className="flex flex-col gap-3">
        <h2
          id="severity-preview"
          className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          Dispatcher severity scale
        </h2>
        <div className="flex flex-wrap gap-2">
          <SeverityBadge severity={2} />
          <SeverityBadge severity={4} />
          <SeverityBadge severity={5} />
        </div>
        <p className="text-xs text-muted-foreground">
          Every case gets a 1–5 score. Sev 4+ triggers immediate dispatch.
        </p>
      </section>

      <footer className="mt-auto border-t border-border pt-5 text-xs text-muted-foreground">
        Not veterinary advice. When in doubt, call - don&apos;t carry.
      </footer>
    </main>
  );
}
