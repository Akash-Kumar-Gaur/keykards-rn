-- InWallet Phase 3 — Track engine.
-- transactions + points_ledger (RLS from day one), catalog policy fields,
-- card renewal fields, gmail connection metadata, raw_text retention purge.

-- ---------------------------------------------------------------------------
-- cards — renewal / opened tracking
-- ---------------------------------------------------------------------------

alter table public.cards
  add column if not exists renewal_date_estimated date,
  add column if not exists renewal_date_confirmed date,
  add column if not exists card_opened_approx text;

-- ---------------------------------------------------------------------------
-- card_catalog — public policy fields (not inferred)
-- ---------------------------------------------------------------------------

alter table public.card_catalog
  add column if not exists milestone_threshold numeric,
  add column if not exists milestone_period_months int,
  add column if not exists milestone_reward_description text,
  add column if not exists fee_waiver_spend_threshold numeric,
  add column if not exists points_expiry_policy_months int;

do $$ begin
  alter table public.card_catalog
    add constraint card_catalog_milestone_period_check
    check (milestone_period_months is null or milestone_period_months > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.card_catalog
    add constraint card_catalog_points_expiry_months_check
    check (points_expiry_policy_months is null or points_expiry_policy_months > 0);
exception when duplicate_object then null; end $$;

-- Seed policy hints for banks already common in Vault / catalog seed.
update public.card_catalog set
  milestone_threshold = coalesce(milestone_threshold, 150000),
  milestone_period_months = coalesce(milestone_period_months, 3),
  milestone_reward_description = coalesce(
    milestone_reward_description,
    'Quarterly milestone reward'
  ),
  fee_waiver_spend_threshold = coalesce(fee_waiver_spend_threshold, 150000),
  points_expiry_policy_months = coalesce(points_expiry_policy_months, 24)
where bank_name ilike '%hdfc%';

update public.card_catalog set
  milestone_threshold = coalesce(milestone_threshold, 100000),
  milestone_period_months = coalesce(milestone_period_months, 12),
  milestone_reward_description = coalesce(
    milestone_reward_description,
    'Annual milestone reward'
  ),
  fee_waiver_spend_threshold = coalesce(fee_waiver_spend_threshold, 200000),
  points_expiry_policy_months = coalesce(points_expiry_policy_months, 24)
where bank_name ilike '%sbi%';

update public.card_catalog set
  milestone_threshold = coalesce(milestone_threshold, 100000),
  milestone_period_months = coalesce(milestone_period_months, 12),
  milestone_reward_description = coalesce(
    milestone_reward_description,
    'EDGE milestone reward'
  ),
  fee_waiver_spend_threshold = coalesce(fee_waiver_spend_threshold, 150000),
  points_expiry_policy_months = coalesce(points_expiry_policy_months, 36)
where bank_name ilike '%axis%';

update public.card_catalog set
  milestone_threshold = coalesce(milestone_threshold, 200000),
  milestone_period_months = coalesce(milestone_period_months, 12),
  milestone_reward_description = coalesce(
    milestone_reward_description,
    'Payback / milestone reward'
  ),
  fee_waiver_spend_threshold = coalesce(fee_waiver_spend_threshold, 150000),
  points_expiry_policy_months = coalesce(points_expiry_policy_months, 24)
where bank_name ilike '%icici%';

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid references public.cards (id) on delete set null,
  amount numeric not null,
  merchant_raw text not null default '',
  merchant_normalized text,
  transaction_date date not null,
  source text not null,
  source_confidence text not null,
  status text not null default 'pending',
  transaction_type text not null default 'debit',
  points_amount integer,
  points_expiry_date date,
  raw_text text,
  raw_text_expires_at timestamptz,
  auto_finalize_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_source_check check (
    source in ('gmail', 'clipboard', 'ocr', 'manual')
  ),
  constraint transactions_confidence_check check (
    source_confidence in ('high', 'medium', 'low')
  ),
  constraint transactions_status_check check (
    status in ('pending', 'confirmed', 'dismissed')
  ),
  constraint transactions_type_check check (
    transaction_type in (
      'debit',
      'credit',
      'points_credit',
      'points_expiry_notice',
      'annual_fee_debit'
    )
  )
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_card_id_idx on public.transactions (card_id);
create index if not exists transactions_date_idx on public.transactions (transaction_date);
create index if not exists transactions_status_idx on public.transactions (status);
create index if not exists transactions_raw_expires_idx
  on public.transactions (raw_text_expires_at)
  where raw_text is not null;

alter table public.transactions enable row level security;

do $$ begin
  create policy "transactions_select_own" on public.transactions
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "transactions_insert_own" on public.transactions
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "transactions_update_own" on public.transactions
    for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "transactions_delete_own" on public.transactions
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- points_ledger
-- ---------------------------------------------------------------------------

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  points_amount integer not null,
  earn_date date not null,
  expiry_date date,
  expiry_date_source text,
  source text not null,
  created_at timestamptz not null default now(),
  constraint points_ledger_source_check check (
    source in ('gmail', 'clipboard', 'ocr', 'manual')
  ),
  constraint points_ledger_expiry_source_check check (
    expiry_date_source is null
    or expiry_date_source in ('parsed_email', 'estimated_policy')
  )
);

create index if not exists points_ledger_user_id_idx on public.points_ledger (user_id);
create index if not exists points_ledger_card_id_idx on public.points_ledger (card_id);
create index if not exists points_ledger_expiry_idx on public.points_ledger (expiry_date);

alter table public.points_ledger enable row level security;

do $$ begin
  create policy "points_ledger_select_own" on public.points_ledger
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "points_ledger_insert_own" on public.points_ledger
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "points_ledger_update_own" on public.points_ledger
    for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "points_ledger_delete_own" on public.points_ledger
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- gmail_connections — opt-in OAuth metadata (tokens never logged)
-- ---------------------------------------------------------------------------

create table if not exists public.gmail_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  status text not null default 'connected',
  -- Refresh token stored encrypted client-side or via Edge Function vault;
  -- column holds opaque ciphertext only when using app-managed storage.
  refresh_token_encrypted text,
  email_address text,
  updated_at timestamptz not null default now(),
  constraint gmail_connections_status_check check (
    status in ('connected', 'revoked', 'error')
  )
);

alter table public.gmail_connections enable row level security;

do $$ begin
  create policy "gmail_connections_select_own" on public.gmail_connections
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "gmail_connections_insert_own" on public.gmail_connections
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "gmail_connections_update_own" on public.gmail_connections
    for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "gmail_connections_delete_own" on public.gmail_connections
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

drop trigger if exists gmail_connections_set_updated_at on public.gmail_connections;
create trigger gmail_connections_set_updated_at
  before update on public.gmail_connections
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Retention: purge raw_text older than retention window (default 30 days)
-- Call from Edge Function cron: select public.purge_transaction_raw_text();
-- ---------------------------------------------------------------------------

create or replace function public.purge_transaction_raw_text()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged integer;
begin
  update public.transactions
  set raw_text = null
  where raw_text is not null
    and (
      raw_text_expires_at is not null and raw_text_expires_at <= now()
      or created_at <= now() - interval '30 days'
    );
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on function public.purge_transaction_raw_text() from public;
grant execute on function public.purge_transaction_raw_text() to service_role;
