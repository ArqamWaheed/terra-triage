# Terra Triage — Database Setup

One-page guide to apply the Supabase schema, RLS, and seed data.

## 1. Env vars

Copy `.env.example` to `.env.local` and fill in these Supabase keys from your
project's **Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL (safe to expose).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `anon` public key (safe to expose).
- `SUPABASE_URL` — same as above; used by server-only helpers.
- `SUPABASE_SERVICE_ROLE` — **server only**, bypasses RLS. Never commit.

## 2. Apply migrations

Two options.

### Option A — Supabase CLI (preferred)

```bash
# one-time
npm i -g supabase   # or: brew install supabase/tap/supabase

supabase link --project-ref <your-ref>
supabase db push          # applies supabase/migrations/*.sql in order
```

### Option B — SQL editor (no CLI)

1. Open **Supabase Dashboard → SQL Editor**.
2. Paste and run in order:
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_rls.sql`

## 3. Seed rehabbers

Run `supabase/seed/rehabbers.sql` once (CLI: `supabase db execute --file
supabase/seed/rehabbers.sql`, or paste in SQL Editor). Contains 15 demo rows;
safe to re-run idempotently is NOT guaranteed — truncate first if re-seeding.

## 4. Verify

```sql
select count(*) from rehabbers;              -- expect 15
select count(*) from rehabbers_public;       -- expect 15 (active)
select * from storage.buckets where id='photos';
```

## Notes

- The `earthdistance`/`cube` GIST index from techdesign §4 is intentionally
  omitted; haversine is computed in TS over ~15 rows (techdesign §17 Q8).
- `cases.updated_at` is maintained by a `before update` trigger.
- All tables have RLS enabled. Anon/authenticated clients can only read
  `rehabbers_public` and their own `cases`. Everything else runs through
  the service role in Server Actions.
