begin;

alter table public.fixtures drop constraint if exists fixtures_status_check;
alter table public.fixtures add constraint fixtures_status_check
  check (status in ('open','submitted','confirmed','disputed','forfeit','double_forfeit','cancelled','bye'));

create table public.rallora_team_withdrawals (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  season_id uuid not null references public.seasons(id),
  team_id uuid not null references public.teams(id),
  timing text not null check (timing in ('now', 'next_round')),
  previous_team_active boolean not null,
  reason text not null check (length(trim(reason)) between 1 and 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reinstated_by uuid references auth.users(id) on delete set null,
  reinstated_at timestamptz,
  fixture_ids uuid[] not null default '{}'
);
create unique index rallora_one_current_team_withdrawal
  on public.rallora_team_withdrawals(team_id) where reinstated_at is null;
create index rallora_withdrawals_round on public.rallora_team_withdrawals(club_id, season_id);

create table rallora_private.withdrawal_fixture_history (
  withdrawal_id uuid not null references public.rallora_team_withdrawals(id),
  fixture_id uuid not null references public.fixtures(id),
  former_status text not null check (former_status in ('open','cancelled')),
  primary key (withdrawal_id, fixture_id)
);
create index withdrawal_fixture_history_fixture
  on rallora_private.withdrawal_fixture_history(fixture_id);

create table public.rallora_division_round_movement (
  division_id uuid primary key references public.divisions(id),
  club_id uuid not null references public.clubs(id),
  season_id uuid not null references public.seasons(id),
  promotion_places integer check (promotion_places >= 0),
  relegation_places integer check (relegation_places >= 0),
  foreign key (division_id, season_id) references public.divisions(id, season_id)
);
create table public.rallora_division_round_movement_history (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs(id),
  season_id uuid not null references public.seasons(id),
  division_id uuid not null references public.divisions(id),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  previous_settings jsonb,
  new_settings jsonb not null
);

alter table public.rallora_team_withdrawals enable row level security;
alter table rallora_private.withdrawal_fixture_history enable row level security;
alter table public.rallora_division_round_movement enable row level security;
alter table public.rallora_division_round_movement_history enable row level security;
revoke all on public.rallora_team_withdrawals, rallora_private.withdrawal_fixture_history,
  public.rallora_division_round_movement, public.rallora_division_round_movement_history
  from public, anon, authenticated;
grant select on public.rallora_team_withdrawals, public.rallora_division_round_movement,
  public.rallora_division_round_movement_history to authenticated;
create policy withdrawal_club_read on public.rallora_team_withdrawals
  for select to authenticated using (public.rallora_can_manage_club(club_id));
create policy movement_override_club_read on public.rallora_division_round_movement
  for select to authenticated using (public.rallora_can_manage_club(club_id));
create policy movement_history_club_read on public.rallora_division_round_movement_history
  for select to authenticated using (public.rallora_can_manage_club(club_id));

create function rallora_private.withdrawal_fixtures(p_team_id uuid, p_season_id uuid)
returns table (fixture_id uuid, status text, play_by date, opponent text, booking_starts_at timestamptz, decision text)
language sql stable set search_path = '' as $$
  select f.id, f.status, f.play_by,
    coalesce(nullif(concat_ws(' / ', opponent.player_one_name, opponent.player_two_name), ''), opponent.name),
    coalesce(a.starts_at,f.booking_starts_at),
    case when f.status = 'bye' then case when exists(
      select 1 from rallora_private.withdrawal_fixture_history history where history.fixture_id=f.id
    ) then 'bye' else 'preserve' end
      when f.status in ('confirmed','forfeit','double_forfeit') then 'preserve'
      when f.status not in ('open','cancelled')
        or exists(select 1 from public.results r where r.fixture_id=f.id)
        or exists(select 1 from public.result_submissions rs where rs.fixture_id=f.id) then 'review'
      else 'bye' end
  from public.fixtures f join public.teams opponent on opponent.id =
    case when f.home_team_id = p_team_id then f.away_team_id else f.home_team_id end
  left join public.rallora_fixture_arrangements a on a.fixture_id=f.id
  where f.season_id=p_season_id and p_team_id in (f.home_team_id,f.away_team_id);
$$;
revoke all on function rallora_private.withdrawal_fixtures(uuid,uuid) from public, anon, authenticated;

create function public.rallora_preview_team_withdrawal(p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.seasons%rowtype; v_plan jsonb;
begin
  select season.* into s from public.teams t
    join public.divisions d on d.id=t.division_id
    join public.seasons season on season.id=d.season_id
    where t.id=p_team_id;
  if not public.rallora_can_manage_club(s.club_id) then raise exception 'Team unavailable'; end if;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.play_by,f.fixture_id),'[]') into v_plan
    from rallora_private.withdrawal_fixtures(p_team_id,s.id) f;
  return jsonb_build_object('fixtures',v_plan,'snapshot',md5(v_plan::text));
