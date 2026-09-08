alter table public.profiles add column if not exists disability_types text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_disability_types_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_disability_types_check check (
      disability_types <@ array['visual', 'hearing', 'speech', 'multiple', 'other', 'prefer_not_to_say']::text[]
    );
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'candidate');
  safe_role public.user_role := case
    when requested_role = 'employer' then 'employer'::public.user_role
    else 'candidate'::public.user_role
  end;
  safe_disability_types text[] := coalesce(array(
    select value
    from jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'disability_types', '[]'::jsonb)) as value
    where value in ('visual', 'hearing', 'speech', 'multiple', 'other', 'prefer_not_to_say')
  ), '{}');
begin
  insert into public.profiles (id, email, role, full_name, disability_types)
  values (
    new.id,
    coalesce(new.email, ''),
    safe_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    safe_disability_types
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
