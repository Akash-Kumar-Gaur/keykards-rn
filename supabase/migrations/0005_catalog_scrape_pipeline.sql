-- KeyKards — catalog scrape pipeline schema.
-- Extends card_catalog for auto/manual provenance; adds catalog_scrape_log.

alter table public.card_catalog
  add column if not exists source text not null default 'manual',
  add column if not exists last_verified_at timestamptz,
  add column if not exists raw_source_url text;

do $$ begin
  alter table public.card_catalog
    add constraint card_catalog_source_check
    check (source in ('auto', 'manual', 'needs_review'));
exception when duplicate_object then null; end $$;

-- Existing seeded rows are curated Benefit Radar data — protect from auto overwrite.
update public.card_catalog
set source = 'manual',
    last_verified_at = coalesce(last_verified_at, now())
where source = 'manual' or source is null or source = '';

create table if not exists public.catalog_scrape_log (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  source_url text,
  bank_name text,
  card_name text,
  status text not null,
  confidence text,
  raw_snippet text,
  proposed_json jsonb,
  error_message text,
  reviewed_at timestamptz,
  reviewed_action text,
  created_at timestamptz not null default now(),
  constraint catalog_scrape_log_status_check check (
    status in ('success', 'parse_failed', 'fetch_failed', 'low_confidence')
  ),
  constraint catalog_scrape_log_confidence_check check (
    confidence is null or confidence in ('high', 'medium', 'low')
  ),
  constraint catalog_scrape_log_action_check check (
    reviewed_action is null
    or reviewed_action in ('approved', 'rejected', 'edited')
  )
);

create index if not exists catalog_scrape_log_status_idx
  on public.catalog_scrape_log (status, run_at desc);

create index if not exists catalog_scrape_log_unreviewed_idx
  on public.catalog_scrape_log (run_at desc)
  where reviewed_at is null and status in ('low_confidence', 'parse_failed', 'fetch_failed');

alter table public.catalog_scrape_log enable row level security;

-- Authenticated can read logs (UI gated by admin email list).
do $$ begin
  create policy "catalog_scrape_log_select_authenticated"
    on public.catalog_scrape_log for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "catalog_scrape_log_update_authenticated"
    on public.catalog_scrape_log for update to authenticated
    using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Service role (worker) bypasses RLS; allow authenticated insert for rare client tools.
do $$ begin
  create policy "catalog_scrape_log_insert_authenticated"
    on public.catalog_scrape_log for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;

-- Allow authenticated upsert into catalog for Approve/Edit flows (UI email-gated).
do $$ begin
  create policy "card_catalog_insert_authenticated"
    on public.card_catalog for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "card_catalog_update_authenticated"
    on public.card_catalog for update to authenticated
    using (true) with check (true);
exception when duplicate_object then null; end $$;
