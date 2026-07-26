-- Optional printed name on the card (not the vault nickname / product name).
-- Nullable: add-on cards and users who skip the field stay null — UI must omit
-- the row when unset (never never show "—").

alter table public.cards
  add column if not exists cardholder_name text;

comment on column public.cards.cardholder_name is
  'Optional name printed on the card. Null = omit from UI. Distinct from nickname.';

-- Denormalized onto shares so recipients never need cards RLS.
alter table public.card_shares
  add column if not exists cardholder_name text;

comment on column public.card_shares.cardholder_name is
  'Optional cardholder name copied at share create time; null omitted from viewers.';
