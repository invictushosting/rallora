-- A real approval must preserve both saved ratings, not only later corrections.
begin;
do $$
declare
 c uuid := '00000000-0000-0000-0000-0000000000a1';
 s uuid := gen_random_uuid(); d uuid := gen_random_uuid(); u uuid := gen_random_uuid();
 application uuid; team uuid;
begin
 insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000a01','approval-organiser@example.invalid') on conflict(id) do nothing;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a01',true);
 insert into auth.users(id,email) values(u,'approval-rating@example.invalid');
 insert into public.seasons(id,club_id,name,status) values(s,c,'Approval rating regression','draft');
 insert into public.divisions(id,season_id,name) values(d,s,'Rating division');
 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email,captain_playtomic_rating,partner_playtomic_rating)
 values(c,s,u,'Rating Captain / Rating Partner','Rating Captain','Rating Partner','approval-partner@example.invalid',4.41,3.81)
 returning id into application;
 team := public.rallora_review_team_application(application,'approved',d);
 if not exists(select 1 from public.teams where id=team and player_one_rating=4.41 and player_two_rating=3.81)
 then raise exception 'Approval discarded the saved player ratings'; end if;
 if not exists(select 1 from public.rallora_team_member_invites where team_application_id=application and playtomic_rating=3.81)
 then raise exception 'Approval discarded the partner invitation rating'; end if;
end $$;
rollback;
