begin;

create table public.rallora_club_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null check(char_length(trim(name)) between 2 and 140),
  format text not null check(format in ('americano','mexicano','custom')),
  status text not null default 'draft' check(status in ('draft','published','completed','cancelled')),
  event_date date not null,
  courts integer not null default 1 check(courts between 1 and 50),
  rounds integer not null default 1 check(rounds between 1 and 100),
  points_target integer check(points_target between 1 and 100),
  public_notes text check(public_notes is null or char_length(public_notes)<=3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rallora_event_players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.rallora_club_events(id) on delete cascade,
  player_user_id uuid references auth.users(id) on delete set null,
  player_name text not null check(char_length(trim(player_name)) between 2 and 120),
  seed integer,
  created_at timestamptz not null default now(),
  unique(event_id,player_name)
);

create table public.rallora_event_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.rallora_club_events(id) on delete cascade,
  round_number integer not null check(round_number between 1 and 100),
  court_number integer not null check(court_number between 1 and 50),
  team_a_player_1 uuid not null references public.rallora_event_players(id),
  team_a_player_2 uuid not null references public.rallora_event_players(id),
  team_b_player_1 uuid not null references public.rallora_event_players(id),
  team_b_player_2 uuid not null references public.rallora_event_players(id),
  team_a_score integer check(team_a_score>=0),
  team_b_score integer check(team_b_score>=0),
  status text not null default 'scheduled' check(status in ('scheduled','complete','cancelled')),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(event_id,round_number,court_number),
  check(team_a_player_1<>team_a_player_2 and team_a_player_1<>team_b_player_1 and team_a_player_1<>team_b_player_2
    and team_a_player_2<>team_b_player_1 and team_a_player_2<>team_b_player_2 and team_b_player_1<>team_b_player_2)
);

create index rallora_club_events_club_date_idx on public.rallora_club_events(club_id,event_date desc);
create index rallora_event_players_event_idx on public.rallora_event_players(event_id);
create index rallora_event_matches_event_round_idx on public.rallora_event_matches(event_id,round_number,court_number);

alter table public.rallora_club_events enable row level security;
alter table public.rallora_event_players enable row level security;
alter table public.rallora_event_matches enable row level security;
revoke all on public.rallora_club_events,public.rallora_event_players,public.rallora_event_matches from public;
grant select on public.rallora_club_events,public.rallora_event_players,public.rallora_event_matches to anon,authenticated;
grant insert,update,delete on public.rallora_club_events,public.rallora_event_players,public.rallora_event_matches to authenticated;

create or replace function public.rallora_club_feature_enabled(p_club_id uuid,p_feature_key text)
returns boolean language sql stable security definer set search_path='' as $$
  select public.rallora_is_platform_admin() or exists(
    select 1 from public.rallora_club_feature_entitlements e
    left join public.rallora_club_subscriptions s on s.club_id=e.club_id
    where e.club_id=p_club_id and e.feature_key=p_feature_key and e.is_enabled
      and coalesce(s.status,'active') in ('trialing','active')
  );
$$;
revoke all on function public.rallora_club_feature_enabled(uuid,text) from public;
grant execute on function public.rallora_club_feature_enabled(uuid,text) to anon,authenticated;

create policy "published_events_public_read" on public.rallora_club_events for select to anon,authenticated
  using(public.rallora_club_feature_enabled(club_id,'club_events') and status in ('published','completed'));
create policy "event_managers_read" on public.rallora_club_events for select to authenticated
  using(public.rallora_can_manage_club(club_id) and public.rallora_club_feature_enabled(club_id,'club_events'));
create policy "event_managers_write" on public.rallora_club_events for all to authenticated
  using(public.rallora_can_manage_club(club_id) and public.rallora_club_feature_enabled(club_id,'club_events'))
  with check(public.rallora_can_manage_club(club_id) and public.rallora_club_feature_enabled(club_id,'club_events'));
create policy "published_event_players_read" on public.rallora_event_players for select to anon,authenticated
  using(exists(select 1 from public.rallora_club_events e where e.id=event_id and e.status in ('published','completed')));