end;
$$;

create function rallora_private.notify_team_withdrawal(p_withdrawal uuid, p_reinstated boolean)
returns void language sql set search_path = '' as $$
  insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
  select distinct m.player_user_id,w.club_id,'team_withdrawal',
    case when p_reinstated then 'Team reinstated' when w.timing='next_round' then 'Team withdrawing next round' else 'League fixtures updated' end,
    case when p_reinstated then 'Open Match centre for your current league fixtures.'
      when w.timing='next_round' then 'The team will leave the league from the next round. Current fixtures still apply.'
      else 'Your league fixture has changed. Open Match centre. Check any existing court booking with the club.' end,
    '/clubs/'||c.slug||'/captain'
  from public.rallora_team_withdrawals w join public.clubs c on c.id=w.club_id
  join public.rallora_team_roster_memberships m on m.club_id=w.club_id and m.season_id=w.season_id
  where w.id=p_withdrawal and (m.team_id=w.team_id or exists (
    select 1 from public.fixtures f where f.id=any(w.fixture_ids)
    and m.team_id in (f.home_team_id,f.away_team_id)));
$$;
revoke all on function rallora_private.notify_team_withdrawal(uuid,boolean) from public, anon, authenticated;

create function public.rallora_withdraw_team(
  p_team_id uuid, p_timing text, p_reason text, p_snapshot text, p_notify boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.seasons%rowtype; v_withdrawal uuid; v_fixtures uuid[]; v_plan jsonb;
begin
  select season.* into s from public.teams t join public.divisions d on d.id=t.division_id
    join public.seasons season on season.id=d.season_id where t.id=p_team_id;
  if not public.rallora_can_manage_club(s.club_id) then raise exception 'Team unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(s.id::text,0));
  select * into s from public.seasons where id=s.id for update;
  perform 1 from public.teams where id=p_team_id for update;
  if s.status not in ('draft','active') or exists(select 1 from public.seasons where previous_season_id=s.id) then
    raise exception 'Choose a current round without a successor';
  end if;
  if p_timing is null or p_timing not in ('now','next_round')
    or nullif(trim(p_reason),'') is null or length(trim(p_reason))>1000 then
    raise exception 'Choose a withdrawal time and enter a reason';
  end if;
  if p_timing='next_round' and (s.league_format is distinct from 'promotion_relegation_cycles'
    or not exists(select 1 from public.teams where id=p_team_id and is_active is true)) then
    raise exception 'Next round is available for active pairings in rolling leagues';
  end if;

  perform f.id from public.fixtures f where f.season_id=s.id
    and p_team_id in (f.home_team_id,f.away_team_id) order by f.id for update;
  v_plan := public.rallora_preview_team_withdrawal(p_team_id);
  if p_snapshot is distinct from v_plan->>'snapshot' then raise exception 'Fixtures changed. Review them again first.'; end if;

  if p_timing='now' then
    if exists(select from rallora_private.withdrawal_fixtures(p_team_id,s.id) where decision='review') then
      raise exception 'Resolve outstanding result submissions and disputes before withdrawal';
    end if;
    select coalesce(array_agg(fixture_id order by fixture_id),'{}') into v_fixtures
      from rallora_private.withdrawal_fixtures(p_team_id,s.id) where decision='bye';
  else
    v_fixtures := '{}';
  end if;

  insert into public.rallora_team_withdrawals(club_id,season_id,team_id,timing,previous_team_active,reason,created_by,fixture_ids)
    values(s.club_id,s.id,p_team_id,p_timing,
      coalesce((select is_active from public.teams where id=p_team_id),true),trim(p_reason),auth.uid(),v_fixtures) returning id into v_withdrawal;

  if p_timing='now' then
    insert into rallora_private.withdrawal_fixture_history(withdrawal_id,fixture_id,former_status)
    select v_withdrawal,f.id,case when f.status='bye' then (
      select h.former_status from rallora_private.withdrawal_fixture_history h
        where h.fixture_id=f.id order by h.withdrawal_id limit 1) else f.status end
    from public.fixtures f where f.id=any(v_fixtures);
    update public.fixtures f set status='bye',
      home_player_names=coalesce(f.home_player_names,array[h.player_one_name,h.player_two_name]),
      away_player_names=coalesce(f.away_player_names,array[a.player_one_name,a.player_two_name])
    from public.teams h, public.teams a
    where f.id=any(v_fixtures) and f.status<>'bye' and h.id=f.home_team_id and a.id=f.away_team_id;
    update public.teams set is_active=false where id=p_team_id;
  end if;
  if p_notify then perform rallora_private.notify_team_withdrawal(v_withdrawal,false); end if;
  return v_withdrawal;
end;
$$;

create function public.rallora_reinstate_team(p_withdrawal_id uuid, p_notify boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare w public.rallora_team_withdrawals%rowtype; s public.seasons%rowtype;
begin
  select * into w from public.rallora_team_withdrawals where id=p_withdrawal_id;
  if not public.rallora_can_manage_club(w.club_id) then raise exception 'Withdrawal unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(w.season_id::text,0));
  select * into s from public.seasons where id=w.season_id for update;
  select * into w from public.rallora_team_withdrawals where id=p_withdrawal_id for update;
  if w.reinstated_at is not null or s.status not in ('draft','active')
    or exists(select 1 from public.seasons where previous_season_id=s.id) then
    raise exception 'Only a current withdrawal can be reinstated';
  end if;

  perform 1 from public.teams where id=w.team_id for update;
  perform id from public.fixtures where id=any(w.fixture_ids) order by id for update;
  update public.rallora_team_withdrawals set reinstated_at=now(),reinstated_by=auth.uid() where id=w.id;
  if w.timing='now' then
    update public.teams set is_active=w.previous_team_active where id=w.team_id;
    update public.fixtures f set status=h.former_status
      from rallora_private.withdrawal_fixture_history h
      where h.withdrawal_id=w.id and h.fixture_id=f.id and f.status='bye'
      and not exists(select 1 from public.rallora_team_withdrawals x where x.reinstated_at is null
        and x.timing='now' and x.team_id in(f.home_team_id,f.away_team_id));
  end if;
  if p_notify then perform rallora_private.notify_team_withdrawal(w.id,true); end if;
end;
$$;

create function public.rallora_set_division_round_movement(
  p_division_id uuid, p_promotion_places integer, p_relegation_places integer
) returns void language plpgsql security definer set search_path = '' as $$
declare s public.seasons%rowtype; v_previous jsonb;
begin
  select season.* into s from public.divisions d join public.seasons season on season.id=d.season_id
    where d.id=p_division_id;
  if not public.rallora_can_manage_club(s.club_id) then raise exception 'Division unavailable'; end if;
  select * into s from public.seasons where id=s.id for update;
  if s.league_format is distinct from 'promotion_relegation_cycles' or s.status not in ('draft','active','completed')
    or exists(select 1 from public.seasons where previous_season_id=s.id) then
    raise exception 'Choose a rolling league round that has no successor yet';
  end if;
  if p_promotion_places<0 or p_relegation_places<0 then raise exception 'Places must be zero or more'; end if;
  select jsonb_build_array(promotion_places,relegation_places) into v_previous
    from public.rallora_division_round_movement where division_id=p_division_id;
  if p_promotion_places is null and p_relegation_places is null then
    delete from public.rallora_division_round_movement where division_id=p_division_id;
  else
    insert into public.rallora_division_round_movement(division_id,club_id,season_id,promotion_places,relegation_places)
    values(p_division_id,s.club_id,s.id,p_promotion_places,p_relegation_places)
    on conflict(division_id) do update set promotion_places=excluded.promotion_places,relegation_places=excluded.relegation_places;
  end if;
  insert into public.rallora_division_round_movement_history(club_id,season_id,division_id,changed_by,previous_settings,new_settings)
  values(s.club_id,s.id,p_division_id,auth.uid(),v_previous,jsonb_build_array(p_promotion_places,p_relegation_places));
end;
$$;

revoke all on function public.rallora_preview_team_withdrawal(uuid),
  public.rallora_withdraw_team(uuid,text,text,text,boolean),
  public.rallora_reinstate_team(uuid,boolean),public.rallora_set_division_round_movement(uuid,integer,integer)
  from public, anon;
grant execute on function public.rallora_preview_team_withdrawal(uuid),
  public.rallora_withdraw_team(uuid,text,text,text,boolean),
  public.rallora_reinstate_team(uuid,boolean),public.rallora_set_division_round_movement(uuid,integer,integer)
  to authenticated;

create function rallora_private.guard_bye_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  select f.status into v_status from public.fixtures f where f.id=new.fixture_id for share;
  if v_status='bye' then raise exception 'BYE – No match required'; end if;
  return new;
end;
$$;
revoke all on function rallora_private.guard_bye_activity() from public, anon, authenticated;
create trigger guard_bye_results before insert or update on public.results
  for each row execute function rallora_private.guard_bye_activity();
create trigger guard_bye_submissions before insert or update on public.result_submissions
  for each row execute function rallora_private.guard_bye_activity();

create function rallora_private.guard_bye_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='bye' then
    if exists(select 1 from public.results where fixture_id=new.id)
      or exists(select 1 from public.result_submissions where fixture_id=new.id) then
      raise exception 'Resolve result activity before converting to a bye';
    end if;
  elsif exists(select 1 from public.rallora_team_withdrawals w where w.timing='now'
    and w.reinstated_at is null and new.id=any(w.fixture_ids)) then
    raise exception 'Reinstate the withdrawn team before reopening this fixture';
  end if;
  return new;
end;
$$;
revoke all on function rallora_private.guard_bye_status() from public, anon, authenticated;
create trigger guard_bye_status before update of status on public.fixtures
  for each row when (old.status is distinct from new.status)
  execute function rallora_private.guard_bye_status();

create or replace function rallora_private.fixture_context(p_fixture uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('club_id',s.club_id,'slug',c.slug,'active',s.status='active' and not exists(select 1 from public.seasons n where n.previous_season_id=s.id),
 'closed',f.status in ('confirmed','cancelled','bye','forfeit','double_forfeit','disputed') or exists(select 1 from public.results rs where rs.fixture_id=f.id and rs.status in ('confirmed','approved','admin_override','admin_approved')),
 'play_by',f.play_by,'available_from',f.available_from,
 'starts_at',coalesce(a.starts_at,b.starts_at),'ends_at',coalesce(a.ends_at,b.ends_at),
 'submission_id',rs.id,'submission_at',rs.updated_at,'submitting_team_id',rs.submitting_team_id,'home_team_id',f.home_team_id,'away_team_id',f.away_team_id,
 'label',concat_ws(' / ',nullif(h.player_one_name,''),nullif(h.player_two_name,''))||' vs '||concat_ws(' / ',nullif(w.player_one_name,''),nullif(w.player_two_name,'')))
 from public.fixtures f join public.seasons s on s.id=f.season_id join public.clubs c on c.id=s.club_id
 join public.teams h on h.id=f.home_team_id join public.teams w on w.id=f.away_team_id
 left join public.rallora_fixture_arrangements a on a.fixture_id=f.id
 left join lateral(select starts_at,ends_at from public.rallora_playtomic_bookings where matched_fixture_id=f.id and match_state='confirmed' and matched_player_count=4 and booking_status not in ('CANCELED','CANCELLED') order by last_synced_at desc limit 1)b on true
 left join lateral(select id,updated_at,submitting_team_id from public.result_submissions where fixture_id=f.id and status='pending_opponent' order by updated_at desc limit 1)rs on true
 where f.id=p_fixture;
$$;

create or replace function rallora_private.save_arrangement(p_fixture_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_court text,p_clear boolean)
returns void language plpgsql security definer set search_path='' as $$
declare f public.fixtures%rowtype; s public.seasons%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into f from public.fixtures where id=p_fixture_id;
 select * into s from public.seasons where id=f.season_id for share;
 perform id from public.teams where id in(f.home_team_id,f.away_team_id) order by id for share;
 select * into f from public.fixtures where id=p_fixture_id for update;
 select * into s from public.seasons where id=f.season_id;
 if not found or not (public.rallora_can_manage_club(s.club_id) or rallora_private.is_fixture_player(f.id)) then raise exception 'Not authorised'; end if;
 if s.status<>'active' or f.status in ('confirmed','cancelled','bye','forfeit','double_forfeit','submitted','disputed') or exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'This fixture is locked'; end if;
 if p_clear then
  delete from public.rallora_fixture_arrangements where fixture_id=f.id;
  update public.fixtures set arrangement_status='not_arranged',booking_starts_at=null,booking_ends_at=null,booking_court=null,booking_type=null,booking_matched_players=0 where id=f.id and booking_type='MANUAL';
  return;
 end if;
 if p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at) or p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '6 hours' or (p_ends_at at time zone 'Europe/London')::date>f.play_by or (p_starts_at at time zone 'Europe/London')::date<greatest(f.available_from,s.starts_on) then raise exception 'Choose a booking within the fixture window, lasting at most six hours'; end if;
 insert into public.rallora_fixture_arrangements values(f.id,s.club_id,p_starts_at,p_ends_at,left(trim(p_court),120),auth.uid(),now())
 on conflict(fixture_id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,court=excluded.court,updated_by=excluded.updated_by,updated_at=now();
 update public.fixtures set arrangement_status='arranged',booking_starts_at=p_starts_at,booking_ends_at=p_ends_at,booking_court=left(trim(p_court),120),booking_type='MANUAL',booking_matched_players=0 where id=f.id;
end $$;

create or replace function rallora_private.generate_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare f record; cfg public.rallora_communication_settings%rowtype; x jsonb; r record; kind text; rule jsonb; due boolean; local_day date; bucket text; q uuid; count integer:=0; hours integer;
begin
 for f in select fx.id,s.club_id from public.fixtures fx join public.seasons s on s.id=fx.season_id join public.rallora_communication_settings cs on cs.club_id=s.club_id and cs.enabled where s.status='active' and fx.status not in ('confirmed','cancelled','bye','forfeit','double_forfeit','disputed') loop
  select * into cfg from public.rallora_communication_settings where club_id=f.club_id;
  local_day:=(now() at time zone cfg.timezone)::date;
  if extract(hour from now() at time zone cfg.timezone)<cfg.send_hour or extract(hour from now() at time zone cfg.timezone)>=cfg.quiet_end_hour then continue; end if;
  x:=rallora_private.fixture_context(f.id);
  if (x->>'available_from')::date>local_day then continue; end if;
  foreach kind in array array['booking','upcoming','missing_result','confirmation','overdue'] loop
   rule:=cfg.rules->kind; hours:=(rule->>'hours')::integer;
   if not (rule->>'enabled')::boolean then continue; end if;
   due:=case kind
    when 'booking' then (((x->>'play_by')::date+1)::timestamp at time zone cfg.timezone)>now() and (((x->>'play_by')::date+1)::timestamp at time zone cfg.timezone)<=now()+make_interval(hours=>hours)
    when 'upcoming' then (x->>'starts_at')::timestamptz<=now()+make_interval(hours=>hours)
    when 'missing_result' then (x->>'ends_at')::timestamptz<=now()-make_interval(hours=>hours)
    when 'confirmation' then (x->>'submission_at')::timestamptz<=now()-make_interval(hours=>hours)
    when 'overdue' then ((x->>'play_by')::date+1)::timestamp at time zone cfg.timezone<=now()-make_interval(hours=>hours) end;
   if not coalesce(due,false) then continue; end if;
   bucket:=case kind when 'upcoming' then x->>'starts_at' when 'missing_result' then x->>'ends_at' when 'confirmation' then x->>'submission_id' when 'overdue' then floor(extract(epoch from (now()-(((x->>'play_by')::date+1)::timestamp at time zone cfg.timezone)-make_interval(hours=>hours)))/(3600*(rule->>'repeat_hours')::integer))::text else x->>'play_by' end;
   for r in select distinct player_user_id from public.rallora_team_roster_memberships where club_id=(x->>'club_id')::uuid and season_id=(select season_id from public.fixtures where id=f.id) and team_id in((x->>'home_team_id')::uuid,(x->>'away_team_id')::uuid) loop
    if rallora_private.reminder_relevant(f.id,kind,r.player_user_id) then
     q:=rallora_private.enqueue_message(f.club_id,r.player_user_id,null,kind,'reminder:'||f.id||':'||kind||':'||bucket||':'||r.player_user_id,
      case kind when 'booking' then 'Time to arrange your match' when 'upcoming' then 'Your match is coming up' when 'missing_result' then 'Please submit your match result' when 'confirmation' then 'Please review your opponent’s result' else 'Your fixture is overdue' end,
      (x->>'label')||' · Play by '||(x->>'play_by')||case when x->>'starts_at' is not null then ' · Booked for '||to_char((x->>'starts_at')::timestamptz at time zone cfg.timezone,'DD Mon YYYY HH24:MI')||' ('||cfg.timezone||')' else '' end,
      '/clubs/'||(x->>'slug')||'/captain',f.id);
     if q is not null then count:=count+1; end if;
    end if;
   end loop;
  end loop;
 end loop;
 return count;
end $$;

create or replace function rallora_private.create_next_cycle(p_season_id uuid,p_starts_on date,p_ends_on date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  s public.seasons%rowtype; new_season public.seasons%rowtype;
  source_division public.divisions%rowtype; new_division public.divisions%rowtype;
  source_team public.teams%rowtype; new_team public.teams%rowtype;
  application public.rallora_team_applications%rowtype; new_application public.rallora_team_applications%rowtype;
  invite public.rallora_team_member_invites%rowtype; new_invite public.rallora_team_member_invites%rowtype;
  request public.rallora_team_registration_requests%rowtype; new_request public.rallora_team_registration_requests%rowtype;
  roster public.rallora_team_roster_memberships%rowtype;
  rule public.club_rules%rowtype; new_rule public.club_rules%rowtype;
  division_ids uuid[]; new_division_ids uuid[]:='{}'; division_index integer;
  target_index integer; target_counts integer[]; ranking record; target_division uuid;
  generated jsonb; promoted integer:=0; relegated integer:=0; carried integer:=0;
  movement text; title text; unfinished integer; reference_attempt integer;
begin
  if auth.uid() is null then raise exception 'Sign in to prepare the next cycle'; end if;
  select * into s from public.seasons where id=p_season_id for update;
  if not found or not public.rallora_can_manage_club(s.club_id) then raise exception 'Not authorised'; end if;
  if s.league_format<>'promotion_relegation_cycles' or s.status not in ('active','completed') then
    raise exception 'Choose an active or completed rolling league'; end if;
  if exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'The next cycle has already been prepared'; end if;
  if s.registration_published then raise exception 'Close registration before preparing the next cycle'; end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on<p_starts_on then raise exception 'Choose a valid next-cycle window'; end if;
  if p_starts_on<=coalesce(s.ends_on,(select max(play_by) from public.fixtures where season_id=s.id)) then
    raise exception 'The next cycle must start after the previous fixture window'; end if;
  if not exists(select 1 from public.fixtures where season_id=s.id) then raise exception 'The current cycle has no fixtures'; end if;
  if exists(select 1 from public.fixtures f where f.season_id=s.id and
    (f.status in ('disputed','submitted') or exists(select 1 from public.result_submissions rs where rs.fixture_id=f.id and rs.status in ('pending_opponent','disputed')))) then
    raise exception 'Resolve submitted or disputed results before preparing the next cycle'; end if;
  select count(*) into unfinished from public.fixtures f where f.season_id=s.id and f.status not in ('cancelled','bye')
    and (f.status not in ('confirmed','forfeit','double_forfeit') or not exists(
      select 1 from public.results r where r.fixture_id=f.id and r.status in ('confirmed','admin_override','approved','admin_approved')));
  if s.require_cycle_completion and unfinished>0 then raise exception '% fixtures still need official results',unfinished; end if;
  perform id from public.divisions where season_id=s.id order by sort_order,id for update;
  perform t.id from public.teams t join public.divisions div on div.id=t.division_id
    where div.season_id=s.id order by t.id for share of t;
  -- Completed fixtures and their standings remain in the source cycle.
  perform public.recalculate_standings_for_season(s.id);
  select array_agg(id order by sort_order,id) into division_ids from public.divisions where season_id=s.id;
  if cardinality(division_ids) is null then raise exception 'This cycle has no divisions'; end if;
  target_counts:=array_fill(0,array[cardinality(division_ids)]);
  for ranking in
    select t.id,t.division_id,
      coalesce(o.promotion_places,s.promotion_places) as up_places,
      coalesce(o.relegation_places,s.relegation_places) as down_places,d.name division_name,
      row_number() over(partition by d.id order by st.points desc nulls last,st.won desc nulls last,st.score_diff desc nulls last,
        lower(coalesce(nullif(concat_ws(' / ',t.player_one_name,t.player_two_name),''),t.name)),t.id) position,
      count(*) over(partition by d.id) group_size
    from public.divisions d join public.teams t on t.division_id=d.id and coalesce(t.is_active,true)
    left join public.standings st on st.season_id=s.id and st.team_id=t.id
    left join public.rallora_division_round_movement o on o.division_id=d.id and o.season_id=s.id
    where d.season_id=s.id and not exists(select 1 from public.rallora_team_withdrawals w
      where w.team_id=t.id and w.reinstated_at is null)
  loop
    division_index:=array_position(division_ids,ranking.division_id);
    if (case when division_index>1 then ranking.up_places else 0 end)+
       (case when division_index<cardinality(division_ids) then ranking.down_places else 0 end)>ranking.group_size then
      raise exception 'Promotion and relegation places overlap in %; adjust the movement settings',ranking.division_name;
    end if;
    target_index:=case when division_index>1 and ranking.position<=ranking.up_places then division_index-1
      when division_index<cardinality(division_ids) and ranking.position>ranking.group_size-ranking.down_places then division_index+1 else division_index end;
    target_counts[target_index]:=target_counts[target_index]+1;
  end loop;
  for division_index in 1..cardinality(division_ids) loop
    if target_counts[division_index]<2 then raise exception 'Movement would leave division % with fewer than two teams',division_index; end if;
    if s.teams_per_division is not null and target_counts[division_index]>s.teams_per_division+(case when s.allow_overflow_when_uneven then 1 else 0 end) then
      raise exception 'Movement would exceed the team capacity of division %; review the movement settings',division_index;
    end if;
  end loop;
  title:=coalesce(nullif(s.competition_name,''),s.name);
  new_season:=jsonb_populate_record(null::public.seasons,to_jsonb(s)||jsonb_build_object(
    'id',gen_random_uuid(),'name',left(title,75)||' · Cycle '||(s.rolling_cycle_number+1),'status','draft',
    'previous_season_id',s.id,'rolling_cycle_number',s.rolling_cycle_number+1,'competition_name',title,
    'starts_on',p_starts_on,'ends_on',p_ends_on,'registration_published',false,
    'registration_opens_at',null,'registration_closes_at',null,'created_at',now()));
  insert into public.seasons select (new_season).*;
  foreach target_division in array division_ids loop
    select * into source_division from public.divisions where id=target_division;
    new_division:=jsonb_populate_record(null::public.divisions,to_jsonb(source_division)||jsonb_build_object('id',gen_random_uuid(),'season_id',new_season.id,'created_at',now()));
    insert into public.divisions select (new_division).*;
    new_division_ids:=array_append(new_division_ids,new_division.id);
  end loop;
  for ranking in
    select t.id,t.division_id,
      coalesce(o.promotion_places,s.promotion_places) as up_places,
      coalesce(o.relegation_places,s.relegation_places) as down_places,
      row_number() over(partition by d.id order by st.points desc nulls last,st.won desc nulls last,st.score_diff desc nulls last,
        lower(coalesce(nullif(concat_ws(' / ',t.player_one_name,t.player_two_name),''),t.name)),t.id) position,
      count(*) over(partition by d.id) group_size
    from public.divisions d join public.teams t on t.division_id=d.id and coalesce(t.is_active,true)
    left join public.standings st on st.season_id=s.id and st.team_id=t.id
    left join public.rallora_division_round_movement o on o.division_id=d.id and o.season_id=s.id
    where d.season_id=s.id and not exists(select 1 from public.rallora_team_withdrawals w
      where w.team_id=t.id and w.reinstated_at is null)
  loop
    division_index:=array_position(division_ids,ranking.division_id);
    target_index:=case when division_index>1 and ranking.position<=ranking.up_places then division_index-1
      when division_index<cardinality(division_ids) and ranking.position>ranking.group_size-ranking.down_places then division_index+1 else division_index end;
    target_division:=new_division_ids[target_index];
    movement:=case when target_index<division_index then 'promoted' when target_index>division_index then 'relegated' else 'stayed' end;
    if movement='promoted' then promoted:=promoted+1; elsif movement='relegated' then relegated:=relegated+1; end if;
    select * into source_team from public.teams where id=ranking.id;
    new_team:=jsonb_populate_record(null::public.teams,to_jsonb(source_team)||jsonb_build_object('id',gen_random_uuid(),'division_id',target_division,'previous_team_id',source_team.id,'cycle_movement',movement,'created_at',now()));
    -- References are unique only within a division; movement can combine duplicates.
    reference_attempt:=0;
    while exists(select 1 from public.teams where division_id=target_division and name=new_team.name) loop
      reference_attempt:=reference_attempt+1;
      new_team.name:=left(source_team.name,70)||' · '||new_team.id::text||'/'||reference_attempt;
    end loop;
    insert into public.teams select (new_team).*;
    carried:=carried+1;
    for roster in select * from public.rallora_team_roster_memberships where team_id=source_team.id and club_id=s.club_id and season_id=s.id loop
      select * into request from public.rallora_team_registration_requests where id=roster.registration_request_id;
      new_request:=jsonb_populate_record(null::public.rallora_team_registration_requests,to_jsonb(request)||jsonb_build_object(
        'id',gen_random_uuid(),'club_id',s.club_id,'season_id',new_season.id,'division_id',target_division,'team_id',new_team.id,
        'status','approved','reviewed_by',auth.uid(),'reviewed_at',now(),'created_at',now(),'updated_at',now()));
      insert into public.rallora_team_registration_requests select (new_request).*;
      insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by)
        values(new_request.id,s.club_id,new_season.id,target_division,new_team.id,roster.player_user_id,roster.role,auth.uid());
    end loop;
    for application in select * from public.rallora_team_applications where created_team_id=source_team.id and season_id=s.id and status='approved' loop
      new_application:=jsonb_populate_record(null::public.rallora_team_applications,to_jsonb(application)||jsonb_build_object(
        'id',gen_random_uuid(),'season_id',new_season.id,'division_id',target_division,'created_team_id',new_team.id,
        'partner_invite_id',null,'reviewed_by',auth.uid(),'reviewed_at',now(),'created_at',now(),'updated_at',now()));
      insert into public.rallora_team_applications select (new_application).*;
      for invite in select * from public.rallora_team_member_invites where team_application_id=application.id and status='pending' loop
        new_invite:=jsonb_populate_record(null::public.rallora_team_member_invites,to_jsonb(invite)||jsonb_build_object(
          'id',gen_random_uuid(),'team_application_id',new_application.id,'season_id',new_season.id,'division_id',target_division,
          'team_id',new_team.id,'created_at',now()));
        insert into public.rallora_team_member_invites select (new_invite).*;
        update public.rallora_team_applications set partner_invite_id=new_invite.id where id=new_application.id;
      end loop;
    end loop;
  end loop;
  for rule in select * from public.club_rules where season_id=s.id and club_id=s.club_id loop
    new_rule:=jsonb_populate_record(null::public.club_rules,to_jsonb(rule)||jsonb_build_object('id',gen_random_uuid(),'season_id',new_season.id,'created_at',now(),'updated_at',now()));
    insert into public.club_rules select (new_rule).*;
  end loop;
  generated:=rallora_private.generate_round_robin(new_season.id,p_starts_on,p_ends_on);
  return generated||jsonb_build_object('cycle_number',new_season.rolling_cycle_number,'teams_carried',carried,'promoted',promoted,'relegated',relegated,'unfinished_previous_fixtures',unfinished);
end $$;

commit;
