-- Pilot notification coverage for captain assignment and newly published fixtures.
begin;
create or replace function public.rallora_notify_captain_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_slug text; v_team text;
begin
 if new.role='captain' and (tg_op='INSERT' or old.role is distinct from new.role) then
  select s.club_id,c.slug,t.name into v_club,v_slug,v_team
  from public.teams t join public.divisions d on d.id=t.division_id
  join public.seasons s on s.id=d.season_id join public.clubs c on c.id=s.club_id
  where t.id=new.team_id;
  insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
  values(new.player_user_id,v_club,'captain_assigned','You are now a team captain',
   'You have been assigned as captain of '||coalesce(v_team,'your team')||'.',
   '/clubs/'||v_slug||'/captain');
 end if;
 return new;
end;$$;
drop trigger if exists rallora_captain_assignment_notification on public.rallora_team_roster_memberships;
create trigger rallora_captain_assignment_notification after insert or update of role on public.rallora_team_roster_memberships
 for each row execute function public.rallora_notify_captain_assignment();

create or replace function public.rallora_notify_fixture_created()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_slug text; v_home text; v_away text;
begin
 if new.status='open' then
  select s.club_id,c.slug,h.name,a.name into v_club,v_slug,v_home,v_away
  from public.seasons s join public.clubs c on c.id=s.club_id
  join public.teams h on h.id=new.home_team_id join public.teams a on a.id=new.away_team_id
  where s.id=new.season_id;
  insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
  select distinct r.player_user_id,v_club,'fixture_created','New fixture available',
   coalesce(v_home,'Home')||' vs '||coalesce(v_away,'Away')||' · play by '||to_char(new.play_by,'DD Mon YYYY'),
   '/clubs/'||v_slug||'/captain'
  from public.rallora_team_roster_memberships r
  where r.team_id in(new.home_team_id,new.away_team_id) and r.role='captain';
 end if;
 return new;
end;$$;
drop trigger if exists rallora_fixture_created_notification on public.fixtures;
create trigger rallora_fixture_created_notification after insert on public.fixtures
 for each row execute function public.rallora_notify_fixture_created();

revoke all on function public.rallora_notify_captain_assignment(),public.rallora_notify_fixture_created() from public,anon,authenticated;
commit;