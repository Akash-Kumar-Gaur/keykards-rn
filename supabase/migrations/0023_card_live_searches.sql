-- Live catalog search: cache + per-user rate limits for search-card-live.

create table if not exists public.card_live_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bank_name text not null,
  card_name text not null,
  bank_name_norm text not null,
  card_name_norm text not null,
  status text not null,
  confidence text,
  result_json jsonb,
  catalog_id uuid references public.card_catalog (id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  constraint card_live_searches_status_check check (
    status in ('success', 'low_confidence', 'not_found', 'failed', 'rate_limited', 'cached')
  )
);

create index if not exists card_live_searches_user_day_idx
  on public.card_live_searches (user_id, created_at desc);

create index if not exists card_live_searches_norm_recent_idx
  on public.card_live_searches (bank_name_norm, card_name_norm, created_at desc);

alter table public.card_live_searches enable row level security;

create policy card_live_searches_select_own
  on public.card_live_searches for select
  using (auth.uid() = user_id);

-- Inserts/updates go through the Edge Function (service role).

comment on table public.card_live_searches is
  'On-demand live catalog searches from Add Card; used for 24h cache + daily rate limits.';
