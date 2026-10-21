begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
do $$
declare club uuid:='00000000-0000-0000-0000-0000000000a1'; s uuid:=gen_random_uuid();d uuid:=gen_random_uuid();h uuid:=gen_random_uuid();a uuid:=gen_random_uuid();fx uuid:=gen_random_uuid();req uuid;cap uuid:='11111111-1111-1111-1111-111111111111';other uuid:=gen_random_uuid();q uuid;out jsonb;worker text;rejected boolean;zone text;first_count integer;app uuid;inv uuid;
begin
 select name into zone from pg_timezone_names where extract(hour from now() at time zone name)=12 limit 1;
 insert into auth.users(id,email) values(other,'reminder-other@example.invalid');
 update auth.users set email='reminder-captain@example.invalid' where id=cap;
 insert into public.seasons(id,club_id,name,status,starts_on,ends_on) values(s,club,'Communication test','draft',current_date-2,current_date+7);
 insert into public.divisions(id,season_id,name) values(d,s,'Box');
 insert into public.teams(id,division_id,name,player_one_name,player_two_name) values(h,d,'Home','Home One','Home Two'),(a,d,'Away','Away One','Away Two');
 insert into public.fixtures(id,season_id,division_id,home_team_id,away_team_id,play_by,available_from,status) values(fx,s,d,h,a,current_date+2,current_date-2,'open');
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status) values(club,s,d,h,cap,'Home captain','approved') returning id into req;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role) values(req,club,s,d,h,cap,'captain');
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status) values(club,s,d,a,other,'Away captain','approved') returning id into req;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role) values(req,club,s,d,a,other,'captain');
 perform public.rallora_set_season_status(s,'active');
 insert into public.rallora_communication_settings(club_id,timezone,send_hour,quiet_end_hour) values(club,zone,0,23);
 perform rallora_private.generate_reminders();
 if exists(select 1 from public.rallora_delivery_queue where fixture_id=fx) then raise exception 'Paused club generated reminders'; end if;
 update public.rallora_communication_settings set enabled=true where club_id=club;
 update public.rallora_communication_settings set rules=jsonb_set(rules,'{booking,hours}','1') where club_id=club;
 perform rallora_private.generate_reminders();
 if exists(select 1 from public.rallora_delivery_queue where fixture_id=fx) then raise exception 'One-hour reminder rounded to a whole day'; end if;
 update public.rallora_communication_settings set rules=jsonb_set(rules,'{booking,hours}','168') where club_id=club;
 perform rallora_private.generate_reminders();
 if (select count(*) from public.rallora_delivery_queue where fixture_id=fx)<>2 then raise exception 'Expected both captains to receive booking reminders'; end if;
 perform rallora_private.generate_reminders();
 if (select count(*) from public.rallora_delivery_queue where fixture_id=fx)<>2 then raise exception 'Scheduler duplicated reminders'; end if;
 out:=public.rallora_fixture_reminder(fx,false);
 if jsonb_array_length(out->'recipients')<>2 then raise exception 'Manual preview must show both captains'; end if;
 if (public.rallora_fixture_reminder(fx,true)->>'queued')::int<>0 then raise exception 'Manual duplicate guard failed'; end if;
 select token into worker from rallora_private.delivery_worker_config;
 rejected:=false;begin perform public.rallora_claim_deliveries(repeat('0',64));exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Invalid worker token accepted'; end if;
 -- A booking made after enqueueing cancels unbooked reminders at delivery time.
 perform public.rallora_save_fixture_arrangement(fx,now()+interval '20 hours',now()+interval '22 hours','Court 2');
 if rallora_private.reminder_relevant(fx,'booking',cap) then raise exception 'Booked match still receives booking reminder'; end if;
 out:=public.rallora_claim_deliveries(worker);
 if exists(select 1 from public.rallora_delivery_queue where fixture_id=fx and status<>'cancelled') then raise exception 'Stale booking reminders not cancelled'; end if;
 perform rallora_private.generate_reminders();
 if (select count(*) from public.rallora_delivery_queue where fixture_id=fx and category='upcoming')<>2 then raise exception 'Upcoming reminders missing'; end if;
 out:=public.rallora_claim_deliveries(worker);
 if jsonb_array_length(out)<>2 then raise exception 'Worker did not claim two messages: %',out; end if;
 if jsonb_array_length(public.rallora_claim_deliveries(worker))<>0 then raise exception 'Concurrent worker reclaimed locked jobs'; end if;
 q:=(out->0->>'id')::uuid;
 perform public.rallora_finish_delivery(worker,q,null,'Synthetic provider rejection');
 if not exists(select 1 from public.rallora_delivery_queue where id=q and status='queued' and attempts=1 and available_at>now()) then raise exception 'Failed delivery not queued for retry'; end if;
 perform public.rallora_finish_delivery(worker,(out->1->>'id')::uuid,'synthetic-provider-id',null);
 if not exists(select 1 from public.rallora_delivery_queue where id=(out->1->>'id')::uuid and status='accepted' and provider_id='synthetic-provider-id') then raise exception 'Acceptance not recorded'; end if;
 -- A submitted result changes who needs action: only the opposing captain is reminded.
 insert into public.result_submissions(fixture_id,submitting_team_id,submitted_by_user_id,home_score,away_score,winner_team_id,status,updated_at) values(fx,h,cap,'6,6','4,3',h,'pending_opponent',now()-interval '2 days');
 if rallora_private.reminder_relevant(fx,'confirmation',cap) or not rallora_private.reminder_relevant(fx,'confirmation',other) then raise exception 'Confirmation reminder recipients wrong'; end if;
 perform rallora_private.generate_reminders();
 if (select count(*) from public.rallora_delivery_queue where fixture_id=fx and category='confirmation')<>1 then raise exception 'Confirmation reminder count wrong'; end if;
 update public.fixtures set status='disputed' where id=fx;
 if rallora_private.reminder_relevant(fx,'confirmation',other) then raise exception 'Disputed fixture still chased'; end if;

 -- Queueing registration updates respects channel choice and does not duplicate in-app notices.
 update public.rallora_communication_settings set rules=jsonb_set(rules,'{registration,in_app}','false') where club_id=club;
 insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
 values(cap,club,'team_approved','Channel test','Approved','/clubs/club-a/captain');
 if exists(select 1 from public.rallora_notifications where title='Channel test') then raise exception 'Disabled in-app channel still received update'; end if;
 if not exists(select 1 from public.rallora_delivery_queue where title='Channel test' and email_enabled) then raise exception 'Email-only event was lost'; end if;
 -- A decision that changes before delivery cancels the stale action email.
 perform public.rallora_claim_deliveries(worker);
 if exists(select 1 from public.rallora_delivery_queue where source_submission_id is not null and title='Result awaiting confirmation' and status<>'cancelled') then
  -- It is still pending in this synthetic row; change it to close the action first.
  update public.result_submissions set status='admin_approved' where fixture_id=fx;
  update public.rallora_delivery_queue set status='queued',available_at=now(),locked_until=null where title='Result awaiting confirmation';
  perform public.rallora_claim_deliveries(worker);
  if exists(select 1 from public.rallora_delivery_queue where title='Result awaiting confirmation' and status<>'cancelled') then raise exception 'Stale review email not cancelled'; end if;
 end if;
 -- Muting a reminder after enqueue cancels it, rather than silently sending anyway.
 q:=rallora_private.enqueue_message(club,cap,null,'booking','mute-test','Mute test','Test','/clubs/club-a/captain');
 update public.rallora_communication_settings set rules=jsonb_set(rules,'{booking,enabled}','false') where club_id=club;
 perform public.rallora_claim_deliveries(worker);
 if not exists(select 1 from public.rallora_delivery_queue where id=q and status='cancelled') then raise exception 'Muted reminder still sent'; end if;
 -- RLS hides another club's settings and delivery recipients from a real authenticated role.
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000b01',true);
 set local role authenticated;
 if exists(select 1 from public.rallora_communication_settings where club_id=club) or exists(select 1 from public.rallora_delivery_queue where club_id=club) then raise exception 'Cross-club RLS leaked communication data'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);

 -- Respect quiet hours and the daily cap, including in-app-only messages.
 update public.rallora_communication_settings set send_hour=13,quiet_end_hour=23 where club_id=club;
 q:=rallora_private.enqueue_message(club,cap,null,'registration','quiet-hours-test','Quiet hours test','Test','/clubs/club-a/captain');
 perform public.rallora_claim_deliveries(worker);
 if not exists(select 1 from public.rallora_delivery_queue where id=q and status='queued' and attempts=0) then raise exception 'Quiet hours ignored'; end if;
 update public.rallora_communication_settings set send_hour=0,quiet_end_hour=23,daily_limit=1,rules=jsonb_set(rules,'{upcoming,email}','false') where club_id=club;
 q:=rallora_private.enqueue_message(club,cap,null,'upcoming','daily-cap-test','Daily cap test','Test','/clubs/club-a/captain');
 perform public.rallora_claim_deliveries(worker);
 if (select count(*) from public.rallora_delivery_queue where category in ('booking','upcoming','missing_result','confirmation','overdue') and recipient_user_id=cap and status='accepted' and (accepted_at at time zone zone)::date=(now() at time zone zone)::date)>1 then raise exception 'Daily reminder cap ignored'; end if;
 -- Removed captains must not receive pending reminders.
 if rallora_private.reminder_relevant(fx,'booking',cap) then raise exception 'Closed fixture unexpectedly relevant'; end if;
 -- Club separation, bad settings and historical/end-date guards.
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000b01',true);
 rejected:=false;begin perform public.rallora_fixture_reminder(fx,true);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Cross-club reminder permitted'; end if;
 rejected:=false;begin perform public.rallora_save_fixture_arrangement(fx,now(),now()+interval '1 hour','');exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Cross-club booking permitted'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
 rejected:=false;begin update public.rallora_communication_settings set rules=jsonb_set(rules,'{booking,hours}','-1') where club_id=club;exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Negative timing accepted'; end if;
 rejected:=false;begin update public.rallora_communication_settings set timezone='Bad/Timezone' where club_id=club;exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Invalid timezone accepted'; end if;
 update public.seasons set competition_ends_on=current_date+7 where id=s;
 rejected:=false;begin update public.seasons set ends_on=current_date+8 where id=s;exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Competition finish date ignored'; end if;
 -- No service role or worker token is available to a public caller without the capability.
 if has_table_privilege('anon','rallora_private.delivery_worker_config','SELECT') or has_table_privilege('authenticated','rallora_private.delivery_worker_config','SELECT') then raise exception 'Worker token exposed'; end if;
 if has_table_privilege('anon','public.rallora_delivery_queue','SELECT') then raise exception 'Recipient queue exposed publicly'; end if;
 if has_function_privilege('anon','public.rallora_fixture_reminder(uuid,boolean)','EXECUTE') then raise exception 'Manual reminder exposed publicly'; end if;
end $$;
rollback;
