"use client";

import dynamic from "next/dynamic";
import type { Ranked } from "@/lib/agents/rank";

// Leaflet touches `window` at import time, so we defer the entire inner map
// to a client-only dynamic import. Keeps Next.js SSR/build happy.
const RehabberMapInner = dynamic(() => import("./rehabber-map-inner"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-label="Loading map"
      className="flex h-[360px] w-full items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground"
    >
      Loading map…
    </div>
  ),
});

export interface RehabberMapProps {
  finder: { lat: number; lng: number };
  ranked: Ranked[];
  className?: string;
}

export function RehabberMap(props: RehabberMapProps) {
  return <RehabberMapInner {...props} />;
}

export default RehabberMap;
