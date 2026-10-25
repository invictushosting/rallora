-- Synthetic regression: approval must work before publication/activation.
begin;
insert into public.seasons(id,club_id,name,status,registration_published)
values ('ca000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','Captain draft check','draft',false);
insert into public.divisions(id,season_id,name)
values ('ca000000-0000-0000-0000-000000000002','ca000000-0000-0000-0000-000000000001','Draft box');
insert into public.teams(id,division_id,name) values
('ca000000-0000-0000-0000-000000000003','ca000000-0000-0000-0000-000000000002','Own pairing'),
('ca000000-0000-0000-0000-000000000004','ca000000-0000-0000-0000-000000000002','Other pairing');
insert into public.rallora_team_registration_requests(id,club_id,season_id,division_id,team_id,player_user_id,player_name,status)
values ('ca000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000a1','ca000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000002','ca000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Draft captain','approved');
insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role)
values ('ca000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000a1','ca000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000002','ca000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','captain');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
do $$ begin
  if not exists (select 1 from public.rallora_team_roster_memberships m
    join public.teams t on t.id=m.team_id join public.seasons s on s.id=m.season_id
    where m.player_user_id=auth.uid() and m.role='captain' and t.id='ca000000-0000-0000-0000-000000000003')
  then raise exception 'Approved captain cannot load own draft pairing and season'; end if;
  if exists (select 1 from public.teams where id='ca000000-0000-0000-0000-000000000004')
  then raise exception 'Captain can see another draft pairing'; end if;
  update public.teams set name='Unauthorised edit' where id='ca000000-0000-0000-0000-000000000003';
  if found then raise exception 'Captain received team edit permission'; end if;
end $$;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
do $$ begin
  if exists (select 1 from public.teams where id='ca000000-0000-0000-0000-000000000003')
    or exists (select 1 from public.seasons where id='ca000000-0000-0000-0000-000000000001')
  then raise exception 'Unassigned user can read private draft'; end if;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if exists (select 1 from public.teams where id='ca000000-0000-0000-0000-000000000003')
    or exists (select 1 from public.seasons where id='ca000000-0000-0000-0000-000000000001')
  then raise exception 'Anonymous visitor can read private draft'; end if;
end $$;
rollback;
