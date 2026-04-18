-- RRC Supabase schema

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_year int not null check (birth_year between 1989 and 2000),
  total_runs int not null default 0,
  monthly_runs jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


alter table public.members
add column if not exists fee_status jsonb not null default '{}'::jsonb;

alter table public.members
add column if not exists aliases jsonb not null default '[]'::jsonb;

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_year int not null check (birth_year between 1989 and 2000),
  phone text not null,
  message text,
  status text not null default '대기',
  created_at timestamptz not null default now()
);

create table if not exists public.raffle_history (
  id uuid primary key default gen_random_uuid(),
  draw_id text not null unique,
  target_month_key text not null,
  threshold int not null,
  winner_count int not null,
  winners jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);


create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_type text not null,
  attendance_date date not null,
  raw_count int not null default 0,
  matched jsonb not null default '[]'::jsonb,
  unmatched jsonb not null default '[]'::jsonb,
  ambiguous jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);


create table if not exists public.operation_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_name text not null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value)
values ('raffle_config', '{"winter_months":[12,1,2],"winter_threshold":4,"default_threshold":5,"winner_count":4}'::jsonb)
on conflict (key) do nothing;

-- Gallery feature
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  file_path text not null unique,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.member_profiles (
  user_id uuid primary key,
  email text not null,
  name text not null,
  birth_year int not null check (birth_year between 1989 and 2000),
  intro text,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- admin role support
alter table public.member_profiles
add column if not exists role text not null default 'member' check (role in ('member','admin'));



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

create table if not exists public.member_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  author_name text not null,
  author_email text,
  title text not null,
  content text not null,
  status text not null default 'submitted' check (status in ('submitted','under_review','planned','completed','rejected')),
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
