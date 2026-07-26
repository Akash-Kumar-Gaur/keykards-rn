-- Card shares: time-limited, revocable, view-only access to one card's
-- number + expiry (never CVV). share id is a 128-bit random token used in the
-- public link — not a sequential id.
--
-- SUPERSEDED crypto model note: early revisions encrypted the PAN server-side.
-- Current model (see 0019_share_e2e_revoke_legacy.sql): client encrypts under a
-- per-share key embedded in the URL fragment (#k=); the server stores ciphertext
-- only and never holds a usable key. Vault device keys never leave the phone.

create extension if not exists pgcrypto;

create table if not exists public.card_shares (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz,
  max_views int check (max_views is null or max_views > 0),
  view_count int not null default 0 check (view_count >= 0),
  last_viewed_at timestamptz,
  recipient_label text,
  -- Denormalized display fields so recipients never need cards RLS access.
  nickname text not null,
  bank_name text not null,
  network text not null,
  last_four text not null,
  expiry_month int not null check (expiry_month between 1 and 12),
  expiry_year int not null,
  card_color_theme text not null,
  -- Share-scoped PAN ciphertext (never CVV). Client-encrypted under a per-share
  -- key that lives only in the URL fragment; nullable for last_four_only.
  pan_encrypted text not null,
  pan_iv text not null,
  pan_auth_tag text not null,
  constraint card_shares_expiry_window check (
    expires_at > created_at
    and expires_at <= created_at + interval '7 days'
  )
);

create index if not exists card_shares_owner_idx
  on public.card_shares (owner_user_id, created_at desc);
create index if not exists card_shares_card_idx
  on public.card_shares (card_id, created_at desc);

comment on table public.card_shares is
  'Time-limited view-only card shares. CVV is never stored. PAN is share-scoped ciphertext.';
comment on column public.card_shares.revoked_at is
  'Set on manual revoke. Checked on every access before expires_at.';
comment on column public.card_shares.recipient_label is
  'Owner-only note (e.g. Mom). Never shown to recipients.';

create type public.card_share_access_method as enum ('web', 'app');

create table if not exists public.card_share_access_log (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.card_shares (id) on delete cascade,
  accessed_at timestamptz not null default now(),
  access_method public.card_share_access_method not null,
  approximate_location text,
  -- Coarse client fingerprint for rate limiting (hashed IP or similar). Not PII.
  client_fingerprint text
);

create index if not exists card_share_access_log_share_idx
  on public.card_share_access_log (share_id, accessed_at desc);
create index if not exists card_share_access_log_rate_idx
  on public.card_share_access_log (share_id, accessed_at);

comment on table public.card_share_access_log is
  'Audit trail of successful share views. Owner-readable only.';

-- Rate-limit bucket for failed / unknown share_id probes (enumeration defense).
create table if not exists public.card_share_rate_limits (
  fingerprint text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count int not null default 0 check (attempt_count >= 0)
);

-- RLS -----------------------------------------------------------------

alter table public.card_shares enable row level security;
alter table public.card_share_access_log enable row level security;
alter table public.card_share_rate_limits enable row level security;

-- Owners manage their own share rows (list / revoke). Inserts & PAN writes go
-- through the create-card-share edge function (service role).
create policy card_shares_owner_select
  on public.card_shares for select
  using (auth.uid() = owner_user_id);

create policy card_shares_owner_update
  on public.card_shares for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- Owners may soft-delete from their UI; prefer revoke. Hard delete allowed.
create policy card_shares_owner_delete
  on public.card_shares for delete
  using (auth.uid() = owner_user_id);

-- No direct insert from clients — edge function uses service role.

create policy card_share_access_log_owner_select
  on public.card_share_access_log for select
  using (
    exists (
      select 1 from public.card_shares s
      where s.id = share_id and s.owner_user_id = auth.uid()
    )
  );

-- rate_limits / access_log inserts: service role only (no policies for anon/auth insert).

-- Atomic view increment that re-checks revoke/expiry/max_views under a row lock.
-- Returns the share row on success; returns null when unavailable.
create or replace function public.consume_card_share_view(p_share_id uuid)
returns public.card_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.card_shares;
begin
  select * into s
  from public.card_shares
  where id = p_share_id
  for update;

  if not found then
    return null;
  end if;

  -- Revocation checked first, before expiry — must take effect instantly.
  if s.revoked_at is not null then
    return null;
  end if;

  if s.expires_at <= now() then
    return null;
  end if;

  if s.max_views is not null and s.view_count >= s.max_views then
    return null;
  end if;

  update public.card_shares
  set
    view_count = view_count + 1,
    last_viewed_at = now()
  where id = p_share_id
  returning * into s;

  return s;
end;
$$;

revoke all on function public.consume_card_share_view(uuid) from public;
grant execute on function public.consume_card_share_view(uuid) to service_role;
