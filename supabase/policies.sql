alter table public.members enable row level security;
alter table public.notices enable row level security;
alter table public.guests enable row level security;
alter table public.raffle_history enable row level security;
alter table public.settings enable row level security;
alter table public.photos enable row level security;
alter table public.member_profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.member_profiles mp
    where mp.user_id = auth.uid()
      and mp.role = 'admin'
      and mp.approval_status = 'approved'
  );
$$;

-- Public read

drop policy if exists "public read notices" on public.notices;
create policy "public read notices" on public.notices
for select using (true);

drop policy if exists "public read raffle history" on public.raffle_history;
create policy "public read raffle history" on public.raffle_history
for select using (true);

drop policy if exists "public read photos" on public.photos;
create policy "public read photos" on public.photos
for select using (true);

-- Admin-only manage policies

drop policy if exists "auth manage notices" on public.notices;
create policy "auth manage notices" on public.notices
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "auth manage guests" on public.guests;
create policy "auth manage guests" on public.guests
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "auth manage members" on public.members;
create policy "auth manage members" on public.members
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "auth manage raffle history" on public.raffle_history;
create policy "auth manage raffle history" on public.raffle_history
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "auth manage settings" on public.settings;
create policy "auth manage settings" on public.settings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Member profile policies

drop policy if exists "auth read own profile" on public.member_profiles;
create policy "auth read own profile" on public.member_profiles
for select to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "auth insert own profile" on public.member_profiles;
create policy "auth insert own profile" on public.member_profiles
for insert to authenticated
with check (auth.uid() = user_id and role = 'member' and approval_status = 'pending');

-- Do not allow users to update their own role/approval_status directly.
-- Admin updates are handled by Netlify function with service role key.

-- Storage bucket + object policies
insert into storage.buckets (id, name, public)
values ('rrc-photos', 'rrc-photos', true)
on conflict (id) do nothing;

drop policy if exists "public read rrc photos" on storage.objects;
create policy "public read rrc photos" on storage.objects
for select using (bucket_id = 'rrc-photos');

drop policy if exists "auth upload own folder" on storage.objects;
create policy "auth upload own folder" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'rrc-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "auth delete own folder" on storage.objects;
create policy "auth delete own folder" on storage.objects
for delete to authenticated
using (
  bucket_id = 'rrc-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);



