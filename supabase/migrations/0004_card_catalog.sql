-- InWallet — card_catalog reference data (shared, read-only for authenticated).
-- Seed data (22 cards from Benefit Radar products.ts) applied via
-- scripts/seed-batches/*.sql after this DDL. Regenerated from
-- src/data/cardCatalogSeed.json via scripts/gen-seed-batches.cjs.

create table if not exists public.card_catalog (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  card_name text not null,
  network text not null,
  default_benefits jsonb not null default '[]'::jsonb,
  default_annual_fee numeric,
  card_color_theme text not null default 'indigo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_catalog_bank_card_unique unique (bank_name, card_name),
  constraint card_catalog_network_check check (
    network in ('Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners')
  ),
  constraint card_catalog_theme_check check (
    card_color_theme in ('indigo', 'midnight', 'obsidian', 'slate', 'emerald', 'amber')
  )
);

create index if not exists card_catalog_bank_name_idx on public.card_catalog (bank_name);
create index if not exists card_catalog_card_name_idx on public.card_catalog (card_name);

alter table public.card_catalog enable row level security;

do $$ begin
  create policy "card_catalog_select_authenticated" on public.card_catalog
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

drop trigger if exists card_catalog_set_updated_at on public.card_catalog;
create trigger card_catalog_set_updated_at
  before update on public.card_catalog
  for each row
  execute function public.set_updated_at();
