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

create table if not exists public.reward_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  requester_name text not null,
  requester_email text,
  reward_code text not null,
  reward_name text not null,
  point_cost int not null default 0,
  note text,
  status text not null default 'submitted' check (status in ('submitted','approved','fulfilled','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.running_hub_posts enable row level security;
alter table public.photo_comments enable row level security;
alter table public.photo_likes enable row level security;
alter table public.running_hub_likes enable row level security;
alter table public.member_suggestions enable row level security;
alter table public.reward_requests enable row level security;

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

drop policy if exists "approved member read suggestions" on public.member_suggestions;
create policy "approved member read suggestions" on public.member_suggestions
for select to authenticated
using (
  public.is_admin()
  or auth.uid() = user_id
  or (public.is_approved_member() and is_anonymous = false and status in ('submitted','under_review','planned','completed'))
);

drop policy if exists "approved member insert own suggestions" on public.member_suggestions;
create policy "approved member insert own suggestions" on public.member_suggestions
for insert to authenticated
with check (
  public.is_approved_member()
  and auth.uid() = user_id
  and status = 'submitted'
);

drop policy if exists "admin manage suggestions" on public.member_suggestions;
create policy "admin manage suggestions" on public.member_suggestions
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "approved member read own reward requests" on public.reward_requests;
create policy "approved member read own reward requests" on public.reward_requests
for select to authenticated
using (public.is_admin() or auth.uid() = user_id);

drop policy if exists "approved member insert own reward requests" on public.reward_requests;
create policy "approved member insert own reward requests" on public.reward_requests
for insert to authenticated
with check (
  public.is_approved_member()
  and auth.uid() = user_id
  and status = 'submitted'
);

drop policy if exists "admin manage reward requests" on public.reward_requests;
create policy "admin manage reward requests" on public.reward_requests
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.admin_attendance_mutation(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := coalesce(payload->>'action', '');
  v_date date;
  v_event_type text;
  v_source text;
  v_log_id uuid;
  v_member_id uuid;
  v_delta integer;
  v_month_key text;
  v_existing_month_key text;
  v_replaced boolean := false;
  v_matched text[] := '{}'::text[];
  v_unmatched text[] := '{}'::text[];
  v_ambiguous text[] := '{}'::text[];
  v_seen_norm text[] := '{}'::text[];
  v_name text;
  v_name_norm text;
  v_exact_count integer;
  v_partial_count integer;
  v_next_total integer;
  v_next_monthly integer;
  v_log record;
  v_conflict record;
  v_member record;
begin
  if v_action = 'adjust_member_attendance' then
    v_member_id := nullif(payload->>'member_id', '')::uuid;
    v_date := nullif(payload->>'date', '')::date;
    v_delta := coalesce((payload->>'delta')::integer, 0);
    if v_member_id is null or v_date is null or v_delta not in (-1, 1) then
      raise exception 'invalid attendance adjustment payload';
    end if;

    v_month_key := to_char(v_date, 'YYYY-MM');
    select * into v_member from public.members where id = v_member_id limit 1;
    if not found then
      raise exception 'member not found';
    end if;

    v_next_total := greatest(0, coalesce(v_member.total_runs, 0) + v_delta);
    v_next_monthly := greatest(0, coalesce((coalesce(v_member.monthly_runs, '{}'::jsonb)->>v_month_key)::integer, 0) + v_delta);

    update public.members
    set total_runs = v_next_total,
        monthly_runs = jsonb_set(coalesce(monthly_runs, '{}'::jsonb), array[v_month_key], to_jsonb(v_next_monthly), true)
    where id = v_member_id;

    return jsonb_build_object('ok', true, 'message', 'attendance adjusted');
  end if;

  if v_action in ('revert_attendance_log', 'replace_attendance_log') then
    v_log_id := nullif(payload->>'log_id', '')::uuid;
    if v_log_id is null then
      raise exception 'missing log_id';
    end if;

    select * into v_log from public.attendance_logs where id = v_log_id limit 1;
    if not found then
      raise exception 'attendance log not found';
    end if;

    v_existing_month_key := to_char(v_log.attendance_date, 'YYYY-MM');
    for v_name in select value from jsonb_array_elements_text(coalesce(v_log.matched, '[]'::jsonb))
    loop
      select * into v_member
      from public.members m
      where lower(replace(coalesce(m.name, ''), ' ', '')) = lower(replace(v_name, ' ', ''))
      limit 1;

      if found then
        v_next_total := greatest(0, coalesce(v_member.total_runs, 0) - 1);
        v_next_monthly := greatest(0, coalesce((coalesce(v_member.monthly_runs, '{}'::jsonb)->>v_existing_month_key)::integer, 0) - 1);

        update public.members
        set total_runs = v_next_total,
            monthly_runs = jsonb_set(coalesce(monthly_runs, '{}'::jsonb), array[v_existing_month_key], to_jsonb(v_next_monthly), true)
        where id = v_member.id;
      end if;
    end loop;

    delete from public.attendance_logs where id = v_log.id;
    v_replaced := true;

    if v_action = 'revert_attendance_log' then
      return jsonb_build_object('ok', true, 'message', 'attendance reverted');
    end if;
  end if;

  if v_action not in ('apply_attendance', 'replace_attendance_log') then
    raise exception 'invalid attendance action';
  end if;

  v_date := nullif(payload->>'date', '')::date;
  v_event_type := coalesce(nullif(payload->>'event_type', ''), '정기런');
  v_source := coalesce(nullif(payload->>'source', ''), 'bulk');
  if v_date is null then
    raise exception 'missing attendance date';
  end if;
  v_month_key := to_char(v_date, 'YYYY-MM');

  if v_action = 'apply_attendance' then
    select * into v_conflict
    from public.attendance_logs
    where attendance_date = v_date
      and event_type = v_event_type
      and source = v_source
    limit 1;

    if found then
      payload := jsonb_set(payload, '{log_id}', to_jsonb(v_conflict.id::text), true);
      return public.admin_attendance_mutation(jsonb_set(payload, '{action}', '"replace_attendance_log"'::jsonb, true));
    end if;
  else
    select * into v_conflict
    from public.attendance_logs
    where id <> v_log_id
      and attendance_date = v_date
      and event_type = v_event_type
      and source = v_source
    limit 1;

    if found then
      perform public.admin_attendance_mutation(jsonb_build_object('action', 'revert_attendance_log', 'log_id', v_conflict.id::text));
      v_replaced := true;
    end if;
  end if;

  for v_name in select value from jsonb_array_elements_text(coalesce(payload->'names', '[]'::jsonb))
  loop
    v_name := btrim(v_name);
    if v_name = '' then
      continue;
    end if;

    v_name_norm := lower(replace(v_name, ' ', ''));
    if v_name_norm = any(v_seen_norm) then
      continue;
    end if;
    v_seen_norm := array_append(v_seen_norm, v_name_norm);

    select count(*)
    into v_exact_count
    from public.members m
    where lower(replace(coalesce(m.name, ''), ' ', '')) = v_name_norm
       or exists (
         select 1
         from jsonb_array_elements_text(coalesce(m.aliases, '[]'::jsonb)) alias_name
         where lower(replace(alias_name, ' ', '')) = v_name_norm
       );

    if v_exact_count = 1 then
      select * into v_member
      from public.members m
      where lower(replace(coalesce(m.name, ''), ' ', '')) = v_name_norm
         or exists (
           select 1
           from jsonb_array_elements_text(coalesce(m.aliases, '[]'::jsonb)) alias_name
           where lower(replace(alias_name, ' ', '')) = v_name_norm
         )
      limit 1;
    elsif v_exact_count > 1 then
      v_ambiguous := array_append(v_ambiguous, v_name);
      continue;
    else
      select count(*)
      into v_partial_count
      from public.members m
      where lower(replace(coalesce(m.name, ''), ' ', '')) like '%' || v_name_norm || '%'
         or v_name_norm like '%' || lower(replace(coalesce(m.name, ''), ' ', '')) || '%';

      if v_partial_count = 1 then
        select * into v_member
        from public.members m
        where lower(replace(coalesce(m.name, ''), ' ', '')) like '%' || v_name_norm || '%'
           or v_name_norm like '%' || lower(replace(coalesce(m.name, ''), ' ', '')) || '%'
        limit 1;
      elsif v_partial_count > 1 then
        v_ambiguous := array_append(v_ambiguous, v_name);
        continue;
      else
        v_unmatched := array_append(v_unmatched, v_name);
        continue;
      end if;
    end if;

    v_next_total := greatest(0, coalesce(v_member.total_runs, 0) + 1);
    v_next_monthly := greatest(0, coalesce((coalesce(v_member.monthly_runs, '{}'::jsonb)->>v_month_key)::integer, 0) + 1);

    update public.members
    set total_runs = v_next_total,
        monthly_runs = jsonb_set(coalesce(monthly_runs, '{}'::jsonb), array[v_month_key], to_jsonb(v_next_monthly), true)
    where id = v_member.id;

    v_matched := array_append(v_matched, v_member.name);
  end loop;

  insert into public.attendance_logs (source, event_type, attendance_date, raw_count, matched, unmatched, ambiguous)
  values (
    left(v_source, 20),
    left(v_event_type, 20),
    v_date,
    coalesce(jsonb_array_length(coalesce(payload->'names', '[]'::jsonb)), 0),
    to_jsonb(v_matched),
    to_jsonb(v_unmatched),
    to_jsonb(v_ambiguous)
  );

  return jsonb_build_object(
    'ok', true,
    'summary', jsonb_build_object(
      'matched', to_jsonb(v_matched),
      'unmatched', to_jsonb(v_unmatched),
      'ambiguous', to_jsonb(v_ambiguous),
      'replaced_existing', v_replaced
    )
  );
end;
$$;
