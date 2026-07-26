-- E2E share model migration (breaking).
-- Old shares used server-side SHARE_MASTER_KEY. That secret is removed; existing
-- ciphertext is unusable. Revoke every share and clear old envelopes so no
-- master-key ciphertext remains.
--
-- Order matters: drop NOT NULL before wiping ciphertext.

alter table public.card_shares
  alter column pan_encrypted drop not null;
alter table public.card_shares
  alter column pan_iv drop not null;
alter table public.card_shares
  alter column pan_auth_tag drop not null;

-- Revoke all currently-active shares.
update public.card_shares
set revoked_at = coalesce(revoked_at, now())
where revoked_at is null;

-- Wipe master-key-era ciphertext (cannot be decrypted without the deleted secret).
update public.card_shares
set
  pan_encrypted = null,
  pan_iv = null,
  pan_auth_tag = null;

comment on table public.card_shares is
  'Time-limited view-only card shares. CVV is never stored. Full-number PANs are client-encrypted under a per-share key that lives only in the URL fragment (#k=); the server stores ciphertext only and never sees plaintext or the key.';

comment on column public.card_shares.pan_encrypted is
  'AES-256-GCM ciphertext of the PAN under a per-share client key (null for last_four_only).';
comment on column public.card_shares.pan_iv is
  'IV for pan_encrypted (null for last_four_only).';
comment on column public.card_shares.pan_auth_tag is
  'Auth tag for pan_encrypted (null for last_four_only).';
