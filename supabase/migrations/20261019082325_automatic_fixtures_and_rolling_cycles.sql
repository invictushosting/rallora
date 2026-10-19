begin;

-- Each cycle has independent teams and fixtures, preserving historical divisions.
alter table public.seasons
  add column previous_season_id uuid references public.seasons(id) on delete set null,
  add column rolling_cycle_number integer not null default 1 check (rolling_cycle_number > 0),
  add column competition_name text;
create unique index seasons_one_successor_idx on public.seasons(previous_season_id)
  where previous_season_id is not null;
alter table public.teams
  add column previous_team_id uuid references public.teams(id) on delete set null,
  add column cycle_movement text check (cycle_movement in ('promoted','relegated','stayed'));
create index teams_previous_team_idx on public.teams(previous_team_id) where previous_team_id is not null;

create schema if not exists rallora_private;
revoke all on schema rallora_private from public,anon;
grant usage on schema rallora_private to authenticated;

create function rallora_private.check_cycle_lineage()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.previous_season_id is not null and not exists (
    select 1 from public.seasons s where s.id=new.previous_season_id
      and s.club_id=new.club_id and s.rolling_cycle_number+1=new.rolling_cycle_number
  ) then raise exception 'Previous cycle must belong to the same club and precede this cycle'; end if;
  return new;
end $$;
revoke all on function rallora_private.check_cycle_lineage() from public,anon,authenticated;
create trigger check_cycle_lineage before insert or update of previous_season_id,club_id,rolling_cycle_number
  on public.seasons for each row execute function rallora_private.check_cycle_lineage();

