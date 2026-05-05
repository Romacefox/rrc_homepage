-- Expand RRC birth year policy to 1989-2004 on existing Supabase tables.

alter table public.members
  drop constraint if exists members_birth_year_check,
  add constraint members_birth_year_check check (birth_year between 1989 and 2004);

alter table public.guests
  drop constraint if exists guests_birth_year_check,
  add constraint guests_birth_year_check check (birth_year between 1989 and 2004);

alter table public.member_profiles
  drop constraint if exists member_profiles_birth_year_check,
  add constraint member_profiles_birth_year_check check (birth_year between 1989 and 2004);
