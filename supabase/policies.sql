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

create or replace function public.is_approved_member()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.member_profiles mp
    where mp.user_id = auth.uid()
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


-- Public guest application

drop policy if exists "public insert guests" on public.guests;
create policy "public insert guests" on public.guests
for insert to public
with check (
  birth_year between 1989 and 2000
  and char_length(name) between 1 and 80
  and char_length(phone) between 1 and 40
  and status = '´ë±â'
);
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

drop policy if exists "approved member read members" on public.members;
create policy "approved member read members" on public.members
for select to authenticated
using (public.is_approved_member());

drop policy if exists "auth manage raffle history" on public.raffle_history;
create policy "auth manage raffle history" on public.raffle_history
for all to authenticated
using (public.is_admin())
with check (public.is_admin());


drop policy if exists "auth manage attendance logs" on public.attendance_logs;
create policy "auth manage attendance logs" on public.attendance_logs
for all to authenticated
using (public.is_admin())
with check (public.is_admin());`r`ndrop policy if exists "auth manage settings" on public.settings;
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


drop policy if exists "auth update own pending profile" on public.member_profiles;
create policy "auth update own pending profile" on public.member_profiles
for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and role = 'member'
  and approval_status = 'pending'
);
-- Do not allow users to update their own role/approval_status directly.
-- Admin updates are handled by Netlify function with service role key.

-- Approved-member photo policies

drop policy if exists "approved member upload photo rows" on public.photos;
create policy "approved member upload photo rows" on public.photos
for insert to authenticated
with check (
  public.is_approved_member()
  and auth.uid() = user_id
);

drop policy if exists "approved member delete own photo rows" on public.photos;
create policy "approved member delete own photo rows" on public.photos
for delete to authenticated
using (
  public.is_approved_member()
  and auth.uid() = user_id
);

-- Storage bucket + object policies
insert into storage.buckets (id, name, public)
values ('rrc-photos', 'rrc-photos', true)
on conflict (id) do nothing;

drop policy if exists "public read rrc photos" on storage.objects;
create policy "public read rrc photos" on storage.objects
for select using (bucket_id = 'rrc-photos');

drop policy if exists "approved member upload own folder" on storage.objects;
create policy "approved member upload own folder" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'rrc-photos'
  and public.is_approved_member()
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "approved member delete own folder" on storage.objects;
create policy "approved member delete own folder" on storage.objects
for delete to authenticated
using (
  bucket_id = 'rrc-photos'
  and public.is_approved_member()
  and auth.uid()::text = (storage.foldername(name))[1]
);



alter table public.running_hub_posts enable row level security;

drop policy if exists "public read approved running hub posts" on public.running_hub_posts;
create policy "public read approved running hub posts" on public.running_hub_posts
for select using (status = 'approved');

drop policy if exists "approved member submit running hub posts" on public.running_hub_posts;
create policy "approved member submit running hub posts" on public.running_hub_posts
for insert to authenticated
with check (
  public.is_approved_member()
  and auth.uid() = author_user_id
  and status = 'pending'
  and is_featured = false
);

drop policy if exists "approved member read own pending running hub posts" on public.running_hub_posts;
create policy "approved member read own pending running hub posts" on public.running_hub_posts
for select to authenticated
using (
  status = 'approved'
  or (public.is_approved_member() and auth.uid() = author_user_id)
  or public.is_admin()
);

drop policy if exists "admin manage running hub posts" on public.running_hub_posts;
create policy "admin manage running hub posts" on public.running_hub_posts
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.photo_comments enable row level security;

drop policy if exists "public read photo comments" on public.photo_comments;
create policy "public read photo comments" on public.photo_comments
for select using (true);

drop policy if exists "approved member insert own comments" on public.photo_comments;
create policy "approved member insert own comments" on public.photo_comments
for insert to authenticated
with check (
  public.is_approved_member()
  and auth.uid() = user_id
);

drop policy if exists "approved member delete own comments" on public.photo_comments;
create policy "approved member delete own comments" on public.photo_comments
for delete to authenticated
using (
  public.is_approved_member()
  and auth.uid() = user_id
);

drop policy if exists "admin manage photo comments" on public.photo_comments;
create policy "admin manage photo comments" on public.photo_comments
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
