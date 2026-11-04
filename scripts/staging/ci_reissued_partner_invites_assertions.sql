-- Synthetic invitations only. No external email worker runs in this database.
begin;
do $$
declare
 c uuid := '00000000-0000-0000-0000-0000000000a1';
 s uuid := gen_random_uuid(); d uuid := gen_random_uuid(); u uuid := gen_random_uuid(); partner uuid := gen_random_uuid();
 application uuid; team uuid; original uuid; replacement uuid; denied boolean;
begin
 insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000a01','reissue-organiser@example.invalid') on conflict(id) do nothing;
 insert into auth.users(id,email) values(u,'reissue-captain@example.invalid'),(partner,'replacement-partner@example.invalid');
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a01',true);
 insert into public.seasons(id,club_id,name,status) values(s,c,'Reissue regression','draft');
 insert into public.divisions(id,season_id,name) values(d,s,'Reissue box');
 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email)
 values(c,s,u,'Captain / Original','Captain','Original','original-partner@example.invalid') returning id into application;
 team:=public.rallora_review_team_application(application,'approved',d);
 select partner_invite_id into original from public.rallora_team_applications where id=application;
 update public.rallora_team_member_invites set status='cancelled' where id=original;
 update public.teams set player_two_name='Replacement',player_two_email='replacement-partner@example.invalid' where id=team;
 update public.rallora_team_applications set partner_name='Replacement',partner_email='replacement-partner@example.invalid' where id=application;
 insert into public.rallora_team_member_invites(team_application_id,club_id,season_id,division_id,team_id,invited_name,invited_email)
 values(application,c,s,d,team,'Replacement','replacement-partner@example.invalid') returning id into replacement;
 update public.rallora_team_applications set partner_invite_id=replacement where id=application;
 if not exists(select 1 from public.rallora_team_member_invites where id=original and status='cancelled' and invited_email='original-partner@example.invalid') then raise exception 'Original invitation history was lost'; end if;
 denied:=false;
 begin
  insert into public.rallora_team_member_invites(team_application_id,club_id,season_id,division_id,team_id,invited_name,invited_email)
  values(application,c,s,d,team,'Duplicate','duplicate@example.invalid');
 exception when unique_violation then denied:=true; end;
 if not denied then raise exception 'Two active invitations allowed for one application'; end if;
 perform set_config('request.jwt.claim.sub',partner::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',partner,'email','replacement-partner@example.invalid')::text,true);
 set local role authenticated;
 denied:=false;
 begin perform public.rallora_claim_team_invite(original); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Cancelled invitation could be claimed'; end if;
 if public.rallora_claim_team_invite(replacement)<>team then raise exception 'Replacement claimed the wrong pairing'; end if;
 reset role;
 if not exists(select 1 from public.rallora_team_roster_memberships where team_id=team and player_user_id=partner and role='player') then raise exception 'Replacement account was not linked'; end if;
 denied:=false;
 begin
  insert into public.rallora_team_member_invites(team_application_id,club_id,season_id,division_id,team_id,invited_name,invited_email)
  values(application,c,s,d,team,'After claim','after-claim@example.invalid');
 exception when unique_violation then denied:=true; end;
 if not denied then raise exception 'Claimed invitation failed to retain current uniqueness'; end if;
end $$;
rollback;
