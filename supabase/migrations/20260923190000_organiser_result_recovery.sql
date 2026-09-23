-- Controlled organiser recovery for disputed or incorrect fixture results.
begin;
create or replace function public.rallora_admin_resolve_result(
 p_fixture_id uuid,p_home_score text,p_away_score text,p_winner_team_id uuid default null,p_notes text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_fixture public.fixtures%rowtype;
begin
 select * into v_fixture from public.fixtures where id=p_fixture_id for update;
 if not found then raise exception 'Fixture not found'; end if;
 if not public.rallora_can_manage_fixture(p_fixture_id) then raise exception 'Not authorised'; end if;
 if nullif(trim(p_home_score),'') is null or nullif(trim(p_away_score),'') is null then raise exception 'Both scores are required'; end if;
 if length(trim(p_home_score))>100 or length(trim(p_away_score))>100 then raise exception 'Score is too long'; end if;
 if p_notes is not null and length(trim(p_notes))>1000 then raise exception 'Notes are too long'; end if;
 if p_winner_team_id is not null and p_winner_team_id not in(v_fixture.home_team_id,v_fixture.away_team_id) then raise exception 'Invalid winner'; end if;
 insert into public.results(fixture_id,home_score,away_score,winner_team_id,notes,status,confirmed_at)
 values(p_fixture_id,trim(p_home_score),trim(p_away_score),p_winner_team_id,nullif(trim(p_notes),''),'admin_override',now())
 on conflict(fixture_id) do update set home_score=excluded.home_score,away_score=excluded.away_score,winner_team_id=excluded.winner_team_id,notes=excluded.notes,status='admin_override',confirmed_at=now();
 update public.result_submissions set status='admin_approved',updated_at=now() where fixture_id=p_fixture_id and status in('pending_opponent','disputed');
 update public.fixtures set status='confirmed' where id=p_fixture_id;
 perform public.recalculate_standings_for_season(v_fixture.season_id);
end;$$;
create or replace function public.rallora_admin_reopen_fixture(p_fixture_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_fixture public.fixtures%rowtype;
begin
 select * into v_fixture from public.fixtures where id=p_fixture_id for update;
 if not found then raise exception 'Fixture not found'; end if;
 if not public.rallora_can_manage_fixture(p_fixture_id) then raise exception 'Not authorised'; end if;
 delete from public.results where fixture_id=p_fixture_id;
 update public.result_submissions set status='disputed',confirmed_at=null,opponent_confirmed_by_user_id=null,updated_at=now() where fixture_id=p_fixture_id and status in('pending_opponent','confirmed_by_opponent','admin_approved');
 update public.fixtures set status='disputed' where id=p_fixture_id;
 perform public.recalculate_standings_for_season(v_fixture.season_id);
end;$$;
revoke all on function public.rallora_admin_resolve_result(uuid,text,text,uuid,text),public.rallora_admin_reopen_fixture(uuid) from public,anon;
grant execute on function public.rallora_admin_resolve_result(uuid,text,text,uuid,text),public.rallora_admin_reopen_fixture(uuid) to authenticated;
commit;