-- KeyKards Phase 2 — Vault data model.
-- Extends public.cards with encrypted PAN/CVV + display metadata.
-- Adds card_benefits and card_milestones (RLS via owning card's user_id).
-- Never stores plaintext card_number or cvv outside *_encrypted columns.

-- ---------------------------------------------------------------------------
-- cards — extend scaffold
-- ---------------------------------------------------------------------------

alter table public.cards
  add column if not exists nickname text,
  add column if not exists bank_name text,
  add column if not exists network text,
  add column if not exists last_four text,
  add column if not exists card_number_encrypted text,
  add column if not exists card_number_iv text,
  add column if not exists card_number_auth_tag text,
  add column if not exists cvv_encrypted text,
  add column if not exists cvv_iv text,
  add column if not exists cvv_auth_tag text,
  add column if not exists expiry_month int,
  add column if not exists expiry_year int,
  add column if not exists card_color_theme text,
  add column if not exists annual_fee numeric,
  add column if not exists fee_due_date date;

-- Carry Phase 1 display_name into nickname where nickname is empty.
update public.cards
set nickname = coalesce(nullif(nickname, ''), display_name, 'Card')
where nickname is null or nickname = '';

-- Network enum constraint (Visa / Mastercard / RuPay / Amex / Diners)
do $$ begin
  alter table public.cards
    add constraint cards_network_check
    check (
      network is null
      or network in ('Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cards
    add constraint cards_expiry_month_check
    check (expiry_month is null or (expiry_month >= 1 and expiry_month <= 12));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cards
    add constraint cards_expiry_year_check
    check (expiry_year is null or (expiry_year >= 2000 and expiry_year <= 2100));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cards
    add constraint cards_last_four_check
    check (last_four is null or last_four ~ '^[0-9]{4}$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cards
    add constraint cards_color_theme_check
    check (
      card_color_theme is null
      or card_color_theme in (
        'indigo', 'midnight', 'obsidian', 'slate', 'emerald', 'amber'
      )
    );
exception when duplicate_object then null; end $$;

-- Drop legacy non-sensitive display_name (replaced by nickname).
alter table public.cards drop column if exists display_name;

-- ---------------------------------------------------------------------------
-- card_benefits
-- ---------------------------------------------------------------------------

create table if not exists public.card_benefits (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  title text not null,
  category text not null,
  description text not null default '',
  value_estimate numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_benefits_category_check check (
    category in (
      'lounge', 'dining', 'travel', 'shopping', 'fuel', 'entertainment', 'other'
    )
  )
);

create index if not exists card_benefits_card_id_idx on public.card_benefits (card_id);

alter table public.card_benefits enable row level security;

do $$ begin
  create policy "card_benefits_select_own" on public.card_benefits
    for select using (
      exists (
        select 1 from public.cards c
        where c.id = card_id and c.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "card_benefits_insert_own" on public.card_benefits
    for insert with check (
      exists (
        select 1 from public.cards c
        where c.id = card_id and c.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "card_benefits_update_own" on public.card_benefits
    for update using (
      exists (
        select 1 from public.cards c
        where c.id = card_id and c.user_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from public.cards c
        where c.id = card_id and c.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "card_benefits_delete_own" on public.card_benefits
    for delete using (
      exists (
        select 1 from public.cards c
        where c.id = card_id and c.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

drop trigger if exists card_benefits_set_updated_at on public.card_benefits;
create trigger card_benefits_set_updated_at
  before update on public.card_benefits
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- card_milestones
-- ---------------------------------------------------------------------------

create table if not exists public.card_milestones (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  target_spend numeric not null,
  current_spend numeric not null default 0,
  reward_description text not null default '',
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_milestones_spend_check check (
    target_spend >= 0 and current_spend >= 0
  )
);

create index if not exists card_milestones_card_id_idx on public.card_milestones (card_id);

alter table public.card_milestones enable row level security;

do $$ begin
  create policy "card_milestones_select_own" on public.card_milestones
    for select using (
      exists (
        select 1 from public.cards c
        where c.id = card_id and c.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "card_milestones_insert_own" on public.card_milestones
    for insert with check (
      exists (
        select 1 from public.cards c
        where c.id = card_id and c.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "card_milestones_update_own" on public.card_milestones
    for update using (
      exists (
        select 1 from public.cards c
        where c.id = card_id and c.user_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from public.cards c
        where c.id = card_id and c.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "card_milestones_delete_own" on public.card_milestones
    for delete using (
      exists (
        select 1 from public.cards c
        where c.id = card_id and c.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

drop trigger if exists card_milestones_set_updated_at on public.card_milestones;
create trigger card_milestones_set_updated_at
  before update on public.card_milestones
  for each row
  execute function public.set_updated_at();
