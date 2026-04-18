import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getServiceSupabase } from "@/lib/db/supabase";
import type { Case } from "@/lib/db/types";

type Params = Promise<{ id: string }>;

// UUID quick-guard to avoid round-tripping obviously-bogus ids to Postgres.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CasePage({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("cases")
    .select("id,status,lat,lng,photo_path,finder_email,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const c = data as Pick<
    Case,
    "id" | "status" | "lat" | "lng" | "photo_path" | "finder_email" | "created_at"
  >;

  let photoUrl: string | null = null;
  if (c.photo_path) {
    const { data: signed } = await supabase.storage
      .from("photos")
      .createSignedUrl(c.photo_path, 60);
    photoUrl = signed?.signedUrl ?? null;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 py-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Home
      </Link>

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Case {c.id.slice(0, 8)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Thanks — your report is in.
        </h1>
        <p className="text-sm text-muted-foreground">
          Triage pending (Phase 4 will fill this).
        </p>
      </header>

      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="Submitted animal"
          className="aspect-[4/3] w-full rounded-2xl border border-border object-cover"
        />
      ) : (
        <div className="aspect-[4/3] w-full rounded-2xl border border-dashed border-border" />
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Status</dt>
        <dd className="font-medium capitalize">{c.status}</dd>

        <dt className="text-muted-foreground">Location</dt>
        <dd className="inline-flex items-center gap-1.5">
          <MapPin className="size-4" aria-hidden="true" />
          {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
        </dd>

        <dt className="text-muted-foreground">Species</dt>
        <dd className="text-muted-foreground">Pending triage</dd>

        <dt className="text-muted-foreground">Severity</dt>
        <dd className="text-muted-foreground">Pending triage</dd>
      </dl>

      <Button
        type="button"
        size="lg"
        disabled
        aria-disabled="true"
        className="h-12 w-full gap-2"
      >
        <Send className="size-4" aria-hidden="true" />
        Send referral (coming soon)
      </Button>

      <p className="text-xs text-muted-foreground">
        Keep this URL — it&apos;s your only link to this case for now. Phase 6
        will add a tracked, authenticated view.
      </p>
    </main>
  );
}
