"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Outcome } from "@/lib/memory/helpers";

import { submitOutcome, type SubmitOutcomeResult } from "./actions";

const OPTIONS: ReadonlyArray<{ value: Outcome; label: string; hint: string }> =
  [
    {
      value: "accepted",
      label: "I can take this case",
      hint: "Finder will be told you're taking over.",
    },
    {
      value: "declined",
      label: "Decline",
      hint: "Other rehabbers may still accept.",
    },
    {
      value: "transferred",
      label: "Transferred to another rehabber",
      hint: "I'll handle re-routing off-platform.",
    },
    {
      value: "closed",
      label: "Close (no action needed)",
      hint: "e.g. animal already released or dead on arrival.",
    },
  ];

export function OutcomeForm({
  token,
  initialOutcome,
}: {
  token: string;
  initialOutcome?: Outcome;
}) {
  const [selected, setSelected] = useState<Outcome | undefined>(initialOutcome);

  const [state, formAction, pending] = useActionState<
    SubmitOutcomeResult | null,
    FormData
  >(async (_prev, formData) => {
    return submitOutcome(token, formData);
  }, null);

  return (
    <form action={formAction} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Your decision</legend>
        <div className="grid gap-2">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-foreground/10 p-3 hover:bg-muted/50 has-[:checked]:border-foreground/40 has-[:checked]:bg-muted"
            >
              <input
                type="radio"
                name="outcome"
                value={opt.value}
                required
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="mt-1"
              />
              <span className="flex flex-col">
                <span className="font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">
                  {opt.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="species_correction" className="text-sm font-medium">
          Species correction (optional)
        </label>
        <input
          id="species_correction"
          name="species_correction"
          type="text"
          placeholder="e.g. Cooper's hawk"
          className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          If the Finder agent misidentified the animal, enter the correct
          species - this improves future ranking.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm"
          placeholder="Anything the finder should know."
        />
      </div>

      <div
        aria-live="polite"
        role="status"
        className="min-h-[1.25rem] text-sm"
      >
        {state && !state.ok ? (
          <span className="text-destructive">
            {state.code === "ALREADY_SUBMITTED"
              ? "This link has already been used."
              : state.code === "EXPIRED"
                ? "This link has expired."
                : state.code === "INVALID_TOKEN"
                  ? "Invalid link."
                  : (state.message ?? "Something went wrong.")}
          </span>
        ) : null}
      </div>

      <Button type="submit" disabled={pending || !selected} className="w-full">
        {pending ? "Submitting…" : "Submit outcome"}
      </Button>
    </form>
  );
}
