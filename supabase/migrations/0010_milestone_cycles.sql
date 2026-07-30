-- InWallet Phase 3+ — milestone cycle history + atomic reset helper.
-- Archives the active card_milestones cycle before resetting spend/period.

do $$ begin
  create type public.milestone_closed_reason as enum (
    'auto_renewal',
    'manual_reset',
    'period_expired'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.milestone_cycles (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.card_milestones (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  final_spend numeric not null default 0,
  target_spend numeric not null,
  was_achieved boolean not null default false,
  closed_reason public.milestone_closed_reason not null,
  closed_at timestamptz not null default now(),
  constraint milestone_cycles_spend_check check (
    final_spend >= 0 and target_spend >= 0
  )
);

create index if not exists milestone_cycles_milestone_id_idx
  on public.milestone_cycles (milestone_id);

create index if not exists milestone_cycles_closed_at_idx
  on public.milestone_cycles (closed_at desc);

alter table public.milestone_cycles enable row level security;

do $$ begin
  create policy "milestone_cycles_select_own" on public.milestone_cycles
    for select using (
      exists (
        select 1
        from public.card_milestones m
        join public.cards c on c.id = m.card_id
        where m.id = milestone_id and c.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "milestone_cycles_insert_own" on public.milestone_cycles
    for insert with check (
      exists (
        select 1
        from public.card_milestones m
        join public.cards c on c.id = m.card_id
        where m.id = milestone_id and c.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- No update/delete policies: cycles are append-only historical records.

/**
 * Archive every active milestone on a card, then open a fresh cycle.
 * p_period_months shifts period_end = today + months (from catalog / caller).
 */
create or replace function public.reset_card_milestones(
  p_card_id uuid,
  p_closed_reason public.milestone_closed_reason,
  p_period_months integer
)
returns setof public.milestone_cycles
language plpgsql
security invoker
as $$
declare
  mil public.card_milestones%rowtype;
  today date := (timezone('utc', now()))::date;
  new_end date;
  archived public.milestone_cycles%rowtype;
  months int := greatest(coalesce(p_period_months, 12), 1);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.cards c
    where c.id = p_card_id and c.user_id = auth.uid()
  ) then
    raise exception 'Card not found or not owned';
  end if;

  new_end := (today + (months || ' months')::interval)::date;

  for mil in
    select * from public.card_milestones where card_id = p_card_id
  loop
    insert into public.milestone_cycles (
      milestone_id,
      period_start,
      period_end,
      final_spend,
      target_spend,
      was_achieved,
      closed_reason,
      closed_at
    )
    values (
      mil.id,
      mil.period_start,
      mil.period_end,
      mil.current_spend,
      mil.target_spend,
      mil.current_spend >= mil.target_spend and mil.target_spend > 0,
      p_closed_reason,
      now()
    )
    returning * into archived;

    update public.card_milestones
    set
      current_spend = 0,
      period_start = today,
      period_end = new_end
    where id = mil.id;

    return next archived;
  end loop;

  return;
end;
$$;

grant execute on function public.reset_card_milestones(uuid, public.milestone_closed_reason, integer)
  to authenticated;
