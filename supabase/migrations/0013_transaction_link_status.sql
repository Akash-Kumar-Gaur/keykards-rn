/**
 * Transaction ↔ card linking: never silently drop a confirm when the target
 * card can't be attached yet (e.g. device key needs re-entry / "Needs refresh").
 *
 * - link_status: linked | unmatched | pending_sync
 * - card_hint: jsonb with { last_four, bank_name_guess } for later reconcile
 * - cards.needs_refresh: vault badge + confirm-sheet gate
 */

-- Transaction link status
do $$ begin
  create type public.transaction_link_status as enum (
    'linked',
    'unmatched',
    'pending_sync'
  );
exception when duplicate_object then null; end $$;

alter table public.transactions
  add column if not exists link_status public.transaction_link_status;

alter table public.transactions
  add column if not exists card_hint jsonb;

-- Backfill: existing rows with a card are linked; bare rows are unmatched
-- (no hint to reconcile against). Leave nulls for any race during deploy.
update public.transactions
set link_status = case
  when card_id is not null then 'linked'::public.transaction_link_status
  else 'unmatched'::public.transaction_link_status
end
where link_status is null;

alter table public.transactions
  alter column link_status set default 'unmatched';

alter table public.transactions
  alter column link_status set not null;

create index if not exists transactions_link_status_idx
  on public.transactions (user_id, link_status)
  where link_status in ('pending_sync', 'unmatched');

create index if not exists transactions_card_hint_last4_idx
  on public.transactions ((card_hint ->> 'last_four'))
  where link_status = 'pending_sync' and card_hint is not null;

-- Card sync / refresh flag (device-key recovery). Cleared when PAN is re-encrypted.
alter table public.cards
  add column if not exists needs_refresh boolean not null default false;

comment on column public.transactions.link_status is
  'linked = card_id set; pending_sync = confirmed but waiting for card refresh/reconcile; unmatched = user dismissed auto-link / no hint';
comment on column public.transactions.card_hint is
  'Partial identity at parse/confirm time: { last_four, bank_name_guess }';
comment on column public.cards.needs_refresh is
  'True when ciphertext cannot be decrypted with the current device key — Vault shows Needs refresh';
