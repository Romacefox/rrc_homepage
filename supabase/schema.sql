-- RRC Supabase schema

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_year int not null check (birth_year between 1989 and 2004),
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
  birth_year int not null check (birth_year between 1989 and 2004),
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

create unique index if not exists attendance_logs_unique_scope
on public.attendance_logs (attendance_date, event_type);


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
  birth_year int not null check (birth_year between 1989 and 2004),
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

alter table public.member_challenges
add column if not exists recruit_start_date date;

alter table public.member_challenges
add column if not exists recruit_end_date date;

alter table public.member_challenges
add column if not exists mode text not null default 'betting_pool';

alter table public.member_challenges
add column if not exists entry_points int not null default 0;

alter table public.member_challenges
add column if not exists success_reward_points int not null default 0;

alter table public.member_challenges
add column if not exists failure_policy text not null default 'success_pool';

alter table public.member_challenges
add column if not exists min_participants int not null default 3;

alter table public.member_challenges
add column if not exists verification_method text not null default 'RRC 카카오톡 채팅방';

alter table public.member_challenges
add column if not exists progress_current numeric not null default 0;

alter table public.member_challenges
add column if not exists progress_target numeric not null default 0;

alter table public.member_challenge_entries
add column if not exists locked_points int not null default 0;

alter table public.member_challenge_entries
add column if not exists settled_at timestamptz;

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

create table if not exists public.member_mission_claims (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  mission_key text not null,
  period_key text not null,
  points integer not null default 0,
  status text not null default 'claimed',
  metadata jsonb,
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (member_id, mission_key, period_key)
);

alter table public.member_challenges enable row level security;
alter table public.member_challenge_entries enable row level security;
alter table public.member_point_awards enable row level security;
alter table public.member_mission_claims enable row level security;

