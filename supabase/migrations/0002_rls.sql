-- Terra Triage — Row Level Security policies
-- Auth0 JWT is forwarded to Supabase; the Auth0 `sub` claim is available at
-- `auth.jwt() ->> 'sub'`. All service-role traffic bypasses RLS by design.

-- ---------------------------------------------------------------------------
-- users: self-access only.
-- ---------------------------------------------------------------------------
alter table users enable row level security;

drop policy if exists users_self_select on users;
create policy users_self_select on users
  for select
  using (id = auth.jwt() ->> 'sub');

drop policy if exists users_self_update on users;
create policy users_self_update on users
  for update
  using (id = auth.jwt() ->> 'sub')
  with check (id = auth.jwt() ->> 'sub');

-- ---------------------------------------------------------------------------
-- rehabbers: no anon/authenticated access; service role only.
-- Anon/auth clients read the non-PII view `rehabbers_public` instead.
-- ---------------------------------------------------------------------------
alter table rehabbers enable row level security;
-- (no policies = deny all for non-service-role)

revoke all on rehabbers from anon, authenticated;
grant select on rehabbers_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- cases: finder can read their own rows. Writes happen server-side via
-- service role (Server Actions). Anonymous tracking (no finder_user_id)
-- is served through server-side handlers with service role.
-- ---------------------------------------------------------------------------
alter table cases enable row level security;

drop policy if exists cases_finder_select on cases;
create policy cases_finder_select on cases
  for select
  using (
    finder_user_id is not null
    and finder_user_id = auth.jwt() ->> 'sub'
  );

-- ---------------------------------------------------------------------------
-- referrals: service role only.
-- Rehabber outcome page is a server route that validates HMAC magic token
-- and uses service role to read/update. No anon/auth policies.
-- ---------------------------------------------------------------------------
alter table referrals enable row level security;

-- ---------------------------------------------------------------------------
-- memory_entries: service role only.
-- ---------------------------------------------------------------------------
alter table memory_entries enable row level security;

-- ---------------------------------------------------------------------------
-- triage_cache: service role only.
-- ---------------------------------------------------------------------------
alter table triage_cache enable row level security;

-- ---------------------------------------------------------------------------
-- Storage: photos bucket. Private — only service role can insert/select.
-- Clients receive 7-day signed URLs generated server-side (techdesign §11).
-- ---------------------------------------------------------------------------
drop policy if exists photos_service_select on storage.objects;
create policy photos_service_select on storage.objects
  for select to service_role
  using (bucket_id = 'photos');

drop policy if exists photos_service_insert on storage.objects;
create policy photos_service_insert on storage.objects
  for insert to service_role
  with check (bucket_id = 'photos');

drop policy if exists photos_service_update on storage.objects;
create policy photos_service_update on storage.objects
  for update to service_role
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');

drop policy if exists photos_service_delete on storage.objects;
create policy photos_service_delete on storage.objects
  for delete to service_role
  using (bucket_id = 'photos');
