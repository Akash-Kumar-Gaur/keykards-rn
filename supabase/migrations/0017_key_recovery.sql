-- Passphrase-based encryption key recovery.
--
-- ZERO-KNOWLEDGE: the server only ever stores the user's AES data key WRAPPED
-- (encrypted) under a key derived from the user's recovery passphrase via a slow
-- KDF (PBKDF2-HMAC-SHA256). The passphrase and the plaintext data key never
-- reach the server. A full DB breach yields only wrapped_key + salt + params,
-- which are useless without the passphrase.
--
-- Rate limiting is enforced SERVER-SIDE (per user_id) so a client-side-only
-- limit cannot be bypassed: the wrapped material is only handed out through
-- begin_key_recovery(), which refuses while a lockout window is active.

create table if not exists public.key_recovery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  -- Data key encrypted under the passphrase-derived key: `iv.ciphertext.authTag`.
  wrapped_key text not null,
  -- Random per-user KDF salt (base64).
  kdf_salt text not null,
  -- PBKDF2 iteration count used for THIS record. Stored so it can be raised
  -- later (re-wrap on next passphrase change) without breaking old records.
  kdf_iterations int not null check (kdf_iterations >= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.key_recovery is
  'Wrapped AES data key for new-device recovery. Server never sees the passphrase or plaintext key.';
comment on column public.key_recovery.wrapped_key is
  'AES-GCM(dataKey) under a PBKDF2-derived key. Serialized iv.ciphertext.authTag (base64).';
comment on column public.key_recovery.kdf_iterations is
  'PBKDF2-HMAC-SHA256 iterations for this record; persisted for future upgrade.';

-- Per-user recovery attempt tracking for server-side rate limiting.
create table if not exists public.key_recovery_attempts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  failed_count int not null default 0 check (failed_count >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.key_recovery_attempts is
  'Server-side brute-force throttle for recovery unwrap attempts (per user).';

-- RLS ---------------------------------------------------------------------

alter table public.key_recovery enable row level security;
alter table public.key_recovery_attempts enable row level security;

-- Users may read their own recovery metadata (to know it is configured) and
-- write it during setup / passphrase change. The wrapped material for an actual
-- recovery attempt is fetched via begin_key_recovery() (throttled).
create policy key_recovery_owner_select
  on public.key_recovery for select
  using (auth.uid() = user_id);

create policy key_recovery_owner_insert
  on public.key_recovery for insert
  with check (auth.uid() = user_id);

create policy key_recovery_owner_update
  on public.key_recovery for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy key_recovery_owner_delete
  on public.key_recovery for delete
  using (auth.uid() = user_id);

-- attempts table: no direct client policies. Only the security-definer RPCs
-- below touch it, always scoped to auth.uid().

-- keep updated_at fresh on key_recovery writes
create or replace function public.touch_key_recovery_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists key_recovery_touch on public.key_recovery;
create trigger key_recovery_touch
  before update on public.key_recovery
  for each row execute function public.touch_key_recovery_updated_at();

-- Throttled fetch of the wrapped material for a recovery attempt.
-- Returns wrapped_key/salt/iterations when allowed; when locked out, returns a
-- single row with is_locked = true and retry_at set (and no secret material).
create or replace function public.begin_key_recovery()
returns table (
  is_locked boolean,
  retry_at timestamptz,
  wrapped_key text,
  kdf_salt text,
  kdf_iterations int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.key_recovery_attempts;
  v_rec public.key_recovery;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_attempt
  from public.key_recovery_attempts
  where user_id = v_uid
  for update;

  if found and v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return query select true, v_attempt.locked_until, null::text, null::text, null::int;
    return;
  end if;

  select * into v_rec from public.key_recovery where user_id = v_uid;
  if not found then
    -- No recovery configured — surface as "not locked, no material".
    return query select false, null::timestamptz, null::text, null::text, null::int;
    return;
  end if;

  return query select false, null::timestamptz, v_rec.wrapped_key, v_rec.kdf_salt, v_rec.kdf_iterations;
end;
$$;

-- Record the outcome of a client-side unwrap attempt. On failure, increments
-- the counter and, after 5 failures, applies exponential backoff. On success,
-- clears the throttle. Returns the next retry_at when a lockout is in effect.
create or replace function public.record_key_recovery_result(p_success boolean)
returns table (failed_count int, locked_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.key_recovery_attempts;
  v_new_count int;
  v_lock timestamptz;
  v_backoff_minutes int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.key_recovery_attempts (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select * into v_attempt
  from public.key_recovery_attempts
  where user_id = v_uid
  for update;

  if p_success then
    update public.key_recovery_attempts
    set failed_count = 0, locked_until = null, window_started_at = now(), updated_at = now()
    where user_id = v_uid;
    return query select 0, null::timestamptz;
    return;
  end if;

  v_new_count := v_attempt.failed_count + 1;

  -- Exponential backoff after the 5th failed attempt: 2^(n-5) minutes, capped.
  if v_new_count >= 5 then
    v_backoff_minutes := least(60 * 24, power(2, v_new_count - 5)::int);
    v_lock := now() + make_interval(mins => v_backoff_minutes);
  else
    v_lock := null;
  end if;

  update public.key_recovery_attempts
  set failed_count = v_new_count, locked_until = v_lock, updated_at = now()
  where user_id = v_uid;

  return query select v_new_count, v_lock;
end;
$$;

revoke all on function public.begin_key_recovery() from public;
revoke all on function public.record_key_recovery_result(boolean) from public;
grant execute on function public.begin_key_recovery() to authenticated;
grant execute on function public.record_key_recovery_result(boolean) to authenticated;
