-- Explicit sender-chosen reveal scope for card shares.
-- 'full' (default) = masked number + tap-to-reveal full PAN + expiry (never CVV).
-- 'last_four_only' = last 4 + expiry only; no full-number reveal affordance.
-- Existing rows default to 'full' so previously-created shares regain full reveal
-- once the viewer reads reveal_scope / cardNumber correctly.

alter table public.card_shares
  add column if not exists reveal_scope text not null default 'full'
  check (reveal_scope in ('full', 'last_four_only'));

comment on column public.card_shares.reveal_scope is
  'Sender-chosen share scope: full (tap-to-reveal PAN) or last_four_only. Never defaults to restricted without an explicit choice at create time.';