create policy "event_players_manager_read" on public.rallora_event_players for select to authenticated
  using(exists(select 1 from public.rallora_club_events e where e.id=event_id and public.rallora_can_manage_club(e.club_id)));
create policy "event_players_manager_write" on public.rallora_event_players for all to authenticated
  using(exists(select 1 from public.rallora_club_events e where e.id=event_id and public.rallora_can_manage_club(e.club_id)))
  with check(exists(select 1 from public.rallora_club_events e where e.id=event_id and public.rallora_can_manage_club(e.club_id)));
create policy "published_event_matches_read" on public.rallora_event_matches for select to anon,authenticated
  using(exists(select 1 from public.rallora_club_events e where e.id=event_id and e.status in ('published','completed')));
create policy "event_matches_manager_read" on public.rallora_event_matches for select to authenticated
  using(exists(select 1 from public.rallora_club_events e where e.id=event_id and public.rallora_can_manage_club(e.club_id)));
create policy "event_matches_manager_write" on public.rallora_event_matches for all to authenticated
  using(exists(select 1 from public.rallora_club_events e where e.id=event_id and public.rallora_can_manage_club(e.club_id)))
  with check(exists(select 1 from public.rallora_club_events e where e.id=event_id and public.rallora_can_manage_club(e.club_id)));

-- Add club events to plan-controlled feature access.
create or replace function public.rallora_platform_set_plan(p_club_id uuid,p_plan_code text,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_features text[];
begin
  if not public.rallora_is_platform_admin() then raise exception 'Not authorised'; end if;
  if p_plan_code not in ('starter','league','pro') then raise exception 'Invalid plan'; end if;
  if p_status not in ('trialing','active','past_due','paused','cancelled') then raise exception 'Invalid subscription status'; end if;
  insert into public.rallora_club_subscriptions(club_id,plan_code,status,trial_ends_at,updated_by)
    values(p_club_id,p_plan_code,p_status,case when p_status='trialing' then now()+interval '14 days' end,auth.uid())
    on conflict(club_id) do update set plan_code=excluded.plan_code,status=excluded.status,updated_by=auth.uid(),updated_at=now();
  v_features:=case p_plan_code when 'pro' then array['core_league','player_registration','captain_results','social_studio','sponsors','reminders','club_events']
    when 'league' then array['core_league','player_registration','captain_results','social_studio','club_events']
    else array['core_league','player_registration'] end;
  insert into public.rallora_club_feature_entitlements(club_id,feature_key,is_enabled,enabled_by,updated_at)
    select p_club_id,key,true,auth.uid(),now() from unnest(v_features) key
    on conflict(club_id,feature_key) do update set is_enabled=true,enabled_by=auth.uid(),updated_at=now();
  update public.rallora_club_feature_entitlements set is_enabled=false,enabled_by=auth.uid(),updated_at=now()
    where club_id=p_club_id and not(feature_key=any(v_features));
end; $$;

create or replace function public.rallora_platform_set_feature(p_club_id uuid,p_feature_key text,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.rallora_is_platform_admin() then raise exception 'Not authorised'; end if;
  if p_feature_key not in ('core_league','player_registration','captain_results','social_studio','sponsors','reminders','club_events') then raise exception 'Invalid feature'; end if;
  insert into public.rallora_club_feature_entitlements(club_id,feature_key,is_enabled,enabled_by,updated_at)
    values(p_club_id,p_feature_key,p_enabled,auth.uid(),now())
    on conflict(club_id,feature_key) do update set is_enabled=excluded.is_enabled,enabled_by=auth.uid(),updated_at=now();
end; $$;

revoke all on function public.rallora_platform_set_plan(uuid,text,text),public.rallora_platform_set_feature(uuid,text,boolean) from public,anon;
grant execute on function public.rallora_platform_set_plan(uuid,text,text),public.rallora_platform_set_feature(uuid,text,boolean) to authenticated;
commit;
