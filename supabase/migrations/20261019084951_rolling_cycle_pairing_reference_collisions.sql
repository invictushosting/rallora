begin;

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
