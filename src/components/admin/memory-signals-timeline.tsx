import { Badge } from "@/components/ui/badge";
import type { MemoryEntry } from "@/lib/db/types";

export interface MemorySignalsTimelineProps {
  entries: MemoryEntry[];
  /**
   * Map of rehabber_id -> display label (name or short id). When omitted, the
   * first 8 chars of the rehabber id are rendered.
   */
  rehabberLabels?: Record<string, string>;
  /** Header copy; defaults match the global /admin panel usage. */
  title?: string;
  emptyHint?: string;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const deltaSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const m = Math.round(deltaSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function shortValue(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const json = JSON.stringify(value);
    return json.length > 120 ? `${json.slice(0, 117)}...` : json;
  } catch {
    return String(value);
  }
}

/**
 * Renders a chronological list of Backboard memory signals. Each entry shows
 * key, compacted value, source (backboard vs local_fallback), and relative
 * timestamp. The local_fallback source renders with a warning tone so judges
 * can see when Backboard was unavailable and the local mirror took over.
 */
export function MemorySignalsTimeline({
  entries,
  rehabberLabels,
  title = "Memory signals",
  emptyHint = "No memory signals recorded yet. Signals flow in as rehabbers submit outcomes.",
}: MemorySignalsTimelineProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {entries.length} shown
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => {
            const label =
              rehabberLabels?.[e.rehabber_id] ?? e.rehabber_id.slice(0, 8);
            const isFallback = e.source === "local_fallback";
            return (
              <li
                key={e.id}
                className="rounded-md border border-foreground/10 bg-background p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {label}
                  </span>
                  <Badge variant="secondary">{e.key}</Badge>
                  <Badge variant={isFallback ? "destructive" : "outline"}>
                    {isFallback ? "local_fallback" : e.source}
                  </Badge>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {relativeTime(e.created_at)}
                  </span>
                </div>
                <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 font-mono text-[11px] leading-5">
                  {shortValue(e.value)}
                </pre>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default MemorySignalsTimeline;
