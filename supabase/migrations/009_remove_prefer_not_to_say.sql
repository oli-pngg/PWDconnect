update public.profiles
set disability_types = array_remove(disability_types, 'prefer_not_to_say');

alter table public.profiles drop constraint if exists profiles_disability_types_check;
alter table public.profiles add constraint profiles_disability_types_check check (
  disability_types <@ array['visual', 'hearing', 'speech', 'multiple', 'other']::text[]
);
