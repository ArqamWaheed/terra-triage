"use client";

import { Phone } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Ranked } from "@/lib/agents/rank";

export interface RankedListProps {
  ranked: Ranked[];
  className?: string;
}

function explainTitle(r: Ranked): string {
  const e = r.explain;
  const pct = (n: number) => (n * 100).toFixed(0);
  return [
    `Species match: ${pct(e.speciesMatch)}`,
    `Distance: ${pct(e.distanceScore)} (${e.km.toFixed(1)} km)`,
    `Capacity: ${pct(e.capacityScore)}`,
    `Accept rate: ${pct(e.acceptRate)}`,
    `Response speed: ${pct(e.responseSpeed)}`,
  ].join(" · ");
}

export function RankedList({ ranked, className }: RankedListProps) {
  const top = ranked.slice(0, 3);
  if (top.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active rehabbers available.
      </p>
    );
  }
  return (
    <ol className={cn("flex flex-col gap-3", className)}>
      {top.map((r, i) => {
        const isTop = i === 0;
        const matchPct = Math.round(r.explain.speciesMatch * 100);
        return (
          <li key={r.rehabber.id}>
            <Card
              className={cn(
                isTop && "border-primary ring-2 ring-primary/40",
              )}
              aria-current={isTop ? "true" : undefined}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-base">
                    {i + 1}. {r.rehabber.name}
                  </CardTitle>
                  {r.rehabber.org ? (
                    <p className="text-xs text-muted-foreground">
                      {r.rehabber.org}
                    </p>
                  ) : null}
                </div>
                {isTop ? <Badge>Top match</Badge> : null}
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 pt-0 text-xs">
                <Badge variant="secondary" title={explainTitle(r)}>
                  Score {(r.score * 100).toFixed(0)}
                </Badge>
                <Badge variant="outline">{r.km.toFixed(1)} km</Badge>
                <Badge variant="outline">Species match {matchPct}%</Badge>
                <Badge variant="outline">
                  Capacity {r.rehabber.capacity}
                </Badge>
                {r.rehabber.phone ? (
                  <a
                    href={`tel:${r.rehabber.phone.replace(/[^\d+]/g, "")}`}
                    className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Call ${r.rehabber.org ?? r.rehabber.name}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="size-3.5" aria-hidden="true" />
                    Call
                  </a>
                ) : null}
                <span className="sr-only">{explainTitle(r)}</span>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
