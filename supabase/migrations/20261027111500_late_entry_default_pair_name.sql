begin;
create or replace function public.rallora_admin_add_late_team(
  p_season_id uuid,
  p_division_id uuid,
  p_mode text,
  p_reason text,
  p_source_team_id uuid default null,
  p_team_name text default null,
  p_captain_name text default null,
  p_captain_email text default null,
  p_partner_name text default null,
  p_partner_email text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_season public.seasons%rowtype;
  v_source public.teams%rowtype;
  v_captain_id uuid;
  v_captain_name text;
  v_captain_email text;
  v_partner_name text;
  v_partner_email text;
  v_name text;
  v_team uuid;
  v_application uuid;
  v_invite uuid;
  v_request uuid;
  v_has_fixtures boolean;
begin
  if auth.uid() is null then raise exception 'Sign in to add a team'; end if;
  select * into v_season from public.seasons where id=p_season_id for update;
  if not found or not public.rallora_can_manage_club(v_season.club_id) then raise exception 'Not authorised'; end if;
  if v_season.status not in ('draft','active') or exists(select 1 from public.seasons where previous_season_id=v_season.id) then
    raise exception 'Only the current draft or active league can accept late teams';
  end if;
  if not exists(select 1 from public.divisions where id=p_division_id and season_id=p_season_id) then
    raise exception 'Choose a division in this league';
  end if;
  if p_mode not in ('new','existing') then raise exception 'Choose an existing or new team'; end if;
  if char_length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'Enter a reason (3–500 characters)'; end if;

  if p_mode='existing' then
    select t.* into v_source from public.teams t
      join public.divisions d on d.id=t.division_id
      join public.seasons s on s.id=d.season_id
      where t.id=p_source_team_id and s.club_id=v_season.club_id and s.id<>p_season_id
        and coalesce(t.is_active,true);
    if not found then raise exception 'Choose a team from another league at this club'; end if;
    select r.player_user_id into v_captain_id
      from public.rallora_team_roster_memberships r
      where r.team_id=v_source.id and r.role='captain' limit 1;
    if v_captain_id is null then raise exception 'Source team has no registered captain'; end if;
    select email into v_captain_email from auth.users where id=v_captain_id;
    v_captain_name:=v_source.player_one_name;
    v_partner_name:=v_source.player_two_name;
    v_partner_email:=v_source.player_two_email;
    v_name:=v_source.name;
  else
    v_captain_email:=lower(trim(coalesce(p_captain_email,'')));
    v_captain_name:=trim(coalesce(p_captain_name,''));
    v_partner_email:=lower(trim(coalesce(p_partner_email,'')));
    v_partner_name:=trim(coalesce(p_partner_name,''));
    -- Use a clear pairing label when the organiser does not supply a custom team name.
    v_name:=case when nullif(trim(coalesce(p_team_name,'')),'') is null
      then left(v_captain_name||' / '||v_partner_name,120)
      else trim(p_team_name) end;
    select id into v_captain_id from auth.users where lower(email)=v_captain_email;
    if v_captain_id is null then raise exception 'Captain must have an existing Rallora account'; end if;
  end if;

  if char_length(coalesce(v_name,'')) not between 2 and 120
    or char_length(coalesce(v_captain_name,'')) not between 2 and 120
    or char_length(coalesce(v_partner_name,'')) not between 2 and 120
    or v_captain_email is null or v_captain_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or v_partner_email is null or v_partner_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or lower(v_captain_email)=lower(v_partner_email)
  then raise exception 'Valid team, captain and partner names and distinct email addresses are required'; end if;

  if exists(select 1 from public.rallora_team_roster_memberships
    where season_id=p_season_id and player_user_id=v_captain_id)
    or exists(select 1 from public.teams t join public.divisions d on d.id=t.division_id
      where d.season_id=p_season_id and coalesce(t.is_active,true)
        and (lower(coalesce(t.player_one_email,'')) in (lower(v_captain_email),lower(v_partner_email))
          or lower(coalesce(t.player_two_email,'')) in (lower(v_captain_email),lower(v_partner_email))))
  then raise exception 'One of these players already has a pairing in this league'; end if;

  select exists(select 1 from public.fixtures where season_id=p_season_id) into v_has_fixtures;
  -- Deliberately preserve all published fixtures, results and standings.
  insert into public.teams(
    division_id,name,player_one_name,player_two_name,player_one_email,player_two_email,is_active)
  values(p_division_id,v_name,v_captain_name,v_partner_name,lower(v_captain_email),lower(v_partner_email),true)
  returning id into v_team;

  insert into public.rallora_team_applications(
    club_id,season_id,division_id,requested_by,team_name,captain_name,partner_name,partner_email,
    status,organiser_note,reviewed_by,reviewed_at,created_team_id)
  values(v_season.club_id,p_season_id,p_division_id,v_captain_id,v_name,v_captain_name,v_partner_name,
    lower(v_partner_email),'pending','Late admin entry: '||trim(p_reason),null,null,v_team)
  returning id into v_application;

  insert into public.rallora_team_registration_requests(
    club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_by,reviewed_at)
  values(v_season.club_id,p_season_id,p_division_id,v_team,v_captain_id,v_captain_name,
    'approved',auth.uid(),now()) returning id into v_request;

  insert into public.rallora_team_roster_memberships(
    registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by)
  values(v_request,v_season.club_id,p_season_id,p_division_id,v_team,v_captain_id,'captain',auth.uid());

  insert into public.rallora_team_member_invites(
    team_application_id,club_id,season_id,division_id,team_id,invited_name,invited_email)
  values(v_application,v_season.club_id,p_season_id,p_division_id,v_team,v_partner_name,lower(v_partner_email))
  returning id into v_invite;
  update public.rallora_team_applications set partner_invite_id=v_invite where id=v_application;
  -- Honour the existing duplicate guard: applications must transition from pending to approved.
  update public.rallora_team_applications
    set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
    where id=v_application;

  insert into public.rallora_late_team_entries(
    club_id,season_id,division_id,team_id,source_team_id,entry_mode,reason,created_by,fixtures_present)
  values(v_season.club_id,p_season_id,p_division_id,v_team,
    case when p_mode='existing' then p_source_team_id else null end,
    p_mode,trim(p_reason),auth.uid(),v_has_fixtures);

  return jsonb_build_object('team_id',v_team,'partner_invite_id',v_invite,
    'fixtures_need_review',v_has_fixtures,'season_status',v_season.status);
end $$;
commit;
