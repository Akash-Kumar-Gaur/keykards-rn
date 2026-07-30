-- Prefer signup metadata full_name for profiles.display_name.
-- Do not auto-fill from email local-part — that blocked "missing name" detection
-- and made Home/Account treat a placeholder as a real name.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text;
begin
  meta_name := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'display_name',
        ''
      )
    ),
    ''
  );

  insert into public.profiles (id, display_name)
  values (new.id, meta_name)
  on conflict (id) do nothing;

  return new;
end;
$$;
