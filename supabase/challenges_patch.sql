-- Point challenge tables for KakaoTalk verification + admin judging.

create extension if not exists pgcrypto;

create table if not exists public.member_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null,
  creator_name text not null,
  title text not null,
  stake_points int not null default 0,
  start_date date not null,
  end_date date not null,
  verification_tag text,
  kakao_room text not null default 'RRC 카카오톡 채팅방',
  rule_text text not null,
  status text not null default 'submitted' check (status in ('submitted','recruiting','in_progress','judging','settled','cancelled')),
  payout_points int not null default 0,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.member_challenges(id) on delete cascade,
  user_id uuid not null,
  member_name text not null,
  stake_points int not null default 0,
  result text not null default 'joined' check (result in ('joined','success','failed','refunded')),
  payout_points int not null default 0,
  created_at timestamptz not null default now(),
  judged_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create table if not exists public.member_point_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  member_name text not null,
  month_key text not null,
  award_code text not null,
  award_label text not null,
  points int not null default 0,
  note text,
  granted_by_user_id uuid,
  granted_by_name text,
  created_at timestamptz not null default now()
);

alter table public.member_challenges enable row level security;
alter table public.member_challenge_entries enable row level security;
alter table public.member_point_awards enable row level security;

drop policy if exists "approved member read attendance logs" on public.attendance_logs;
create policy "approved member read attendance logs" on public.attendance_logs
for select to authenticated
using (public.is_approved_member());

drop policy if exists "approved member read point awards" on public.member_point_awards;
create policy "approved member read point awards" on public.member_point_awards
for select to authenticated
using (
  public.is_admin()
  or auth.uid() = user_id
  or exists (
    select 1
    from public.member_profiles mp
    where mp.user_id = auth.uid()
      and mp.approval_status = 'approved'
      and lower(replace(mp.name, ' ', '')) = lower(replace(member_name, ' ', ''))
  )
);

drop policy if exists "admin manage point awards" on public.member_point_awards;
create policy "admin manage point awards" on public.member_point_awards
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
