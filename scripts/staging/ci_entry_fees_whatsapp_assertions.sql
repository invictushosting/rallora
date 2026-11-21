begin;
do $$
declare
  admin_id uuid:='00000000-0000-0000-0000-000000000999';
  foreign_admin uuid:='00000000-0000-0000-0000-000000000b01';
  club uuid:=gen_random_uuid(); season uuid:=gen_random_uuid(); division uuid:=gen_random_uuid();
  payer uuid:=gen_random_uuid(); other_player uuid:=gen_random_uuid();
  home uuid:=gen_random_uuid(); away uuid:=gen_random_uuid(); fixture uuid:=gen_random_uuid();
  entry uuid:=gen_random_uuid(); roster_request uuid; version uuid; job uuid; code text;
  zone text; worker text; result jsonb; rejected boolean;
  number text:='+447700900123';
begin
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  insert into public.clubs(id,slug,name) values(club,'fees-wa-ci','Fees WA CI');
  insert into public.rallora_club_memberships(club_id,user_id,role,status) values(club,admin_id,'organiser','active');
  insert into auth.users(id,email) values(payer,'fee-payer@example.invalid'),(other_player,'fee-other@example.invalid');
  insert into public.seasons(id,club_id,name,status,starts_on,ends_on,registration_published)
    values(season,club,'Paid league','draft',current_date,current_date+14,true);
  insert into public.divisions(id,season_id,name) values(division,season,'Box');
  set local role authenticated;
  insert into public.rallora_club_entry_fees(season_id,enabled,amount_pence,method,instructions,refund_terms)
    values(season,true,2500,'bank_transfer','Use test bank instructions','Refund terms for this test') returning rallora_club_entry_fees.version into version;
  reset role;
  set local role anon;
  result:=public.rallora_entry_fee_quote(season);
  if (result->>'amount_pence')::integer is distinct from 2500 or result?'instructions' then raise exception 'Public fee quote is incorrect'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub',payer::text,true);
  set local role authenticated;
  rejected:=false;
  begin
    insert into public.rallora_team_applications(id,club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email)
      values(entry,club,season,payer,'Paid pair','Fee payer','Paid partner','fee-partner@example.invalid');
  exception when raise_exception then
    if sqlerrm not like 'The entry fee has changed%' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'Fee terms acceptance could be skipped'; end if;
  insert into public.rallora_team_applications(id,club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email,entry_fee_version)
    values(entry,club,season,payer,'Paid pair','Fee payer','Paid partner','fee-partner@example.invalid',version);
  if not exists(select 1 from public.rallora_entry_payments p where p.application_id=entry
    and p.status='awaiting_payment' and p.amount_pence=2500 and length(p.payment_reference)=16) then raise exception 'Payer cannot see snapshotted fee'; end if;
  rejected:=false;
  begin perform public.rallora_record_entry_payment(entry,'paid'); exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Payer was able to mark own entry paid'; end if;
  result:=public.rallora_whatsapp_preference('request',number);
  code:=result->>'code';
  if result->>'status'<>'pending' then raise exception 'Number was enabled without verification'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub',foreign_admin::text,true);
  set local role authenticated;
  if exists(select 1 from public.rallora_entry_payments where application_id=entry) then raise exception 'Cross-club fee details leaked'; end if;
  rejected:=false;
  begin perform public.rallora_record_entry_payment(entry,'paid'); exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Other club could mark entry paid'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  set local role authenticated;
  update public.rallora_club_entry_fees set amount_pence=3000 where season_id=season;
  rejected:=false;
  begin perform public.rallora_review_team_application(entry,'approved',division);
  exception when raise_exception then
    if sqlerrm<>'Record the full entry payment before approving this pair' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'Unpaid entry was approved'; end if;
  perform public.rallora_record_entry_payment(entry,'paid');
  perform public.rallora_record_entry_payment(entry,'paid');
  home:=public.rallora_review_team_application(entry,'approved',division);
  if not exists(select 1 from public.rallora_entry_payments where application_id=entry and amount_pence=2500 and status='paid') then
    raise exception 'Entry lost original amount or paid state';
  end if;
  perform public.rallora_record_entry_payment(entry,'refunded');
  reset role;
  if (select count(*) from rallora_private.entry_payment_audit where application_id=entry and actor_id=admin_id)<>2 then
    raise exception 'Expected one recorded payment and one recorded refund';
  end if;

  if has_function_privilege('authenticated','public.rallora_whatsapp_inbound(text,text,text)','EXECUTE') then
    raise exception 'Browser can bypass signed inbound webhook';
  end if;
  set local role service_role;
  perform public.rallora_whatsapp_inbound('SM'||repeat('1',32),'+447700900124','JOIN '||code);
  reset role;
  if exists(select 1 from rallora_private.whatsapp_preferences where user_id=payer and confirmed_at is not null) then raise exception 'Wrong WhatsApp number confirmed a player'; end if;
  set local role service_role;
  perform public.rallora_whatsapp_inbound('SM'||repeat('2',32),number,'JOIN '||code);
  reset role;
  if not exists(select 1 from rallora_private.whatsapp_preferences where user_id=payer and confirmed_at is not null) then raise exception 'Verified phone remained pending'; end if;

  insert into public.teams(id,division_id,name,player_one_name,player_two_name) values(away,division,'Away pair','Away One','Away Two');
  insert into public.fixtures(id,season_id,division_id,home_team_id,away_team_id,play_by,available_from,status)
    values(fixture,season,division,home,away,current_date+2,current_date,'open');
  insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status)
    values(club,season,division,away,other_player,'Away One','approved') returning id into roster_request;
  insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role)
    values(roster_request,club,season,division,away,other_player,'captain');
  update public.seasons set status='active',registration_published=false where id=season;
  select name into zone from pg_timezone_names where extract(hour from now() at time zone name)=12 limit 1;
  insert into public.rallora_communication_settings(club_id,enabled,whatsapp_enabled,timezone,send_hour,quiet_end_hour)
    values(club,true,true,zone,0,23);
  update public.rallora_communication_settings set rules=jsonb_set(jsonb_set(rules,'{booking,email}','false'),'{booking,in_app}','false') where club_id=club;
  perform rallora_private.generate_reminders();
  if (select count(*) from rallora_private.whatsapp_deliveries d join public.rallora_delivery_queue q on q.id=d.delivery_id
      where q.fixture_id=fixture)<>1 then raise exception 'WhatsApp-only channel did not queue precisely the opted-in player'; end if;
  select token into worker from rallora_private.delivery_worker_config;
  rejected:=false;
  begin perform public.rallora_claim_whatsapp_reminder(repeat('0',64)); exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Invalid worker token accepted'; end if;
  result:=public.rallora_claim_whatsapp_reminder(worker);
  if result->>'to' is distinct from number then raise exception 'Incorrect WhatsApp recipient'; end if;
  if public.rallora_claim_whatsapp_reminder(worker) is not null then raise exception 'WhatsApp job claimed twice'; end if;
  perform public.rallora_finish_whatsapp_reminder(worker,(result->>'id')::uuid,'SM'||repeat('3',32),'accepted');

  job:=rallora_private.enqueue_message(club,payer,null,'booking','wa-stop-test','Reminder','Test','/clubs/fees-wa-ci/captain',fixture);
  perform rallora_private.whatsapp_inbound('SM'||repeat('4',32),number,'STOP');
  if public.rallora_claim_whatsapp_reminder(worker) is not null then raise exception 'Opted-out player still received queued reminder'; end if;
  if not exists(select 1 from rallora_private.whatsapp_deliveries where delivery_id=job and status='cancelled') then
    raise exception 'Opt-out did not cancel the queued delivery';
  end if;
end $$;
rollback;
