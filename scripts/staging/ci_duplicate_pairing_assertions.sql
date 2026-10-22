begin;
do $$
declare a uuid; b uuid; other_club uuid; other_season uuid; team uuid; inv uuid; n integer; blocked boolean;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
 insert into public.rallora_communication_settings(club_id,enabled) values('00000000-0000-0000-0000-0000000000a1',true)
 on conflict(club_id) do update set enabled=true;
 insert into public.rallora_player_profiles(user_id,display_name,playtomic_email)
 values('22222222-2222-2222-2222-222222222222','Partner B','hidden@privaterelay.appleid.com')
 on conflict(user_id) do update set playtomic_email=excluded.playtomic_email;
 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email,partner_playtomic_email)
 values('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000001a1','11111111-1111-1111-1111-111111111111','Captain A / Partner B','Captain A','Partner B','captain-b@example.test','hidden@privaterelay.appleid.com') returning id into a;
 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email)
 values('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000001a1','22222222-2222-2222-2222-222222222222','Partner B / Captain A','Partner B','Captain A','captain-a@example.test') returning id into b;
 if not exists(select 1 from public.rallora_registration_duplicates('00000000-0000-0000-0000-0000000000a1') where application_id=a and matching_id=b and confidence='email') then raise exception 'Reversed pairing or relay email was not identified'; end if;
 -- Matching names in another club or competition must never be returned or closable.
 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email)
 values('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000001b2','11111111-1111-1111-1111-111111111111','Other club pair','Captain A','Partner B','captain-b@example.test') returning id into other_club;
 insert into public.seasons(id,club_id,name,status) values('00000000-0000-0000-0000-0000000091a1','00000000-0000-0000-0000-0000000000a1','Other competition','draft');
 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email)
 values('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000091a1','11111111-1111-1111-1111-111111111111','Other season pair','Captain A','Partner B','captain-b@example.test') returning id into other_season;
 if exists(select 1 from public.rallora_registration_duplicates('00000000-0000-0000-0000-0000000000a1') where application_id=a and matching_id in(other_club,other_season)) then raise exception 'Duplicate matching crossed competition boundaries'; end if;
 blocked:=false;
 begin perform public.rallora_close_duplicate_application(b,other_club); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Cross-club duplicate closure allowed'; end if;
 -- A non-manager cannot list private comparisons or close somebody else's application.
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 blocked:=false;
 begin perform public.rallora_registration_duplicates('00000000-0000-0000-0000-0000000000a1'); exception when raise_exception then blocked:=sqlerrm='Not authorised'; end;
 if not blocked then raise exception 'Unauthorised duplicate disclosure'; end if;
 blocked:=false;
 begin perform public.rallora_close_duplicate_application(b,a); exception when raise_exception then blocked:=sqlerrm='Not authorised'; end;
 if not blocked then raise exception 'Unauthorised closure'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
 team:=public.rallora_review_team_application(a,'approved','00000000-0000-0000-0000-0000000002a1');
 select partner_invite_id into inv from public.rallora_team_applications where id=a;
 select count(*) into n from public.teams;
 blocked:=false;
 begin perform public.rallora_review_team_application(b,'approved','00000000-0000-0000-0000-0000000002a1'); exception when raise_exception then blocked:=sqlerrm like 'This pairing is already approved%'; end;
 if not blocked or (select count(*) from public.teams)<>n then raise exception 'Second approval was not rolled back atomically'; end if;
 if (select status from public.rallora_team_applications where id=b)<>'pending' then raise exception 'Blocked approval changed the duplicate entry'; end if;
 perform public.rallora_close_duplicate_application(b,a);
 if not exists(select 1 from public.rallora_team_applications where id=b and status='duplicate' and duplicate_of=a) then raise exception 'Duplicate closure not recorded'; end if;
 if not exists(select 1 from public.rallora_team_applications where id=a and status='approved' and created_team_id=team and partner_invite_id=inv) then raise exception 'Retained entry affected'; end if;
 if not exists(select 1 from public.rallora_team_member_invites where id=inv and status='pending') then raise exception 'Partner invite affected'; end if;
 if exists(select 1 from public.rallora_delivery_queue where event_key='declined:'||b) then raise exception 'Duplicate closure sent rejection'; end if;
 if not exists(select 1 from public.rallora_delivery_queue where event_key='duplicate:'||b and body like '%other registration has been approved%') then raise exception 'Missing accurate duplicate message'; end if;
 -- The closed duplicate's owner can still claim the original partner invitation.
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 perform set_config('request.jwt.claims','{"email":"captain-b@example.test"}',true);
 if public.rallora_claim_team_invite(inv)<>team then raise exception 'Duplicate closure blocked partner claim'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
 -- Repeated closure cannot send additional emails.
 blocked:=false;
 begin perform public.rallora_close_duplicate_application(b,a); exception when raise_exception then blocked:=true; end;
 if not blocked or (select count(*) from public.rallora_delivery_queue where event_key='duplicate:'||b)<>1 then raise exception 'Repeated closure was not idempotently rejected'; end if;
 if has_function_privilege('anon','public.rallora_registration_duplicates(uuid)','EXECUTE') or has_function_privilege('anon','public.rallora_close_duplicate_application(uuid,uuid)','EXECUTE') then raise exception 'Anonymous duplicate operations exposed'; end if;
end $$;
rollback;

begin;
do $$
declare a uuid;b uuid;t uuid;blocked boolean;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
 insert into public.rallora_communication_settings(club_id,enabled) values('00000000-0000-0000-0000-0000000000a1',true) on conflict(club_id) do update set enabled=true;
 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email)
 values('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000001a1','11111111-1111-1111-1111-111111111111','Same names first','Shared Name','Other Name','one@example.test') returning id into a;
 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email)
 values('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000001a1','22222222-2222-2222-2222-222222222222','Same names second',' other  NAME ','SHARED NAME','two@example.test') returning id into b;
 if not exists(select 1 from public.rallora_registration_duplicates('00000000-0000-0000-0000-0000000000a1') where application_id=b and matching_id=a and confidence='name') then raise exception 'Name-only warning missing'; end if;
 -- An organiser may explicitly close a name-only match after reviewing it.
 perform public.rallora_close_duplicate_application(b,a);
 if (select status from public.rallora_team_applications where id=a)<>'pending' then raise exception 'Retained pending entry changed'; end if;
 if not exists(select 1 from public.rallora_delivery_queue where event_key='duplicate:'||b and body like '%still awaiting club review%') then raise exception 'Pending duplicate message promises approval'; end if;
end $$;
rollback;

-- Names alone must never block approval of genuinely different players.
begin;
do $$
declare a uuid;b uuid;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email)
 values('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000001a1','11111111-1111-1111-1111-111111111111','Name only first','Shared Name','Other Name','one@example.test') returning id into a;
 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email)
 values('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000001a1','22222222-2222-2222-2222-222222222222','Name only second','Other Name','Shared Name','two@example.test') returning id into b;
 perform public.rallora_review_team_application(a,'approved','00000000-0000-0000-0000-0000000002a1');
 perform public.rallora_review_team_application(b,'approved','00000000-0000-0000-0000-0000000002a1');
 if (select count(*) from public.rallora_team_applications where id in(a,b) and status='approved')<>2 then raise exception 'Names alone blocked approval'; end if;
end $$;
rollback;