create or replace function public.claim_activity_mission(
  p_member_id uuid,
  p_member_name text,
  p_mission_key text,
  p_period_key text,
  p_points integer,
  p_award_label text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.member_mission_claims%rowtype;
  v_inserted boolean := false;
begin
  if p_member_id is null or coalesce(p_mission_key, '') = '' or coalesce(p_period_key, '') = '' then
    raise exception 'invalid mission claim payload';
  end if;

  insert into public.member_mission_claims (
    member_id,
    mission_key,
    period_key,
    points,
    status,
    metadata
  )
  values (
    p_member_id,
    p_mission_key,
    p_period_key,
    greatest(coalesce(p_points, 0), 0),
    'claimed',
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (member_id, mission_key, period_key) do nothing
  returning * into v_claim;

  v_inserted := v_claim.id is not null;

  if not v_inserted then
    select * into v_claim
    from public.member_mission_claims
    where member_id = p_member_id
      and mission_key = p_mission_key
      and period_key = p_period_key
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'claimed', false,
      'already_claimed', true,
      'claim_id', v_claim.id
    );
  end if;

  if greatest(coalesce(p_points, 0), 0) > 0 then
    insert into public.member_point_awards (
      user_id,
      member_name,
      month_key,
      award_code,
      award_label,
      points,
      note,
      granted_by_user_id,
      granted_by_name
    )
    values (
      p_member_id,
      coalesce(nullif(p_member_name, ''), 'RRC 회원'),
      case
        when p_period_key ~ '^\d{4}-\d{2}$' then p_period_key
        else to_char(now(), 'YYYY-MM')
      end,
      ('mission_' || p_mission_key),
      left(coalesce(nullif(p_award_label, ''), '미션 포인트'), 80),
      greatest(coalesce(p_points, 0), 0),
      left(
        concat(
          'activity mission: ',
          p_mission_key,
          ' / period: ',
          p_period_key,
          ' / points: ',
          greatest(coalesce(p_points, 0), 0)::text
        ),
        300
      ),
      null,
      'activity-missions'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'claimed', true,
    'already_claimed', false,
    'claim_id', v_claim.id
  );
end;
$$;

revoke execute on function public.claim_activity_mission(uuid, text, text, text, integer, text, jsonb) from public;
revoke execute on function public.claim_activity_mission(uuid, text, text, text, integer, text, jsonb) from anon;
revoke execute on function public.claim_activity_mission(uuid, text, text, text, integer, text, jsonb) from authenticated;
grant execute on function public.claim_activity_mission(uuid, text, text, text, integer, text, jsonb) to service_role;

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
  v_has_log boolean := false;
begin
  if v_action = 'append_attendance_member' then
    v_name := btrim(coalesce(payload->>'name', ''));
    v_date := nullif(payload->>'date', '')::date;
    v_event_type := coalesce(nullif(payload->>'event_type', ''), '정기런');
    v_source := coalesce(nullif(payload->>'source', ''), 'quick');
    if v_name = '' or v_date is null then
      raise exception 'invalid attendance append payload';
    end if;

    v_month_key := to_char(v_date, 'YYYY-MM');
    perform pg_advisory_xact_lock(hashtextextended(v_event_type || '|' || v_date::text, 0));
    v_name_norm := lower(replace(v_name, ' ', ''));

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
      select *
      into v_member
      from public.members m
      where lower(replace(coalesce(m.name, ''), ' ', '')) = v_name_norm
         or exists (
           select 1
           from jsonb_array_elements_text(coalesce(m.aliases, '[]'::jsonb)) alias_name
           where lower(replace(alias_name, ' ', '')) = v_name_norm
         )
      limit 1;
    elsif v_exact_count > 1 then
      return jsonb_build_object(
        'ok', true,
        'summary', jsonb_build_object('matched', '[]'::jsonb, 'unmatched', '[]'::jsonb, 'ambiguous', jsonb_build_array(v_name), 'already_present', '[]'::jsonb)
      );
    else
      select count(*)
      into v_partial_count
      from public.members m
      where lower(replace(coalesce(m.name, ''), ' ', '')) like '%' || v_name_norm || '%'
         or v_name_norm like '%' || lower(replace(coalesce(m.name, ''), ' ', '')) || '%';

      if v_partial_count = 1 then
        select *
        into v_member
        from public.members m
        where lower(replace(coalesce(m.name, ''), ' ', '')) like '%' || v_name_norm || '%'
           or v_name_norm like '%' || lower(replace(coalesce(m.name, ''), ' ', '')) || '%'
        limit 1;
      elsif v_partial_count > 1 then
        return jsonb_build_object(
          'ok', true,
          'summary', jsonb_build_object('matched', '[]'::jsonb, 'unmatched', '[]'::jsonb, 'ambiguous', jsonb_build_array(v_name), 'already_present', '[]'::jsonb)
        );
      else
        return jsonb_build_object(
          'ok', true,
          'summary', jsonb_build_object('matched', '[]'::jsonb, 'unmatched', jsonb_build_array(v_name), 'ambiguous', '[]'::jsonb, 'already_present', '[]'::jsonb)
        );
      end if;
    end if;

    if exists (
      select 1
      from public.attendance_logs existing_log,
        jsonb_array_elements_text(coalesce(existing_log.matched, '[]'::jsonb)) matched_name
      where existing_log.attendance_date = v_date
        and existing_log.event_type = v_event_type
        and lower(replace(matched_name, ' ', '')) = lower(replace(v_member.name, ' ', ''))
    ) then
      return jsonb_build_object(
        'ok', true,
        'summary', jsonb_build_object('matched', '[]'::jsonb, 'unmatched', '[]'::jsonb, 'ambiguous', '[]'::jsonb, 'already_present', jsonb_build_array(v_member.name))
      );
    end if;

    select * into v_log
    from public.attendance_logs
    where attendance_date = v_date
      and event_type = v_event_type
    order by created_at desc
    limit 1;
    v_has_log := found;

    v_next_total := greatest(0, coalesce(v_member.total_runs, 0) + 1);
    v_next_monthly := greatest(
      0,
      coalesce((coalesce(v_member.monthly_runs, '{}'::jsonb)->>v_month_key)::integer, 0) + 1
    );

    update public.members
    set total_runs = v_next_total,
        monthly_runs = jsonb_set(
          coalesce(monthly_runs, '{}'::jsonb),
          array[v_month_key],
          to_jsonb(v_next_monthly),
          true
        )
    where id = v_member.id;

    if v_has_log then
      update public.attendance_logs
      set matched = coalesce(matched, '[]'::jsonb) || jsonb_build_array(v_member.name),
          raw_count = coalesce(raw_count, 0) + 1
      where id = v_log.id;
    else
      insert into public.attendance_logs (
        source,
        event_type,
        attendance_date,
        raw_count,
        matched,
        unmatched,
        ambiguous
      ) values (
        left(v_source, 20),
        left(v_event_type, 20),
        v_date,
        1,
        jsonb_build_array(v_member.name),
        '[]'::jsonb,
        '[]'::jsonb
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'summary', jsonb_build_object('matched', jsonb_build_array(v_member.name), 'unmatched', '[]'::jsonb, 'ambiguous', '[]'::jsonb, 'already_present', '[]'::jsonb)
    );
  end if;

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
    v_next_monthly := greatest(
      0,
      coalesce((coalesce(v_member.monthly_runs, '{}'::jsonb)->>v_month_key)::integer, 0) + v_delta
    );

    update public.members
    set total_runs = v_next_total,
        monthly_runs = jsonb_set(
          coalesce(monthly_runs, '{}'::jsonb),
          array[v_month_key],
          to_jsonb(v_next_monthly),
          true
        )
    where id = v_member_id;

    return jsonb_build_object('ok', true, 'message', 'attendance adjusted');
  end if;

  if v_action in ('revert_attendance_log', 'replace_attendance_log') then
    v_log_id := nullif(payload->>'log_id', '')::uuid;
    if v_log_id is null then
      raise exception 'missing log_id';
    end if;

    select * into v_log
    from public.attendance_logs
    where id = v_log_id
    limit 1;

    if not found then
      raise exception 'attendance log not found';
    end if;

    v_existing_month_key := to_char(v_log.attendance_date, 'YYYY-MM');
    for v_name in
      select value from jsonb_array_elements_text(coalesce(v_log.matched, '[]'::jsonb))
    loop
      select *
      into v_member
      from public.members m
      where lower(replace(coalesce(m.name, ''), ' ', '')) = lower(replace(v_name, ' ', ''))
      limit 1;

      if found then
        v_next_total := greatest(0, coalesce(v_member.total_runs, 0) - 1);
        v_next_monthly := greatest(
          0,
          coalesce((coalesce(v_member.monthly_runs, '{}'::jsonb)->>v_existing_month_key)::integer, 0) - 1
        );

        update public.members
        set total_runs = v_next_total,
            monthly_runs = jsonb_set(
              coalesce(monthly_runs, '{}'::jsonb),
              array[v_existing_month_key],
              to_jsonb(v_next_monthly),
              true
            )
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
  perform pg_advisory_xact_lock(hashtextextended(v_event_type || '|' || v_date::text, 0));

  if v_action = 'apply_attendance' then
    for v_conflict in
      select *
      from public.attendance_logs
      where attendance_date = v_date
        and event_type = v_event_type
    loop
      perform public.admin_attendance_mutation(jsonb_build_object('action', 'revert_attendance_log', 'log_id', v_conflict.id::text));
      v_replaced := true;
    end loop;
  else
    for v_conflict in
      select *
      from public.attendance_logs
      where id <> v_log_id
        and attendance_date = v_date
        and event_type = v_event_type
    loop
      payload := jsonb_build_object('action', 'revert_attendance_log', 'log_id', v_conflict.id::text);
      perform public.admin_attendance_mutation(payload);
      v_replaced := true;
    end loop;
  end if;

  for v_name in
    select value from jsonb_array_elements_text(coalesce(payload->'names', '[]'::jsonb))
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
      select *
      into v_member
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
        select *
        into v_member
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
    v_next_monthly := greatest(
      0,
      coalesce((coalesce(v_member.monthly_runs, '{}'::jsonb)->>v_month_key)::integer, 0) + 1
    );

    update public.members
    set total_runs = v_next_total,
        monthly_runs = jsonb_set(
          coalesce(monthly_runs, '{}'::jsonb),
          array[v_month_key],
          to_jsonb(v_next_monthly),
          true
        )
    where id = v_member.id;

    v_matched := array_append(v_matched, v_member.name);
  end loop;

  insert into public.attendance_logs (
    source,
    event_type,
    attendance_date,
    raw_count,
    matched,
    unmatched,
    ambiguous
  ) values (
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
