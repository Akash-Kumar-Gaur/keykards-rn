-- InWallet — cards table (Phase 1 scaffold for authenticated Home queries).
--
-- SECURITY: RLS enabled on first migration, scoped to auth.uid() = user_id.
-- Card PAN/CVV fields are intentionally NOT here — those arrive encrypted in
-- Phase 2. This table only holds non-sensitive display metadata so Home can
-- query real rows and show empty states until the user adds cards.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_user_id_idx on public.cards (user_id);

alter table public.cards enable row level security;

do $$ begin
  create policy "cards_select_own" on public.cards for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cards_insert_own" on public.cards for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cards_update_own" on public.cards for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cards_delete_own" on public.cards for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
  before update on public.cards
  for each row
  execute function public.set_updated_at();
