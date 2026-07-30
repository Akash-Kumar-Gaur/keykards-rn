const fs = require('fs');
const seed = JSON.parse(fs.readFileSync('src/data/cardCatalogSeed.json', 'utf8'));

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function jsonb(v) {
  return `'${esc(JSON.stringify(v))}'::jsonb`;
}

const rows = seed
  .map((c) => {
    const fee = c.default_annual_fee == null ? 'NULL' : c.default_annual_fee;
    return `('${esc(c.bank_name)}', '${esc(c.card_name)}', '${esc(c.network)}', ${jsonb(c.default_benefits)}, ${fee}, '${esc(c.card_color_theme)}')`;
  })
  .join(',\n');

const ddl = `-- InWallet — card_catalog reference data (shared, read-only for authenticated).
-- Seeded from Benefit Radar / modern-react-app products.ts (credit + debit cards).

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

-- No insert/update/delete policies for authenticated — seed via migrations only.

drop trigger if exists card_catalog_set_updated_at on public.card_catalog;
create trigger card_catalog_set_updated_at
  before update on public.card_catalog
  for each row
  execute function public.set_updated_at();

insert into public.card_catalog (bank_name, card_name, network, default_benefits, default_annual_fee, card_color_theme)
values
${rows}
on conflict (bank_name, card_name) do update set
  network = excluded.network,
  default_benefits = excluded.default_benefits,
  default_annual_fee = excluded.default_annual_fee,
  card_color_theme = excluded.card_color_theme;
`;

fs.writeFileSync('supabase/migrations/0004_card_catalog.sql', ddl);
console.log('wrote migration', seed.length, 'cards', ddl.length, 'chars');
