-- Run only in the disposable synthetic CI database. Every change rolls back.
begin;
do $$
declare
  sid uuid := '00000000-0000-0000-0000-0000000001a1';
  cid uuid := '00000000-0000-0000-0000-0000000000a1';
  admin_id uuid := '00000000-0000-0000-0000-000000000999';
  open_id uuid; submitted_id uuid; disputed_id uuid; cancelled_id uuid;
  old_plan jsonb := '[{"starts_on":"2026-11-01","ends_on":"2026-11-30"},{"starts_on":"2026-12-01","ends_on":"2026-12-31"},{"starts_on":"2027-01-01","ends_on":"2027-03-31"}]';
  future jsonb := '[{"starts_on":"2026-12-27","ends_on":"2027-01-26"},{"starts_on":"2027-01-27","ends_on":"2027-03-31"}]';
  changed_plan jsonb;
  other_before jsonb; result_before jsonb; confirmed_before jsonb; response jsonb;
begin
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  update public.seasons set starts_on='2026-11-01',ends_on='2026-11-30',competition_ends_on='2027-03-31',
    round_windows=old_plan,fixture_schedule_mode='date_window',status='active' where id=sid;
  update public.fixtures set status='confirmed' where season_id=sid;
  select jsonb_agg(to_jsonb(f)) into confirmed_before from public.fixtures f where season_id=sid;
  select jsonb_agg(to_jsonb(r)) into result_before from public.results r;
  select jsonb_agg(to_jsonb(s)) into other_before from public.seasons s where id<>sid;

  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,available_from,status,booking_starts_at,booking_ends_at)
  values(sid,'00000000-0000-0000-0000-0000000002a1','00000000-0000-0000-0000-0000000003a1','00000000-0000-0000-0000-0000000003a2',501,'2026-11-30','2026-11-01','open','2026-11-20 10:00Z','2026-11-20 11:00Z') returning id into open_id;
  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,available_from,status)
  values(sid,'00000000-0000-0000-0000-0000000002a1','00000000-0000-0000-0000-0000000003a1','00000000-0000-0000-0000-0000000003a2',502,'2026-11-30','2026-11-01','submitted') returning id into submitted_id;
  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,available_from,status)
  values(sid,'00000000-0000-0000-0000-0000000002a1','00000000-0000-0000-0000-0000000003a1','00000000-0000-0000-0000-0000000003a2',503,'2026-11-30','2026-11-01','disputed') returning id into disputed_id;
  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,available_from,status)
  values(sid,'00000000-0000-0000-0000-0000000002a1','00000000-0000-0000-0000-0000000003a1','00000000-0000-0000-0000-0000000003a2',504,'2026-11-30','2026-11-01','cancelled') returning id into cancelled_id;

  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.rallora_update_round_dates(sid,'2026-11-30',old_plan,'2026-12-20',future); raise exception 'anonymous accepted';
  exception when others then if sqlerrm not like 'Sign in%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000b01',true);
  begin perform public.rallora_update_round_dates(sid,'2026-11-30',old_plan,'2026-12-20',future); raise exception 'other club accepted';
  exception when others then if sqlerrm<>'Not authorised' then raise; end if; end;
  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  begin perform public.rallora_update_round_dates(sid,'2026-11-30',old_plan,'2026-12-20',future); raise exception 'player accepted';
  exception when others then if sqlerrm<>'Not authorised' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);

  begin perform public.rallora_update_round_dates(sid,'2026-11-30',old_plan,'2026-12-20',old_plan-0); raise exception 'overlap accepted';
  exception when others then if sqlerrm not like 'Each round%' then raise; end if; end;
  begin perform public.rallora_update_round_dates(sid,'2026-11-30',old_plan,'2026-12-20','[]'); raise exception 'dropped rounds accepted';
  exception when others then if sqlerrm not like 'The saved schedule%' then raise; end if; end;
  begin perform public.rallora_update_round_dates(sid,'2026-11-29',old_plan,'2026-12-20',future); raise exception 'stale edit accepted';
  exception when others then if sqlerrm not like 'The schedule has changed%' then raise; end if; end;
  begin perform public.rallora_update_round_dates(sid,'2026-11-30',old_plan,'2026-11-15',future); raise exception 'stranded booking accepted';
  exception when others then if sqlerrm not like 'A fixture opens%' then raise; end if; end;

  insert into public.rallora_delivery_queue(club_id,recipient_user_id,recipient_email,category,event_key,fixture_id,title,body,action_url,email_enabled,in_app_enabled,payload)
  values(cid,admin_id,'synthetic@example.test','overdue','round-edit-test',open_id,'Old reminder','Old deadline','/clubs/club-a/captain',true,false,'{}');
  response:=public.rallora_update_round_dates(sid,'2026-11-30',old_plan,'2026-12-20',future);
  if (response->>'fixtures_updated')::integer<>3 then raise exception 'Did not update all three outstanding statuses'; end if;
  if exists(select 1 from public.fixtures where id in(open_id,submitted_id,disputed_id) and play_by<>'2026-12-20') then raise exception 'Outstanding deadline mismatch'; end if;
  if (select available_from from public.fixtures where id=open_id)<>'2026-11-01' or (select booking_ends_at from public.fixtures where id=open_id)<>'2026-11-20 11:00Z' then raise exception 'Booking or publication changed'; end if;
  if (select play_by from public.fixtures where id=cancelled_id)<>'2026-11-30' then raise exception 'Cancelled fixture changed'; end if;
  if confirmed_before is distinct from (select jsonb_agg(to_jsonb(f)) from public.fixtures f where season_id=sid and id not in(open_id,submitted_id,disputed_id,cancelled_id)) then raise exception 'Confirmed fixture changed'; end if;
  if result_before is distinct from (select jsonb_agg(to_jsonb(r)) from public.results r) then raise exception 'A result changed'; end if;
  if other_before is distinct from (select jsonb_agg(to_jsonb(s)) from public.seasons s where id<>sid) then raise exception 'Another league changed'; end if;
  if not exists(select 1 from public.rallora_delivery_queue where event_key like 'round-edit-test:rescheduled:%' and status='cancelled') then raise exception 'Old reminder was not retired'; end if;
  if not exists(select 1 from public.rallora_round_date_changes where season_id=sid and changed_by=admin_id and fixtures_updated=3) then raise exception 'Missing audit'; end if;
  select round_windows into changed_plan from public.seasons where id=sid;
  if changed_plan->1<>future->0 or changed_plan->0->>'ends_on'<>'2026-12-20' then raise exception 'Next round plan mismatch'; end if;
  begin perform public.rallora_update_round_dates(sid,'2026-11-30',old_plan,'2026-12-21',future); raise exception 'stale concurrent save accepted';
  exception when others then if sqlerrm not like 'The schedule has changed%' then raise; end if; end;

  -- A prepared successor locks the source cycle.
  insert into public.seasons(id,club_id,name,status,starts_on,ends_on,previous_season_id,rolling_cycle_number)
  values(gen_random_uuid(),cid,'Synthetic successor','draft','2026-12-27','2027-01-26',sid,2);
  begin perform public.rallora_update_round_dates(sid,'2026-12-20',changed_plan,'2026-12-21',future); raise exception 'history edit accepted';
  exception when others then if sqlerrm not like 'This round is complete%' then raise; end if; end;
end $$;
-- Public callers cannot bypass auth or forge audit history.
do $$ begin
 if has_function_privilege('anon','public.rallora_update_round_dates(uuid,date,jsonb,date,jsonb)','execute') then raise exception 'Anonymous RPC grant'; end if;
 if has_table_privilege('authenticated','public.rallora_round_date_changes','insert') then raise exception 'Writable audit history'; end if;
end $$;
rollback;
