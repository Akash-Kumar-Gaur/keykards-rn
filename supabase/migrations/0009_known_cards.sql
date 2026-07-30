-- InWallet — card discovery queue (known_cards).
-- Separate from card_catalog: listing crawl finds candidates; extraction fills benefits.

create table if not exists public.known_cards (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  card_name text not null,
  -- Normalized keys for cross-source dedup (e.g. "HDFC Regalia Gold" ==
  -- "HDFC Bank Regalia Gold Credit Card").
  bank_name_norm text not null,
  card_name_norm text not null,
  card_type text not null default 'credit',
  detail_url text not null,
  discovered_from text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  extraction_status text not null default 'pending',
  failure_count integer not null default 0,
  last_error text,
  card_catalog_id uuid references public.card_catalog (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint known_cards_card_type_check check (card_type in ('credit', 'debit')),
  constraint known_cards_extraction_status_check check (
    extraction_status in ('pending', 'extracted', 'failed', 'skipped')
  ),
  constraint known_cards_bank_card_norm_unique unique (bank_name_norm, card_name_norm)
);

create index if not exists known_cards_status_idx
  on public.known_cards (extraction_status, last_seen_at desc);

create index if not exists known_cards_pending_idx
  on public.known_cards (updated_at asc)
  where extraction_status = 'pending';

create index if not exists known_cards_failed_idx
  on public.known_cards (updated_at desc)
  where extraction_status = 'failed';

alter table public.known_cards enable row level security;

do $$ begin
  create policy "known_cards_select_authenticated"
    on public.known_cards for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "known_cards_update_authenticated"
    on public.known_cards for update to authenticated
    using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Service role (worker) bypasses RLS; no public insert from clients.
