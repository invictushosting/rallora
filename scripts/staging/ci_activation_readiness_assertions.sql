-- Synthetic activation checks; no test rows survive this transaction.
begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
do $$
declare club uuid:='00000000-0000-0000-0000-0000000000a1'; season uuid:=gen_random_uuid();division uuid:=gen_random_uuid();
  home uuid:=gen_random_uuid(); away uuid:=gen_random_uuid(); fixture uuid; successor uuid:=gen_random_uuid();
  candidate uuid:=gen_random_uuid(); candidate_division uuid:=gen_random_uuid(); candidate_home uuid:=gen_random_uuid(); candidate_away uuid:=gen_random_uuid();
  rejected boolean; original_active uuid[]; after_active uuid[]; message text;
begin
  select array_agg(id order by id) into original_active from public.seasons where club_id=club and status='active';
  rejected:=false;
  begin insert into public.seasons(id,club_id,name,status) values(season,club,'Cannot launch empty','active'); exception when raise_exception then rejected:=true; end;
  if not rejected or exists(select 1 from public.seasons where id=season) then raise exception 'Direct active insert bypassed readiness'; end if;
  insert into public.seasons(id,club_id,name,status) values(season,club,'Activation verification','draft');
  rejected:=false;
  begin perform public.rallora_set_season_status(season,'active');exception when raise_exception then rejected:=true;get stacked diagnostics message=message_text;end;
  if not rejected or message not like 'Create divisions%' then raise exception 'Missing divisions accepted or wrong error: %',message; end if;
  select array_agg(id order by id) into after_active from public.seasons where club_id=club and status='active';
  if original_active is distinct from after_active then raise exception 'Failed activation changed existing active seasons'; end if;
  insert into public.divisions(id,season_id,name,sort_order) values(division,season,'Verification',1);
  insert into public.teams(id,division_id,name) values(home,division,'Home');
  rejected:=false;begin update public.seasons set status='active' where id=season;exception when raise_exception then rejected:=true;end;
  if not rejected then raise exception 'Direct update accepted one team'; end if;
  insert into public.teams(id,division_id,name) values(away,division,'Away');
  rejected:=false;begin perform public.rallora_set_season_status(season,'active');exception when raise_exception then rejected:=true;get stacked diagnostics message=message_text;end;
  if not rejected or message not like 'Create a non-cancelled%' then raise exception 'Missing fixtures accepted: %',message; end if;
  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,available_from,status)
    values(season,division,home,away,1,current_date+7,current_date,'cancelled') returning id into fixture;
  rejected:=false;begin perform public.rallora_set_season_status(season,'active');exception when raise_exception then rejected:=true;end;
  if not rejected then raise exception 'Cancelled fixture satisfied launch readiness'; end if;
  update public.fixtures set status='open' where id=fixture;
  update public.seasons set registration_published=true where id=season;
  rejected:=false;begin perform public.rallora_set_season_status(season,'active');exception when raise_exception then rejected:=true;get stacked diagnostics message=message_text;end;
  if not rejected or message not like 'Close registration%' then raise exception 'Open registration activated: %',message; end if;
  update public.seasons set registration_published=false where id=season;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000b01',true);
  rejected:=false;begin perform public.rallora_set_season_status(season,'active');exception when raise_exception then rejected:=true;end;
  if not rejected then raise exception 'Other club owner activated competition'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  rejected:=false;begin perform public.rallora_set_season_status(season,'active');exception when raise_exception then rejected:=true;end;
  if not rejected then raise exception 'Signed-out activation accepted'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
  -- The approved RPC completes the old competition and activates a ready draft.
  perform public.rallora_set_season_status(season,'active');
  if (select status from public.seasons where id=season)<>'active' then raise exception 'Ready competition not activated'; end if;
  if (select count(*) from public.seasons where club_id=club and status='active')<>1 then raise exception 'Multiple active competitions after activation'; end if;
  perform public.rallora_set_season_status(season,'active'); -- idempotent
  insert into public.seasons(id,club_id,name,status) values(candidate,club,'Second ready draft','draft');
  insert into public.divisions(id,season_id,name,sort_order) values(candidate_division,candidate,'Second division',1);
  insert into public.teams(id,division_id,name) values(candidate_home,candidate_division,'Second home'),(candidate_away,candidate_division,'Second away');
  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,available_from,status)
    values(candidate,candidate_division,candidate_home,candidate_away,1,current_date+7,current_date,'open');
  rejected:=false;begin update public.seasons set status='active' where id=candidate;exception when raise_exception then rejected:=true;get stacked diagnostics message=message_text;end;
  if not rejected or message not like 'Another competition is active%' then raise exception 'Direct write created two active competitions: %',message; end if;
  perform public.rallora_set_season_status(candidate,'active');
  if (select count(*) from public.seasons where club_id=club and status='active')<>1 or (select status from public.seasons where id=season)<>'completed' then raise exception 'Second activation did not complete prior competition'; end if;
  insert into public.seasons(id,club_id,name,status,previous_season_id,rolling_cycle_number)
    values(successor,club,'Private successor','draft',season,2);
  perform public.rallora_set_season_status(season,'completed');
  rejected:=false;begin perform public.rallora_set_season_status(season,'active');exception when raise_exception then rejected:=true;get stacked diagnostics message=message_text;end;
  if not rejected or message not like 'This cycle has a successor%' then raise exception 'Historical cycle reactivated: %',message; end if;
end $$;
rollback;
