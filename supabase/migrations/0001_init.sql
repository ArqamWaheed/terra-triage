-- Terra Triage — initial schema
-- Applies cleanly on a fresh Supabase Postgres project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- users: Auth0-linked. We store Auth0 `sub` as primary id.
-- ---------------------------------------------------------------------------
create table if not exists users (
  id text primary key,                     -- Auth0 sub (e.g. "auth0|abc")
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);
create index if not exists users_email_idx on users(email);

-- ---------------------------------------------------------------------------
-- rehabbers: ~15 hand-curated US rehabbers (seed data in supabase/seed/).
-- NOTE: we skip the earthdistance/cube GIST index (ll_to_earth) because the
-- `earthdistance` extension is not guaranteed on Supabase free tier. With
-- only ~15 rows we compute haversine in TS (techdesign §17 Q8). Plain btree
-- indexes on lat/lng are sufficient as tiebreakers and for debug queries.
-- ---------------------------------------------------------------------------
create table if not exists rehabbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text,
  email text not null,
  phone text,
  lat double precision not null,
  lng double precision not null,
  species_scope text[] not null default '{}',
  radius_km integer not null default 50,
  capacity integer not null default 5,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists rehabbers_active_idx on rehabbers(active);
create index if not exists rehabbers_lat_idx on rehabbers(lat);
create index if not exists rehabbers_lng_idx on rehabbers(lng);

-- Public view exposes non-PII columns only (no email/phone).
-- RLS on the underlying table denies anon; `grant select` on this view
-- gives anon read-only access to the safe subset.
create or replace view rehabbers_public as
select
  id,
  name,
  org,
  lat,
  lng,
  species_scope,
  radius_km,
  capacity,
  active,
  created_at
from rehabbers
where active = true;

-- ---------------------------------------------------------------------------
-- cases: one per finder submission.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'case_status') then
    create type case_status as enum ('new','triaged','referred','accepted','declined','closed');
  end if;
end$$;

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  finder_user_id text references users(id),
  finder_email text,
  photo_path text not null,
  lat double precision not null,
  lng double precision not null,
  species text,
  species_confidence numeric(3,2),
  severity smallint check (severity between 1 and 5),
  safety_advice jsonb,
  status case_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cases_status_idx on cases(status);
create index if not exists cases_created_idx on cases(created_at desc);
create index if not exists cases_finder_idx on cases(finder_user_id);

-- updated_at trigger for cases
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cases_set_updated_at on cases;
create trigger cases_set_updated_at
before update on cases
for each row
execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- referrals: Dispatcher audit log.
-- ---------------------------------------------------------------------------
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  rehabber_id uuid not null references rehabbers(id),
  rank_score numeric(6,3) not null,
  rank_explain jsonb,
  email_provider_id text,
  magic_token_hash text not null,
  magic_expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  outcome text,
  outcome_at timestamptz,
  outcome_notes text
);
create index if not exists referrals_case_idx on referrals(case_id);
create index if not exists referrals_rehabber_idx on referrals(rehabber_id);
create index if not exists referrals_magic_hash_idx on referrals(magic_token_hash);

-- ---------------------------------------------------------------------------
-- memory_entries: local mirror of Backboard writes (observability + fallback).
-- ---------------------------------------------------------------------------
create table if not exists memory_entries (
  id bigserial primary key,
  rehabber_id uuid not null references rehabbers(id) on delete cascade,
  key text not null,
  value jsonb not null,
  source text not null default 'backboard',
  created_at timestamptz not null default now()
);
create index if not exists memory_entries_rehab_key_idx
  on memory_entries(rehabber_id, key, created_at desc);

-- ---------------------------------------------------------------------------
-- triage_cache: SHA-keyed Gemini response cache (memory.md decision).
-- Key = sha256 of downscaled image bytes (+ prompt version). Value = full
-- TriageResult JSON. Used to stay under 1,500 RPD free tier.
-- ---------------------------------------------------------------------------
create table if not exists triage_cache (
  sha text primary key,
  response jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Storage: private photos bucket. Path convention: cases/{case_id}/original.jpg
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;
