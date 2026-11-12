-- Synthetic players and fixture; never uses a real user or sends an email.
begin;
do $$
declare
 club uuid:=gen_random_uuid();
 admin_id uuid:='00000000-0000-0000-0000-000000000999';
 home_partner uuid:=gen_random_uuid(); away_partner uuid:=gen_random_uuid();
 home_cap uuid:=gen_random_uuid(); away_cap uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 s uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); h uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
 req uuid; msg uuid:=gen_random_uuid(); proposal uuid:=gen_random_uuid(); next_proposal uuid:=gen_random_uuid();
 rejected boolean; sequence_value bigint; start_at timestamptz:=((current_date+2)::timestamp+interval '14 hours') at time zone 'Europe/London';
 submission uuid; worker text; payload jsonb; old_count integer; last_seq bigint;
begin
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 insert into public.clubs(id,slug,name) values(club,'chat-test-club','Chat Test Club');
 insert into public.rallora_club_memberships(club_id,user_id,role,status) values(club,admin_id,'organiser','active');
 update auth.users set email='chat-organiser@example.invalid' where id=admin_id;
 insert into auth.users(id,email) values(home_cap,'chat-home@example.invalid'),(away_cap,'chat-away@example.invalid'),(outsider,'chat-outsider@example.invalid'),(home_partner,'chat-home-partner@example.invalid'),(away_partner,'chat-away-partner@example.invalid');
 insert into public.seasons(id,club_id,name,status,starts_on,ends_on) values(s,club,'Chat league','draft',current_date+2,current_date+14);
 insert into public.divisions(id,season_id,name) values(d,s,'Chat division');
 insert into public.teams(id,division_id,name,player_one_name,player_two_name) values(h,d,'Home pair','Home captain','Partner H'),(a,d,'Away pair','Away captain','Partner A');
 insert into public.fixtures(id,season_id,division_id,home_team_id,away_team_id,play_by,available_from,status) values(f,s,d,h,a,current_date+7,current_date,'open');
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status) values(club,s,d,h,home_cap,'Home captain','approved') returning id into req;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role) values(req,club,s,d,h,home_cap,'captain');
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status) values(club,s,d,a,away_cap,'Away captain','approved') returning id into req;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role) values(req,club,s,d,a,away_cap,'captain');

 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status) values(club,s,d,h,home_partner,'Home partner','approved') returning id into req;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role) values(req,club,s,d,h,home_partner,'player');
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status) values(club,s,d,a,away_partner,'Away partner','approved') returning id into req;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role) values(req,club,s,d,a,away_partner,'player');
 update public.seasons set status='active',starts_on=current_date where id=s;
 insert into public.rallora_communication_settings(club_id,enabled,send_hour,quiet_end_hour) values(club,true,0,23)
 on conflict(club_id) do update set enabled=true;
 if not rallora_private.fixture_reminder_relevant(f,'booking',home_partner) or not rallora_private.fixture_reminder_relevant(f,'booking',away_partner) then raise exception 'Partners excluded from booking reminders'; end if;
 -- Partner records an actual booking, retaining their player role and actor.
 perform set_config('request.jwt.claim.sub',home_partner::text,true);
 set local role authenticated;
 payload:=public.rallora_fixture_conversation(f);
 if not (payload->>'can_record_booking')::boolean then raise exception 'Partner cannot record booking'; end if;
 perform public.rallora_save_fixture_arrangement(f,start_at,start_at+interval '90 minutes','Court 1',false);
 if not exists(select 1 from public.rallora_fixture_arrangements where fixture_id=f and updated_by=home_partner) then raise exception 'Booking actor missing'; end if;
 submission:=public.rallora_submit_captain_result(f,'6-4, 6-3','4-6, 3-6',h,'Partner submitted');
 if not exists(select 1 from public.result_submissions where id=submission and submitted_by_user_id=home_partner) then raise exception 'Partner cannot read own submitted result'; end if;
 rejected:=false;begin perform public.rallora_review_captain_result(submission,'confirm');exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Submitter confirmed own result'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',home_cap::text,true);
 set local role authenticated;
 rejected:=false;begin perform public.rallora_review_captain_result(submission,'confirm');exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Teammate confirmed own team result'; end if;
 rejected:=false;begin perform public.rallora_dispute_captain_result(submission,'No');exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Teammate disputed own team result'; end if;
 rejected:=false;begin perform public.rallora_submit_captain_result(f,'6-0','0-6',h);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Teammate overwrote pending score'; end if;
 rejected:=false;begin update public.result_submissions set status='confirmed_by_opponent' where id=submission;exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Direct score write bypassed review'; end if;
 reset role;
 if not rallora_private.fixture_reminder_relevant(f,'confirmation',away_partner) or rallora_private.fixture_reminder_relevant(f,'confirmation',home_partner) then raise exception 'Confirmation reminder sent to wrong side'; end if;
 -- Both opposing members receive review notices.
 if (select count(distinct recipient_user_id) from public.rallora_notifications where source_submission_id=submission and notification_type='result_review' and recipient_user_id in(away_cap,away_partner))<>2 then raise exception 'Opponent notification missing'; end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 set local role authenticated;
 if exists(select 1 from public.result_submissions where id=submission) then raise exception 'Outsider read private score'; end if;
 rejected:=false;begin perform public.rallora_review_captain_result(submission,'confirm');exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Outsider confirmed result'; end if;
 rejected:=false;begin perform public.rallora_save_fixture_arrangement(f,start_at,start_at+interval '1 hour','',false);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Outsider recorded booking'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',away_partner::text,true);
 set local role authenticated;
 if not exists(select 1 from public.result_submissions where id=submission) then raise exception 'Opponent partner cannot see score'; end if;
 perform public.rallora_review_captain_result(submission,'confirm');
 rejected:=false;begin perform public.rallora_review_captain_result(submission,'confirm');exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Result confirmed twice'; end if;
 reset role;
 if not exists(select 1 from public.results where fixture_id=f and status='confirmed') then raise exception 'Official result missing'; end if;
 if not exists(select 1 from public.result_submissions where id=submission and reviewed_by_user_id=away_partner and opponent_confirmed_by_user_id=away_partner and reviewed_at is not null) then raise exception 'Confirmation actor missing'; end if;
 if (select played from public.standings where season_id=s and team_id=h)<>1 then raise exception 'Standings counted incorrectly'; end if;
 if (select count(distinct recipient_user_id) from public.rallora_notifications where source_submission_id=submission and notification_type='result_confirmed_by_opponent')<>4 then raise exception 'Result update not sent to all four'; end if;
 if not exists(select 1 from public.rallora_fixture_player_actions where fixture_id=f and actor_user_id=home_partner and action='booking_recorded')
  or not exists(select 1 from public.rallora_fixture_player_actions where fixture_id=f and actor_user_id=away_partner and action='result_confirmed_by_opponent') then raise exception 'Action audit history missing'; end if;
 -- Draws follow the same opposing-player confirmation flow and configured points.
 insert into public.club_rules(id,club_id,season_id,draw_points) values(gen_random_uuid(),club,s,2);
 insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,available_from,status) values(s,d,h,a,3,current_date+7,current_date,'open') returning id into f;
 perform set_config('request.jwt.claim.sub',home_partner::text,true);
 set local role authenticated;
 submission:=public.rallora_submit_captain_result(f,'6, 4','4, 6',null,'Draw');
 if not exists(select 1 from public.result_submissions where id=submission and winner_team_id is null and status='pending_opponent') then raise exception 'Draw submission missing'; end if;
 reset role;
 if exists(select 1 from public.results where fixture_id=f) then raise exception 'Draw official before opponent confirmation'; end if;
 if exists(select 1 from public.standings where season_id=s and drawn<>0) then raise exception 'Pending draw awarded points'; end if;
 perform set_config('request.jwt.claim.sub',away_partner::text,true);
 set local role authenticated;
 perform public.rallora_review_captain_result(submission,'confirm');
 reset role;
 if not exists(select 1 from public.results where fixture_id=f and winner_team_id is null and status='confirmed') then raise exception 'Confirmed draw missing'; end if;
 if (select count(*) from public.standings where season_id=s and team_id in(h,a) and played=2 and drawn=1)<>2 then raise exception 'Draw not counted once for both teams'; end if;
 if not exists(select 1 from public.standings where season_id=s and team_id=h and points=5 and won=1 and lost=0)
  or not exists(select 1 from public.standings where season_id=s and team_id=a and points=2 and won=0 and lost=1) then raise exception 'Configured draw points incorrect'; end if;
 -- Organisers can correct a draw to a win and a win back to a draw.
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 set local role authenticated;
 perform public.rallora_admin_resolve_result(f,'6, 6','4, 4',h,'Corrected to win');
 reset role;
 if exists(select 1 from public.standings where season_id=s and drawn<>0) then raise exception 'Draw retained after correction to win'; end if;
 if not exists(select 1 from public.standings where season_id=s and team_id=h and won=2 and points=6) then raise exception 'Win points not restored'; end if;
 set local role authenticated;
 perform public.rallora_admin_resolve_result(f,'6, 4','4, 6',null,'Corrected to draw');
 reset role;
 if not exists(select 1 from public.results where fixture_id=f and winner_team_id is null and status='admin_override') then raise exception 'Admin draw missing'; end if;
 if (select count(*) from public.standings where season_id=s and team_id in(h,a) and played=2 and drawn=1)<>2
  or not exists(select 1 from public.standings where season_id=s and team_id=h and points=5)
  or not exists(select 1 from public.standings where season_id=s and team_id=a and points=2) then raise exception 'Draw correction duplicated points'; end if;
 -- Fresh fixture exercises an opposing partner dispute and its audit identity.
 insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,available_from,status) values(s,d,h,a,2,current_date+7,current_date,'open') returning id into f;
 perform set_config('request.jwt.claim.sub',home_cap::text,true);
 set local role authenticated;
 submission:=public.rallora_submit_captain_result(f,'6-4, 6-3','4-6, 3-6',h,'Original notes');
 reset role;
 perform set_config('request.jwt.claim.sub',away_partner::text,true);
 set local role authenticated;
 rejected:=false;begin perform public.rallora_dispute_captain_result(submission,' ');exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Blank dispute accepted'; end if;
 perform public.rallora_dispute_captain_result(submission,'Second set incorrect');
 reset role;
 if not exists(select 1 from public.result_submissions where id=submission and status='disputed' and reviewed_by_user_id=away_partner and notes='Original notes') then raise exception 'Dispute actor or notes missing'; end if;
 if exists(select 1 from public.results where fixture_id=f) then raise exception 'Disputed score became official'; end if;
 -- Removed members lose access immediately; closed rounds cannot be changed.
 delete from public.rallora_team_roster_memberships where player_user_id=home_partner;
 perform set_config('request.jwt.claim.sub',home_partner::text,true);
 set local role authenticated;
 if exists(select 1 from public.result_submissions where id=submission) then raise exception 'Removed partner read score'; end if;
 reset role;
 update public.fixtures set status='open' where id=f;
 update public.result_submissions set status='rejected' where id=submission;
 update public.seasons set status='completed' where id=s;
 perform set_config('request.jwt.claim.sub',away_partner::text,true);
 set local role authenticated;
 rejected:=false;begin perform public.rallora_submit_captain_result(f,'6-0','0-6',h);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Closed round accepted score'; end if;
 reset role;
 if not exists(select 1 from public.rallora_team_roster_memberships where player_user_id=away_partner and role='player') then raise exception 'Partner role changed'; end if;
 if has_function_privilege('anon','rallora_private.review_player_result(uuid,text,text)','EXECUTE') then raise exception 'Anonymous review granted'; end if;
end $$;
rollback;
