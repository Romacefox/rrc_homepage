-- Minimal production patch for gallery comments/likes and running hub
-- Run in Supabase SQL Editor, top to bottom.

create extension if not exists pgcrypto;

create table if not exists public.running_hub_posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid,
  author_name text not null,
  category text not null default 'tip' check (category in ('route','tip','checklist','story')),
  title text not null,
  summary text,
  content text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.photo_likes (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (photo_id, user_id)
);

create table if not exists public.running_hub_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.running_hub_posts(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.running_hub_posts enable row level security;
alter table public.photo_comments enable row level security;
alter table public.photo_likes enable row level security;
alter table public.running_hub_likes enable row level security;

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

drop policy if exists "public read photo likes" on public.photo_likes;
create policy "public read photo likes" on public.photo_likes
for select using (true);

drop policy if exists "member insert own photo likes" on public.photo_likes;
create policy "member insert own photo likes" on public.photo_likes
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "member delete own photo likes" on public.photo_likes;
create policy "member delete own photo likes" on public.photo_likes
for delete to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "public read running hub likes" on public.running_hub_likes;
create policy "public read running hub likes" on public.running_hub_likes
for select using (true);

drop policy if exists "member insert own running hub likes" on public.running_hub_likes;
create policy "member insert own running hub likes" on public.running_hub_likes
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "member delete own running hub likes" on public.running_hub_likes;
create policy "member delete own running hub likes" on public.running_hub_likes
for delete to authenticated
using (auth.uid() = user_id or public.is_admin());
