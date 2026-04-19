import { notFound } from "next/navigation";

import { getServiceSupabase } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

interface SentEmailLog {
  id: string;
  referral_id: string;
  case_id: string;
  to_email: string;
  subject: string;
  body_html: string;
  body_text: string;
  transport: string;
  message_id: string;
  created_at: string;
}

export default async function DemoInboxPage({
  params,
}: {
  params: Promise<{ referral_id: string }>;
}) {
  const { referral_id } = await params;
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("sent_emails_log")
    .select("*")
    .eq("referral_id", referral_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-lg font-semibold">Demo inbox error</h1>
        <p className="text-sm text-destructive">{error.message}</p>
      </main>
    );
  }
  if (!data) notFound();

  const email = data as SentEmailLog;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
        <strong>Demo mode.</strong> No email left the server. This is the
        captured payload that <em>would have been</em> delivered via Resend.
      </div>
      <header className="space-y-1 rounded-md border bg-muted/30 p-4 text-sm">
        <div>
          <span className="text-muted-foreground">To:</span>{" "}
          <span className="font-mono">{email.to_email}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Subject:</span>{" "}
          <span className="font-medium">{email.subject}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Sent:</span>{" "}
          {new Date(email.created_at).toLocaleString()}
        </div>
        <div>
          <span className="text-muted-foreground">Message id:</span>{" "}
          <span className="font-mono text-xs">{email.message_id}</span>
        </div>
      </header>
      <section className="overflow-hidden rounded-md border bg-background">
        <div
          className="prose prose-sm max-w-none p-4 dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: email.body_html }}
        />
      </section>
    </main>
  );
}
