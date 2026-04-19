-- 0003_public_phone_and_demo_capture.sql
--
-- Two additions:
--   1. Expose `phone` on rehabbers_public so the top-3 list can render a
--      `tel:` call button. Safe because the entire seed is NANPA-reserved
--      555-01xx fictional numbers (see supabase/seed/rehabbers.sql header).
--   2. `sent_emails_log` table: capture table for DEMO_MODE=1 deploys where
--      we intercept outbound dispatcher email and render it in-app instead
--      of calling Resend. Zero external traffic, service-role-only reads.

-- ---------------------------------------------------------------------------
-- 1. rehabbers_public + phone
-- ---------------------------------------------------------------------------
-- Postgres CREATE OR REPLACE VIEW cannot reorder or rename columns, so we
-- drop and recreate to add `phone` cleanly.
drop view if exists rehabbers_public;
create view rehabbers_public as
select
  id,
  name,
  org,
  phone,
  lat,
  lng,
  species_scope,
  radius_km,
  capacity,
  active,
  created_at
from rehabbers
where active = true;

grant select on rehabbers_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. sent_emails_log (demo-mode capture)
-- ---------------------------------------------------------------------------
create table if not exists sent_emails_log (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid references referrals(id) on delete cascade,
  case_id uuid references cases(id) on delete cascade,
  to_email text not null,
  to_rehabber_id uuid references rehabbers(id),
  subject text not null,
  body_html text not null,
  body_text text,
  transport text not null, -- 'resend' | 'gmail-smtp' | 'demo-capture'
  message_id text,
  created_at timestamptz not null default now()
);

create index if not exists sent_emails_log_referral_idx
  on sent_emails_log(referral_id);
create index if not exists sent_emails_log_case_idx
  on sent_emails_log(case_id);

alter table sent_emails_log enable row level security;
revoke all on sent_emails_log from anon, authenticated;
-- service role bypasses RLS; admin basic-auth reads via getServiceSupabase().
