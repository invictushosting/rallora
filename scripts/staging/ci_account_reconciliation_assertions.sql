begin;

do $$
declare
 c uuid:='00000000-0000-0000-0000-0000000000a1';
 organiser uuid:='00000000-0000-0000-0000-000000000a01';
 season uuid:=gen_random_uuid();
 division uuid:=gen_random_uuid();
 captain_a uuid:=gen_random_uuid();
 captain_b uuid:=gen_random_uuid();
 partner_a uuid:=gen_random_uuid();
 partner_b uuid:=gen_random_uuid();
 standby_user uuid:=gen_random_uuid();
 app uuid;
 team_a uuid;
 team_b uuid;
 invite_a uuid;
 invite_b uuid;
 pool uuid;
 version bigint;
 other_version bigint;
 linked integer;
 fixture uuid;
 submission uuid;
 rejected boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (organiser,'reconcile-organiser@example.invalid',now()),
 (captain_a,'reconcile-captain-a@example.invalid',now()),
 (captain_b,'reconcile-captain-b@example.invalid',now()),
 (partner_a,'reconcile-partner-a@example.invalid',now()),
 (partner_b,'reconcile-partner-b@example.invalid',null),
 (standby_user,'reconcile-standby@example.invalid',null)
 on conflict(id) do nothing;
 insert into public.seasons(id,club_id,name,status) values(season,c,'Account reconciliation','draft');
 insert into public.divisions(id,season_id,name) values(division,season,'Division 1');
 perform set_config('request.jwt.claim.sub',organiser::text,true);

 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email,captain_playtomic_rating,partner_playtomic_rating)
 values(c,season,captain_a,'Captain A / Partner A','Captain A','Partner A','reconcile-partner-a@example.invalid',4,3)
 returning id into app;
 team_a:=public.rallora_review_team_application(app,'approved',division);
 select partner_invite_id into invite_a from public.rallora_team_applications where id=app;
 set constraints public.reconcile_new_partner_invite immediate;
 if not exists(select 1 from public.rallora_team_member_invites where id=invite_a and status='claimed' and claimed_by=partner_a)
 or not exists(select 1 from public.rallora_team_roster_memberships where team_id=team_a and player_user_id=partner_a and role='player')
 then raise exception 'Approval did not automatically link an existing verified account'; end if;
 set constraints public.reconcile_new_partner_invite deferred;

 select (entry->>'team_id')::uuid,(entry->>'partner_invite_id')::uuid into team_b,invite_b
 from public.rallora_admin_add_late_team_with_ratings(season,division,'new','Synthetic late registration',
  null,null,'Captain B','reconcile-captain-b@example.invalid','Partner B','reconcile-partner-b@example.invalid',4,3) entry;
 set constraints public.reconcile_new_partner_invite immediate;
 if not exists(select 1 from public.rallora_team_member_invites where id=invite_b and status='pending')
 then raise exception 'Unverified late partner invitation was linked'; end if;

 perform set_config('request.jwt.claim.sub',partner_b::text,true);
 perform set_config('request.jwt.claims','{"email":"reconcile-partner-a@example.invalid"}',true);
 if public.rallora_reconcile_my_player_account()<>0 then raise exception 'Unverified identity was linked'; end if;
 rejected:=false;
 begin perform public.rallora_claim_team_invite(invite_a); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Another account could claim the invitation'; end if;

 update auth.users set email_confirmed_at=now() where id=partner_b;
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name)
 values(c,season,division,team_a,partner_b,'Partner B');
 if public.rallora_reconcile_my_player_account()<>0 then raise exception 'Conflicting registration was ignored'; end if;
 update public.rallora_team_registration_requests set status='withdrawn'
 where team_id=team_a and player_user_id=partner_b and status='pending';
 if public.rallora_reconcile_my_player_account()<>1 or public.rallora_reconcile_my_player_account()<>0
 or public.rallora_claim_team_invite(invite_b)<>team_b then raise exception 'Verified sign-in did not link idempotently'; end if;
 if (select count(*) from public.rallora_team_registration_requests where player_user_id=partner_b and team_id=team_b and status='approved')<>1
 then raise exception 'Reconciliation duplicated the registration'; end if;
 rejected:=false;
 begin perform public.rallora_admin_reconcile_player_account(partner_a,season); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Player invoked the administrator repair tool'; end if;

 -- An account without a verified address stays accountless during a club move.
 perform set_config('request.jwt.claim.sub',organiser::text,true);
 insert into public.rallora_player_pools(club_id,season_id,user_id,pool_type,player_name,email,playtomic_rating,status)
 values(c,season,standby_user,'standby','Standby Player','reconcile-standby@example.invalid',3,'available') returning id into pool;
 select roster_version into version from public.teams where id=team_b;
 perform public.rallora_manage_players('add',team_b,2,version,p_pool_id=>pool);
 if exists(select 1 from public.rallora_team_roster_memberships where team_id=team_b and player_user_id in(partner_b,standby_user))
 then raise exception 'Standby move retained old access or granted unverified access'; end if;
 perform set_config('request.jwt.claim.sub',partner_b::text,true);
 rejected:=false;
 begin perform public.rallora_claim_team_invite(invite_b); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'A previous player reclaimed their old place'; end if;

 update auth.users set email_confirmed_at=now() where id=standby_user;
 perform set_config('request.jwt.claim.sub',organiser::text,true);
 linked:=public.rallora_admin_reconcile_player_account(standby_user,season);
 if linked<>1
 or not exists(select 1 from public.rallora_team_roster_memberships where team_id=team_b and player_user_id=standby_user and role='player')
 then raise exception 'Admin could not reconcile a verified standby player (linked %)',linked; end if;

 perform set_config('request.jwt.claim.sub',standby_user::text,true);
 if public.rallora_reconcile_my_player_account()<>0 then raise exception 'Standby reconciliation was not idempotent'; end if;

 insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,play_by,available_from,status)
 values(season,division,team_a,team_b,current_date+7,current_date,'open') returning id into fixture;
 update public.seasons set status='active',starts_on=current_date,ends_on=current_date+14 where id=season;
 perform set_config('request.jwt.claim.sub',partner_a::text,true);
 set local role authenticated;
 submission:=public.rallora_submit_captain_result(fixture,'6, 6','4, 3',team_a);
 perform set_config('request.jwt.claim.sub',standby_user::text,true);
 perform public.rallora_review_captain_result(submission,'confirm');
 reset role;
 if not exists(select 1 from public.results where fixture_id=fixture and status='confirmed')
 then raise exception 'Reconciled partners could not submit and confirm'; end if;

 perform set_config('request.jwt.claim.sub',organiser::text,true);
 select roster_version into version from public.teams where id=team_a;
 select roster_version into other_version from public.teams where id=team_b;
 perform public.rallora_manage_players('swap',team_a,2,version,team_b,2,other_version);
 if not exists(select 1 from public.rallora_team_roster_memberships where team_id=team_b and player_user_id=partner_a)
 or not exists(select 1 from public.rallora_team_roster_memberships where team_id=team_a and player_user_id=standby_user)
 or exists(select 1 from public.rallora_team_roster_memberships where
  (team_id=team_a and player_user_id=partner_a) or (team_id=team_b and player_user_id=standby_user))
 then raise exception 'Swapped players retained their previous access'; end if;
end $$;

rollback;
