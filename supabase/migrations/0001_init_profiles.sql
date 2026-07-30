-- InWallet — initial schema: profiles.
--
-- SECURITY: Row Level Security is enabled on this table from its FIRST
-- migration (never bolted on retroactively). Every policy is scoped to the
-- authenticated owner via auth.uid(). For `profiles`, the primary key `id` IS
-- the user id (references auth.users), so ownership is auth.uid() = id — the
-- direct equivalent of the "auth.uid() = user_id" rule used for all other
-- (future) per-user tables.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS immediately, before any data can exist.
alter table public.profiles enable row level security;

-- Owners may read their own profile.
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Owners may insert their own profile row.
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Owners may update their own profile.
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Owners may delete their own profile.
create policy "profiles_delete_own"
  on public.profiles
  for delete
  using (auth.uid() = id);

-- Keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
