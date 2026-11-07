grant select,insert,update on public.rallora_support_requests to authenticated;
grant all on public.rallora_support_requests to service_role;
insert into auth.users values
 ('10000000-0000-0000-0000-000000000001','admin@example.test',now(),now()),
 ('10000000-0000-0000-0000-000000000002','player@example.test',now(),now()),
 ('10000000-0000-0000-0000-000000000003','other@example.test',now(),now());
insert into public.rallora_platform_admins values('10000000-0000-0000-0000-000000000001');
insert into public.rallora_player_profiles values('10000000-0000-0000-0000-000000000002','Synthetic Player','playtomic@example.test');
insert into public.clubs values('20000000-0000-0000-0000-000000000001','Synthetic Club','synthetic');
insert into public.seasons values('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Synthetic League');
insert into public.divisions values('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Division 2A');
insert into public.teams values('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',true,'Captain','Synthetic Player',null,null);
insert into public.rallora_team_member_invites(id,invited_email,invited_name,status,team_id,club_id,season_id) values
 ('60000000-0000-0000-0000-000000000001','player@example.test','Synthetic Player','pending','50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
 ('60000000-0000-0000-0000-000000000002','guest@example.test','Unclaimed Guest','pending','50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
insert into public.fixtures values('70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',null,'open',current_date);
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
do $$declare result jsonb; begin
 result:=public.rallora_support_player_lookup('PLAYER@EXAMPLE.TEST',true);
 assert jsonb_array_length(result)=1,'Account and invitation must not duplicate the player';
 assert (result->0->'teams'->0->>'hasAccess')::boolean=false,'Unclaimed invitation must not imply team access';
 assert (result->0->'teams'->0->>'openFixtures')::int=1,'Open fixtures missing';
 assert result->0->'invites'->0->>'status'='pending','Pending invitation missing';
 assert jsonb_array_length(public.rallora_support_player_lookup('playtomic@example.test',true))=1,'Playtomic email lookup failed';
 assert jsonb_array_length(public.rallora_support_player_lookup('synthetic player'))=1,'Name lookup failed';
 assert jsonb_array_length(public.rallora_support_player_lookup('guest@example.test',true))=1,'Invitation without an account missing';
 assert jsonb_array_length(public.rallora_support_player_lookup('pl'))=0,'Short searches must be bounded';
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
insert into public.rallora_support_requests(id,user_id,requester_email,requester_name,category,subject,message)
 values('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','player@example.test','Synthetic Player','match_chat','Cannot find chat','Synthetic request');
do $$begin
 begin perform public.rallora_support_player_lookup('player@example.test',true);raise exception 'Player search leaked';exception when insufficient_privilege then null;end;
 assert (select count(*)=0 from public.rallora_support_activities),'Player can read admin activity';
 assert (select count(*)=0 from public.rallora_support_messages),'Player can read messages';
 begin insert into public.rallora_support_messages(id,ticket_id,actor_id,actor_label,direction,body,recipient)
 values(gen_random_uuid(),'80000000-0000-0000-0000-000000000001',auth.uid(),'player','outbound','Forged message','other@example.test');raise exception 'Player forged support email';exception when insufficient_privilege then null;end;
 begin perform public.rallora_support_receive_reply(gen_random_uuid(),'forged','player@example.test','bad');raise exception 'Player invoked inbound API';exception when insufficient_privilege then null;end;
 insert into storage.objects(bucket_id,name) values('support-screenshots',auth.uid()::text||'/synthetic.png');
 begin insert into storage.objects(bucket_id,name) values('support-screenshots','10000000-0000-0000-0000-000000000003/forged.png');raise exception 'Wrong upload owner accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
do $$begin assert (select count(*)=0 from storage.objects),'Another player can read screenshot';assert(select count(*)=0 from public.rallora_support_requests),'Another player can read ticket';end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
update public.rallora_support_requests set status='waiting',assignee='Synthetic Admin' where id='80000000-0000-0000-0000-000000000001';
do $$begin
 assert (select count(*)=2 from public.rallora_support_activities),'Ticket history missing';
 assert (select count(*)=1 from public.rallora_support_activities where actor_label='admin@example.test'),'Admin identity missing';
 assert (select count(*)=1 from storage.objects),'Admin cannot view screenshot';
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
set role anon;
do $$begin begin perform public.rallora_support_player_lookup('player@example.test',true);raise exception 'Anonymous search allowed';exception when insufficient_privilege then null;end;end $$;
reset role;
set role service_role;
do $$declare token uuid; result text; begin
 select reply_token into token from public.rallora_support_requests where id='80000000-0000-0000-0000-000000000001';
 result:=public.rallora_support_receive_reply(token,'received-1','wrong@example.test','Wrong sender');assert result='unmatched','Sender mismatch accepted';
 result:=public.rallora_support_receive_reply(token,'received-1','player@example.test','Thanks for your help');assert result='received','Reply not received';
 assert (select status='in_progress' from public.rallora_support_requests where id='80000000-0000-0000-0000-000000000001'),'Reply did not reopen ticket';
 update public.rallora_support_requests set status='resolved' where id='80000000-0000-0000-0000-000000000001';
 result:=public.rallora_support_receive_reply(token,'received-1','player@example.test','Thanks for your help');assert result='duplicate','Duplicate reply accepted';
 assert (select status='resolved' from public.rallora_support_requests where id='80000000-0000-0000-0000-000000000001'),'Duplicate webhook reopened ticket';
 assert (select count(*)=1 from public.rallora_support_messages),'Duplicate message was saved';
end $$;
reset role;
