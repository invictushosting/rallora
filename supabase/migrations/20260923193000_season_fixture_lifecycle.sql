-- Pilot-safe season lifecycle and fixture scheduling controls.
begin;
create unique index if not exists fixtures_unique_matchup_week_idx on public.fixtures(season_id,division_id,week_number,home_team_id,away_team_id);
create or replace function public.rallora_set_season_status(p_season_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_season public.seasons%rowtype;
begin
 if p_status not in ('draft','active','completed') then raise exception 'Invalid season status'; end if;
 select * into v_season from public.seasons where id=p_season_id for update;
 if not found then raise exception 'Season not found'; end if;
 if not public.rallora_can_manage_club(v_season.club_id) then raise exception 'Not authorised'; end if;
 if p_status='active' then update public.seasons set status='completed' where club_id=v_season.club_id and status='active' and id<>p_season_id; end if;
 update public.seasons set status=p_status where id=p_season_id;
end;$$;
create or replace function public.rallora_update_fixture_schedule(p_fixture_id uuid,p_week_number integer,p_play_by date,p_available_from date)
returns void language plpgsql security definer set search_path='' as $$
declare v_fixture public.fixtures%rowtype;
begin
 select * into v_fixture from public.fixtures where id=p_fixture_id for update;
 if not found then raise exception 'Fixture not found'; end if;
 if not public.rallora_can_manage_fixture(p_fixture_id) then raise exception 'Not authorised'; end if;
 if v_fixture.status='confirmed' then raise exception 'Confirmed fixtures cannot be rescheduled'; end if;
 if p_week_number<1 or p_week_number>1000 then raise exception 'Invalid week number'; end if;
 if p_play_by is null or p_available_from is null or p_available_from>p_play_by then raise exception 'Invalid fixture dates'; end if;
 update public.fixtures set week_number=p_week_number,play_by=p_play_by,available_from=p_available_from where id=p_fixture_id;
end;$$;
create or replace function public.rallora_cancel_fixture(p_fixture_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_fixture public.fixtures%rowtype;
begin
 select * into v_fixture from public.fixtures where id=p_fixture_id for update;
 if not found then raise exception 'Fixture not found'; end if;
 if not public.rallora_can_manage_fixture(p_fixture_id) then raise exception 'Not authorised'; end if;
 if exists(select 1 from public.results where fixture_id=p_fixture_id) then raise exception 'Remove or reopen the official result before cancelling this fixture'; end if;
 update public.result_submissions set status='disputed',updated_at=now() where fixture_id=p_fixture_id and status in('pending_opponent','confirmed_by_opponent');
 update public.fixtures set status='cancelled' where id=p_fixture_id;
end;$$;
revoke all on function public.rallora_set_season_status(uuid,text),public.rallora_update_fixture_schedule(uuid,integer,date,date),public.rallora_cancel_fixture(uuid) from public,anon;
grant execute on function public.rallora_set_season_status(uuid,text),public.rallora_update_fixture_schedule(uuid,integer,date,date),public.rallora_cancel_fixture(uuid) to authenticated;
commit;