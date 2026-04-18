import { Eye, Activity, Stethoscope, Siren, AlertOctagon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Severity = 1 | 2 | 3 | 4 | 5;

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost";

type SeverityMeta = {
  label: string;
  variant: BadgeVariant;
  Icon: typeof Eye;
  extraClass?: string;
};

const SEVERITY_MAP: Record<Severity, SeverityMeta> = {
  1: { label: "Observe", variant: "ghost", Icon: Eye },
  2: { label: "Monitor", variant: "secondary", Icon: Activity },
  3: { label: "Triage", variant: "default", Icon: Stethoscope },
  4: {
    label: "Dispatch",
    variant: "default",
    Icon: Siren,
    extraClass: "ring-2 ring-primary/40",
  },
  5: { label: "Critical", variant: "destructive", Icon: AlertOctagon },
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  const { label, variant, Icon, extraClass } = SEVERITY_MAP[severity];
  return (
    <Badge
      variant={variant}
      className={cn("gap-1", extraClass, className)}
      aria-label={`Severity ${severity}: ${label}`}
    >
      <Icon aria-hidden="true" />
      <span>
        Sev {severity} · {label}
      </span>
    </Badge>
  );
}
