-- Organiser-controlled captain roles plus authenticated result actions.
begin;

alter table public.result_submissions
  add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists opponent_confirmed_by_user_id uuid references auth.users(id) on delete set null;

create or replace function public.rallora_set_roster_role(p_registration_request_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_club_id uuid;
begin
  if p_role not in ('player','captain') then raise exception 'Invalid roster role'; end if;
  select r.club_id into v_club_id from public.rallora_team_roster_memberships r
    where r.registration_request_id = p_registration_request_id;
  if v_club_id is null or not public.rallora_can_manage_club(v_club_id) then
    raise exception 'Not authorised';
  end if;
  update public.rallora_team_roster_memberships set role = p_role
    where registration_request_id = p_registration_request_id;
end; $$;

create or replace function public.rallora_submit_captain_result(
  p_fixture_id uuid, p_home_score text, p_away_score text,
  p_winner_team_id uuid default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_team_id uuid; v_submission_id uuid;
begin
  select case when public.is_captain_for_team(f.home_team_id) then f.home_team_id
              when public.is_captain_for_team(f.away_team_id) then f.away_team_id end
    into v_team_id from public.fixtures f where f.id = p_fixture_id and f.status in ('open','submitted','disputed');
  if v_team_id is null then raise exception 'Not authorised for this fixture'; end if;
  if nullif(trim(p_home_score),'') is null or nullif(trim(p_away_score),'') is null then raise exception 'Both scores are required'; end if;
  if p_winner_team_id is not null and not exists(select 1 from public.fixtures f where f.id=p_fixture_id and p_winner_team_id in (f.home_team_id,f.away_team_id)) then raise exception 'Invalid winner'; end if;
  if exists(select 1 from public.result_submissions rs where rs.fixture_id=p_fixture_id
    and rs.submitting_team_id<>v_team_id and rs.status in ('pending_opponent','confirmed_by_opponent','admin_approved')) then
    raise exception 'The opposing team has already submitted this result';
  end if;
  insert into public.result_submissions(fixture_id,submitting_team_id,submitted_by_user_id,home_score,away_score,winner_team_id,notes,status,updated_at)
  values(p_fixture_id,v_team_id,auth.uid(),trim(p_home_score),trim(p_away_score),p_winner_team_id,nullif(trim(p_notes),''),'pending_opponent',now())
  on conflict(fixture_id,submitting_team_id) do update set submitted_by_user_id=auth.uid(),home_score=excluded.home_score,
    away_score=excluded.away_score,winner_team_id=excluded.winner_team_id,notes=excluded.notes,status='pending_opponent',confirmed_at=null,updated_at=now()
  returning id into v_submission_id;
  update public.fixtures set status='submitted' where id=p_fixture_id;
  return v_submission_id;
end; $$;

create or replace function public.rallora_review_captain_result(p_submission_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_submission public.result_submissions%rowtype; v_opponent uuid; v_season_id uuid;
begin
  if p_decision not in ('confirm','dispute') then raise exception 'Invalid decision'; end if;
  select rs.* into v_submission from public.result_submissions rs where rs.id=p_submission_id and rs.status='pending_opponent' for update;
  if not found then raise exception 'Submission is not awaiting review'; end if;
  select case when f.home_team_id=v_submission.submitting_team_id then f.away_team_id else f.home_team_id end,f.season_id into v_opponent,v_season_id
    from public.fixtures f where f.id=v_submission.fixture_id;
  if not public.is_captain_for_team(v_opponent) and not public.rallora_can_manage_fixture(v_submission.fixture_id) then
    raise exception 'Only the opposing captain or a club organiser can review';
  end if;
  update public.result_submissions set status=case when p_decision='confirm' then 'confirmed_by_opponent' else 'disputed' end,
    opponent_confirmed_by_user_id=auth.uid(),confirmed_at=case when p_decision='confirm' then now() else null end,updated_at=now()
    where id=p_submission_id;
  update public.fixtures set status=case when p_decision='confirm' then 'confirmed' else 'disputed' end where id=v_submission.fixture_id;
  if p_decision='confirm' then
    insert into public.results(fixture_id,home_score,away_score,winner_team_id,notes,status,confirmed_at)
    values(v_submission.fixture_id,v_submission.home_score,v_submission.away_score,v_submission.winner_team_id,v_submission.notes,'confirmed',now())
    on conflict(fixture_id) do update set home_score=excluded.home_score,away_score=excluded.away_score,
      winner_team_id=excluded.winner_team_id,notes=excluded.notes,status='confirmed',confirmed_at=now();
  end if;
end; $$;

revoke all on function public.rallora_set_roster_role(uuid,text),public.rallora_submit_captain_result(uuid,text,text,uuid,text),public.rallora_review_captain_result(uuid,text) from public,anon;
grant execute on function public.rallora_set_roster_role(uuid,text),public.rallora_submit_captain_result(uuid,text,text,uuid,text),public.rallora_review_captain_result(uuid,text) to authenticated;
commit;
