-- Catalog-first product surfaces: manual benefit checklist + purchase logs.
-- No transaction pipeline required.

-- ---------------------------------------------------------------------------
-- benefit_checklist_checks — manual "used this period" ticks
-- ---------------------------------------------------------------------------

create table if not exists public.benefit_checklist_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  benefit_id uuid not null references public.card_benefits (id) on delete cascade,
  -- Calendar period key, e.g. '2026-Q3' (quarter) or '2026-07' (month).
  period_key text not null,
  checked_at timestamptz not null default now(),
  constraint benefit_checklist_unique unique (user_id, benefit_id, period_key)
);

create index if not exists benefit_checklist_user_period_idx
  on public.benefit_checklist_checks (user_id, period_key);

create index if not exists benefit_checklist_card_idx
  on public.benefit_checklist_checks (card_id);

alter table public.benefit_checklist_checks enable row level security;

create policy benefit_checklist_select_own
  on public.benefit_checklist_checks for select
  using (auth.uid() = user_id);

create policy benefit_checklist_insert_own
  on public.benefit_checklist_checks for insert
  with check (auth.uid() = user_id);

create policy benefit_checklist_delete_own
  on public.benefit_checklist_checks for delete
  using (auth.uid() = user_id);

comment on table public.benefit_checklist_checks is
  'Manual benefit usage ticks for the current period — user-controlled, no parsing.';

-- ---------------------------------------------------------------------------
-- purchase_protection_logs — manual purchase lookup against catalog terms
-- ---------------------------------------------------------------------------

create table if not exists public.purchase_protection_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  item_name text not null,
  purchase_date date not null,
  price numeric not null check (price >= 0),
  notes text,
  matched_benefit_title text,
  matched_benefit_summary text,
  created_at timestamptz not null default now()
);

create index if not exists purchase_protection_user_idx
  on public.purchase_protection_logs (user_id, created_at desc);

alter table public.purchase_protection_logs enable row level security;

create policy purchase_protection_select_own
  on public.purchase_protection_logs for select
  using (auth.uid() = user_id);

create policy purchase_protection_insert_own
  on public.purchase_protection_logs for insert
  with check (auth.uid() = user_id);

create policy purchase_protection_delete_own
  on public.purchase_protection_logs for delete
  using (auth.uid() = user_id);

comment on table public.purchase_protection_logs is
  'Manual purchase entries checked against catalog purchase-protection wording.';
