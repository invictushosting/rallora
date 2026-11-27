begin;
do $$
declare
  c uuid := '00000000-0000-0000-0000-0000000000a1';
  manager uuid := '00000000-0000-0000-0000-000000000a01';
  player uuid := '11111111-1111-1111-1111-111111111111';
  s uuid := gen_random_uuid();
  top uuid := gen_random_uuid();
  bottom uuid := gen_random_uuid();
  withdrawn uuid;
  scheduled uuid;
  home_team uuid;
  away_team uuid;
  lower_team uuid;
  lower_second uuid;
  f_bye uuid;
  f_done uuid;
  f_other uuid;
  w uuid;
  scheduled_id uuid;
  next_round uuid;
  plan jsonb;
  denied boolean;
begin
  insert into auth.users(id,email) values(manager,'withdrawal-manager@example.test') on conflict (id) do nothing;
  perform set_config('request.jwt.claim.sub',manager::text,true);
  insert into public.seasons(id,club_id,name,status,league_format,starts_on,ends_on,competition_ends_on,
    promotion_places,relegation_places,require_cycle_completion)
  values(s,c,'Withdrawal competition','draft','promotion_relegation_cycles','2027-01-01','2027-01-31','2027-03-31',0,1,true);
  insert into public.divisions(id,season_id,name,sort_order) values(top,s,'Division A',1),(bottom,s,'Division B',2);
  insert into public.teams(division_id,name,is_active) values(top,'Withdrawn one',true) returning id into withdrawn;
  insert into public.teams(division_id,name,is_active) values(top,'Home one',true) returning id into home_team;
  insert into public.teams(division_id,name,is_active) values(top,'Away one',true) returning id into away_team;
  insert into public.teams(division_id,name,is_active) values(bottom,'Scheduled one',true) returning id into scheduled;
  insert into public.teams(division_id,name,is_active) values(bottom,'Lower one',true) returning id into lower_team;
  insert into public.teams(division_id,name,is_active) values(bottom,'Lower two',true) returning id into lower_second;

  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,status)
  values(s,top,withdrawn,home_team,1,'2027-01-31','open') returning id into f_bye;
  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,status)
  values(s,top,withdrawn,away_team,2,'2027-01-31','confirmed') returning id into f_done;
  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,status)
  values(s,bottom,scheduled,lower_team,1,'2027-01-31','confirmed') returning id into f_other;
  insert into public.results(fixture_id,status,home_score,away_score,winner_team_id) values
    (f_done,'confirmed','6','3',withdrawn),(f_other,'confirmed','3','6',lower_team);
  insert into public.rallora_fixture_arrangements(fixture_id,club_id,starts_at,ends_at,court,updated_by,updated_at)
  values(f_bye,c,'2027-01-20 14:00+00','2027-01-20 15:00+00','Court A',manager,now());

  perform set_config('request.jwt.claim.sub',player::text,true);
  denied:=false;
  begin
    perform public.rallora_preview_team_withdrawal(withdrawn);
  exception when raise_exception then denied:=true;
  end;
  if not denied or has_function_privilege('anon','public.rallora_withdraw_team(uuid,text,text,text,boolean)','execute')
    or has_table_privilege('authenticated','public.rallora_team_withdrawals','update') then
    raise exception 'Withdrawal privilege check failed';
  end if;
  perform set_config('request.jwt.claim.sub',manager::text,true);

  plan:=public.rallora_preview_team_withdrawal(withdrawn);
  if jsonb_array_length(plan->'fixtures')<>2
    or not exists(select from jsonb_array_elements(plan->'fixtures') x where x->>'decision'='preserve')
    or not exists(select from jsonb_array_elements(plan->'fixtures') x where x->>'booking_starts_at' is not null) then
    raise exception 'Preview did not explain result preservation and booking';
  end if;
  w:=public.rallora_withdraw_team(withdrawn,'now','Synthetic withdrawal',plan->>'snapshot',true);
  if (select status from public.fixtures where id=f_bye)<>'bye'
    or (select is_active from public.teams where id=withdrawn)
    or (select home_score from public.results where fixture_id=f_done)<>'6'
    or not exists(select from public.rallora_fixture_arrangements where fixture_id=f_bye and court='Court A')
    or not (rallora_private.fixture_context(f_bye)->>'closed')::boolean then
    raise exception 'Immediate withdrawal changed results or bookings, or failed to retire the fixture';
  end if;
  denied:=false;
  begin
    insert into public.results(fixture_id,status,home_score,away_score)
    values(f_bye,'confirmed','6','3');
  exception when raise_exception then denied:=true;
  end;
  if not denied then raise exception 'Result could be attached to bye'; end if;

  perform public.rallora_reinstate_team(w,false);
  if (select status from public.fixtures where id=f_bye)<>'open'
    or not (select is_active from public.teams where id=withdrawn)
    or not exists(select from public.rallora_team_withdrawals where id=w and reinstated_at is not null and reinstated_by=manager) then
    raise exception 'Reinstatement failed to restore the fixture or preserve the audit';
  end if;
  plan:=public.rallora_preview_team_withdrawal(withdrawn);
  perform public.rallora_withdraw_team(withdrawn,'now','Withdraw before progression',plan->>'snapshot',false);
  plan:=public.rallora_preview_team_withdrawal(scheduled);
  scheduled_id:=public.rallora_withdraw_team(scheduled,'next_round','Future withdrawal',plan->>'snapshot',false);
  if not (select is_active from public.teams where id=scheduled)
    or (select status from public.fixtures where id=f_other)<>'confirmed'
    or not exists(select from public.rallora_team_withdrawals where id=scheduled_id and timing='next_round') then
    raise exception 'Scheduled withdrawal changed current fixtures or team';
  end if;

  perform public.rallora_set_division_round_movement(top,null,0);
  if not exists(select from public.rallora_division_round_movement where division_id=top and relegation_places=0 and promotion_places is null)
    or exists(select from public.rallora_division_round_movement where division_id=bottom) then
    raise exception 'Movement override affected the wrong division or applied the wrong default';
  end if;
  -- Complete the current season directly, isolating progression from publication readiness.
  update public.seasons set status='completed' where id=s;
  next_round:=(public.rallora_create_next_cycle(s,'2027-02-01','2027-02-28')->>'season_id')::uuid;
  if exists(select from public.teams where previous_team_id in (withdrawn,scheduled))
    or (select count(*) from public.teams t join public.divisions d on d.id=t.division_id where d.season_id=next_round)<>4
    or (select relegation_places from public.seasons where id=next_round)<>1
    or exists(select from public.rallora_division_round_movement where season_id=next_round) then
    raise exception 'Next round ignored withdrawal, bye completion, or division movement override';
  end if;
end;
$$;
rollback;
