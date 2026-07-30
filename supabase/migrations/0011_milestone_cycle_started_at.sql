-- InWallet — cycle cutoff so a reset ignores spend that was already archived.
--
-- reset_card_milestones sets period_start = today. Transactions dated today
-- therefore still fall inside the new window, so the live progress derivation
-- immediately re-counted the spend the reset had just archived and the ring
-- never appeared to move. cycle_started_at gives the derivation an instant to
-- compare transactions.created_at against.

alter table public.card_milestones
  add column if not exists cycle_started_at timestamptz;

comment on column public.card_milestones.cycle_started_at is
  'When the active cycle began. Transactions created before this are counted in the archived cycle, not the active one. Null = count everything in the period window.';

create or replace function public.reset_card_milestones(
  p_card_id uuid,
  p_closed_reason public.milestone_closed_reason,
  p_period_months integer
)
returns setof public.milestone_cycles
language plpgsql
security invoker
set search_path = public, pg_temp
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
      period_end = new_end,
      cycle_started_at = now()
    where id = mil.id;

    return next archived;
  end loop;

  return;
end;
$$;

grant execute on function public.reset_card_milestones(uuid, public.milestone_closed_reason, integer)
  to authenticated;

-- Backfill milestones that were reset before this column existed, so their
-- rings clear without the user having to reset a second time.
update public.card_milestones m
set cycle_started_at = latest.closed_at
from (
  select milestone_id, max(closed_at) as closed_at
  from public.milestone_cycles
  group by milestone_id
) latest
where latest.milestone_id = m.id
  and m.cycle_started_at is null;