create function rallora_private.generate_round_robin(p_season_id uuid,p_starts_on date,p_ends_on date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  s public.seasons%rowtype; d record; ids uuid[]; initial_ids uuid[];
  n integer; rounds integer; legs integer; leg integer; r integer; j integer;
  h uuid; a uuid; swap_id uuid; round_number integer; publish_on date; due_on date;
  generated integer:=0; division_count integer:=0; expected bigint:=0;
begin
  if auth.uid() is null then raise exception 'Sign in to generate fixtures'; end if;
  select * into s from public.seasons where id=p_season_id for update;
  if not found or not public.rallora_can_manage_club(s.club_id) then raise exception 'Not authorised'; end if;
  if s.status not in ('draft','active') then raise exception 'Completed cycles cannot receive new fixtures'; end if;
  if s.registration_published then raise exception 'Close registration before generating fixtures'; end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on<p_starts_on then raise exception 'Choose a valid fixture window'; end if;
  if exists(select 1 from public.fixtures where season_id=s.id) then
    raise exception 'This cycle already has fixtures. Existing matches have not been changed';
  end if;
  -- Serialise generation and hold the current division/team structure until commit.
  perform id from public.divisions where season_id=s.id order by sort_order,id for update;
  perform t.id from public.teams t join public.divisions div on div.id=t.division_id
    where div.season_id=s.id order by t.id for share of t;
  legs:=case when s.cycle_match_mode='double_round_robin' then 2 else 1 end;
  for d in select div.id,div.name,count(t.id)::integer team_count from public.divisions div
    left join public.teams t on t.division_id=div.id and coalesce(t.is_active,true)
    where div.season_id=s.id group by div.id,div.name,div.sort_order order by div.sort_order,div.id
  loop
    if d.team_count<2 then raise exception 'Division % needs at least two active teams',d.name; end if;
    if d.team_count>100 then raise exception 'Division % exceeds 100 teams',d.name; end if;
    expected:=expected+d.team_count::bigint*(d.team_count-1)/2*legs;
    division_count:=division_count+1;
  end loop;
  if division_count=0 then raise exception 'Create divisions and assign teams first'; end if;
  if expected>10000 then raise exception 'This generation exceeds 10,000 fixtures; split the competition into smaller seasons'; end if;
  for d in select id,name from public.divisions where season_id=s.id order by sort_order,id loop
    select array_agg(t.id order by t.id) into initial_ids from public.teams t
      where t.division_id=d.id and coalesce(t.is_active,true);
    if cardinality(initial_ids)%2=1 then initial_ids:=array_append(initial_ids,null::uuid); end if;
    n:=cardinality(initial_ids); rounds:=n-1;
    if s.fixture_schedule_mode='weekly' and p_ends_on<p_starts_on+(rounds*legs*7-1) then
      raise exception 'Weekly rounds in % need at least % days',d.name,rounds*legs*7;
    end if;
    for leg in 1..legs loop
      ids:=initial_ids;
      for r in 1..rounds loop
        round_number:=(leg-1)*rounds+r;
        publish_on:=case when s.fixture_schedule_mode='weekly' then p_starts_on+(round_number-1)*7 else p_starts_on end;
        due_on:=case when s.fixture_schedule_mode='weekly' then p_starts_on+round_number*7-1 else p_ends_on end;
        for j in 1..n/2 loop
          h:=ids[j]; a:=ids[n+1-j];
          if h is null or a is null then continue; end if; -- An odd division has a bye, never a dummy match.
          if (r+j)%2=0 then swap_id:=h;h:=a;a:=swap_id; end if;
          if leg=2 then swap_id:=h;h:=a;a:=swap_id; end if;
          insert into public.fixtures(season_id,division_id,week_number,home_team_id,away_team_id,
            available_from,play_by,status,fixture_group_type,fixture_group_name,fixtures_per_team)
          values(s.id,d.id,round_number,h,a,publish_on,due_on,'open',
            case when s.fixture_schedule_mode='weekly' then 'weekly' else 'custom' end,
            'Round '||round_number,(cardinality(initial_ids)-1-case when array_position(initial_ids,null::uuid) is not null then 1 else 0 end)*legs);
          generated:=generated+1;
        end loop;
        -- Circle rotation: the first team is fixed; the final team rotates to position two.
        ids:=array[ids[1],ids[n]]||ids[2:n-1];
      end loop;
    end loop;
  end loop;
  insert into public.standings(season_id,division_id,team_id,played,won,drawn,lost,score_diff,points)
    select s.id,div_data.id,t.id,0,0,0,0,0,0 from public.divisions div_data join public.teams t on t.division_id=div_data.id
    where div_data.season_id=s.id and coalesce(t.is_active,true) on conflict(season_id,team_id) do nothing;
  update public.seasons set starts_on=p_starts_on,ends_on=p_ends_on where id=s.id;
  return jsonb_build_object('season_id',s.id,'fixture_count',generated,'division_count',division_count);
end $$;
revoke all on function rallora_private.generate_round_robin(uuid,date,date) from public,anon;
grant execute on function rallora_private.generate_round_robin(uuid,date,date) to authenticated;
create function public.rallora_generate_round_robin(p_season_id uuid,p_starts_on date,p_ends_on date)
returns jsonb language sql security invoker set search_path='' as $$
  select rallora_private.generate_round_robin(p_season_id,p_starts_on,p_ends_on);
$$;
revoke all on function public.rallora_generate_round_robin(uuid,date,date) from public,anon;
grant execute on function public.rallora_generate_round_robin(uuid,date,date) to authenticated;

create function rallora_private.create_next_cycle(p_season_id uuid,p_starts_on date,p_ends_on date)
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
  movement text; title text; unfinished integer;
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
  select count(*) into unfinished from public.fixtures f where f.season_id=s.id and f.status<>'cancelled'
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
    select t.id,t.division_id,d.name division_name,
      row_number() over(partition by d.id order by st.points desc nulls last,st.won desc nulls last,st.score_diff desc nulls last,
        lower(coalesce(nullif(concat_ws(' / ',t.player_one_name,t.player_two_name),''),t.name)),t.id) position,
      count(*) over(partition by d.id) group_size
    from public.divisions d join public.teams t on t.division_id=d.id and coalesce(t.is_active,true)
    left join public.standings st on st.season_id=s.id and st.team_id=t.id where d.season_id=s.id
  loop
    division_index:=array_position(division_ids,ranking.division_id);
    if (case when division_index>1 then s.promotion_places else 0 end)+
       (case when division_index<cardinality(division_ids) then s.relegation_places else 0 end)>ranking.group_size then
      raise exception 'Promotion and relegation places overlap in %; adjust the movement settings',ranking.division_name;
    end if;
    target_index:=case when division_index>1 and ranking.position<=s.promotion_places then division_index-1
      when division_index<cardinality(division_ids) and ranking.position>ranking.group_size-s.relegation_places then division_index+1 else division_index end;
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
      row_number() over(partition by d.id order by st.points desc nulls last,st.won desc nulls last,st.score_diff desc nulls last,
        lower(coalesce(nullif(concat_ws(' / ',t.player_one_name,t.player_two_name),''),t.name)),t.id) position,
      count(*) over(partition by d.id) group_size
    from public.divisions d join public.teams t on t.division_id=d.id and coalesce(t.is_active,true)
    left join public.standings st on st.season_id=s.id and st.team_id=t.id where d.season_id=s.id
  loop
    division_index:=array_position(division_ids,ranking.division_id);
    target_index:=case when division_index>1 and ranking.position<=s.promotion_places then division_index-1
      when division_index<cardinality(division_ids) and ranking.position>ranking.group_size-s.relegation_places then division_index+1 else division_index end;
    target_division:=new_division_ids[target_index];
    movement:=case when target_index<division_index then 'promoted' when target_index>division_index then 'relegated' else 'stayed' end;
    if movement='promoted' then promoted:=promoted+1; elsif movement='relegated' then relegated:=relegated+1; end if;
    select * into source_team from public.teams where id=ranking.id;
    new_team:=jsonb_populate_record(null::public.teams,to_jsonb(source_team)||jsonb_build_object('id',gen_random_uuid(),'division_id',target_division,'previous_team_id',source_team.id,'cycle_movement',movement,'created_at',now()));
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
revoke all on function rallora_private.create_next_cycle(uuid,date,date) from public,anon;
grant execute on function rallora_private.create_next_cycle(uuid,date,date) to authenticated;
create function public.rallora_create_next_cycle(p_season_id uuid,p_starts_on date,p_ends_on date)
returns jsonb language sql security invoker set search_path='' as $$
  select rallora_private.create_next_cycle(p_season_id,p_starts_on,p_ends_on);
$$;
revoke all on function public.rallora_create_next_cycle(uuid,date,date) from public,anon;
grant execute on function public.rallora_create_next_cycle(uuid,date,date) to authenticated;

-- Result/fixture writes share the season lock with rollover. Once a successor
-- exists, its source fixtures are historical and cannot change underneath it.
create function rallora_private.guard_cycle_history()
returns trigger language plpgsql security definer set search_path='' as $$
declare ids uuid[]; season_id uuid; fixture_ids uuid[];
begin
  if tg_table_name='fixtures' then
    if tg_op='INSERT' then ids:=array[new.season_id];
    elsif tg_op='DELETE' then ids:=array[old.season_id];
    else ids:=array[old.season_id,new.season_id]; end if;
  else
    if tg_op='INSERT' then fixture_ids:=array[new.fixture_id];
    elsif tg_op='DELETE' then fixture_ids:=array[old.fixture_id];
    else fixture_ids:=array[old.fixture_id,new.fixture_id]; end if;
    select array_agg(distinct f.season_id) into ids from public.fixtures f where f.id=any(fixture_ids);
  end if;
  for season_id in select id from public.seasons where id=any(ids) order by id for update loop
    if tg_table_name='result_submissions' and exists(select 1 from public.seasons where id=season_id and status='draft') then
      raise exception 'Activate this cycle before submitting results';
    end if;
    if exists(select 1 from public.seasons where previous_season_id=season_id) then
      raise exception 'This cycle has a successor. Its fixtures and results are preserved as history';
    end if;
  end loop;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function rallora_private.guard_cycle_history() from public,anon,authenticated;
create trigger preserve_fixture_cycle_history before insert or update or delete on public.fixtures
  for each row execute function rallora_private.guard_cycle_history();
create trigger preserve_result_cycle_history before insert or update or delete on public.results
  for each row execute function rallora_private.guard_cycle_history();

create trigger preserve_submission_cycle_history before insert or update or delete on public.result_submissions
  for each row execute function rallora_private.guard_cycle_history();

commit;
