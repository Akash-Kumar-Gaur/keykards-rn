/**
 * Statement PDF import: extend source enum, store category for backfill,
 * persist structured summary only (never the PDF).
 */

-- Allow statement_pdf as a transaction / points_ledger source
alter table public.transactions
  drop constraint if exists transactions_source_check;

alter table public.transactions
  add constraint transactions_source_check
  check (source in ('gmail', 'clipboard', 'ocr', 'manual', 'statement_pdf'));

alter table public.points_ledger
  drop constraint if exists points_ledger_source_check;

alter table public.points_ledger
  add constraint points_ledger_source_check
  check (source in ('gmail', 'clipboard', 'ocr', 'manual', 'statement_pdf'));

-- Merchant category from statements (MCC / LLM). Nullable — SMS/email paths
-- still derive category client-side when this is null.
alter table public.transactions
  add column if not exists category text;

do $$ begin
  alter table public.transactions
    add constraint transactions_category_check
    check (
      category is null
      or category in (
        'lounge', 'dining', 'travel', 'shopping', 'fuel',
        'entertainment', 'other'
      )
    );
exception when duplicate_object then null; end $$;

-- Structured statement summary — no PDF / raw text retention
create table if not exists public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_spend numeric(14, 2) not null default 0,
  minimum_due numeric(14, 2),
  total_due numeric(14, 2),
  reward_points_earned numeric(14, 2),
  reward_points_source text not null default 'estimated'
    check (reward_points_source in ('statement', 'estimated')),
  category_breakdown jsonb not null default '{}'::jsonb,
  notable_transactions jsonb not null default '[]'::jsonb,
  line_item_count integer not null default 0,
  new_txn_count integer not null default 0,
  matched_txn_count integer not null default 0,
  prior_period_spend numeric(14, 2),
  extraction_method text not null default 'pdf_text'
    check (extraction_method in ('pdf_text', 'pdf_document_fallback')),
  created_at timestamptz not null default now()
);

create index if not exists statement_imports_user_card_idx
  on public.statement_imports (user_id, card_id, period_end desc);

alter table public.statement_imports enable row level security;

do $$ begin
  create policy statement_imports_select_own on public.statement_imports
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy statement_imports_insert_own on public.statement_imports
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy statement_imports_delete_own on public.statement_imports
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

comment on table public.statement_imports is
  'CRED-style statement summaries. The uploaded PDF is never stored — only structured extraction results.';
comment on column public.transactions.category is
  'Optional category from statement MCC / LLM; backfills onto matched clipboard/gmail rows when missing.';
