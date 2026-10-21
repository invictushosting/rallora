begin;
-- Use the end of the play-by date in club time, rather than rounding hour settings to whole days.
create or replace function rallora_private.generate_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare f record; cfg public.rallora_communication_settings%rowtype; x jsonb; r record; kind text; rule jsonb; due boolean; local_day date; bucket text; q uuid; count integer:=0; hours integer;
begin
 for f in select fx.id,s.club_id from public.fixtures fx join public.seasons s on s.id=fx.season_id join public.rallora_communication_settings cs on cs.club_id=s.club_id and cs.enabled where s.status='active' and fx.status not in ('confirmed','cancelled','forfeit','double_forfeit','disputed') loop
  select * into cfg from public.rallora_communication_settings where club_id=f.club_id;
  local_day:=(now() at time zone cfg.timezone)::date;
  if extract(hour from now() at time zone cfg.timezone)<cfg.send_hour or extract(hour from now() at time zone cfg.timezone)>=cfg.quiet_end_hour then continue; end if;
  x:=rallora_private.fixture_context(f.id);
  if (x->>'available_from')::date>local_day then continue; end if;
  foreach kind in array array['booking','upcoming','missing_result','confirmation','overdue'] loop
   rule:=cfg.rules->kind; hours:=(rule->>'hours')::integer;
   if not (rule->>'enabled')::boolean then continue; end if;
   due:=case kind
    when 'booking' then (((x->>'play_by')::date+1)::timestamp at time zone cfg.timezone)>now() and (((x->>'play_by')::date+1)::timestamp at time zone cfg.timezone)<=now()+make_interval(hours=>hours)
    when 'upcoming' then (x->>'starts_at')::timestamptz<=now()+make_interval(hours=>hours)
    when 'missing_result' then (x->>'ends_at')::timestamptz<=now()-make_interval(hours=>hours)
    when 'confirmation' then (x->>'submission_at')::timestamptz<=now()-make_interval(hours=>hours)
    when 'overdue' then ((x->>'play_by')::date+1)::timestamp at time zone cfg.timezone<=now()-make_interval(hours=>hours) end;
   if not coalesce(due,false) then continue; end if;
   bucket:=case kind when 'upcoming' then x->>'starts_at' when 'missing_result' then x->>'ends_at' when 'confirmation' then x->>'submission_id' when 'overdue' then floor(extract(epoch from (now()-(((x->>'play_by')::date+1)::timestamp at time zone cfg.timezone)-make_interval(hours=>hours)))/(3600*(rule->>'repeat_hours')::integer))::text else x->>'play_by' end;
   for r in select distinct player_user_id from public.rallora_team_roster_memberships where team_id in((x->>'home_team_id')::uuid,(x->>'away_team_id')::uuid) and role='captain' loop
    if rallora_private.reminder_relevant(f.id,kind,r.player_user_id) then
     q:=rallora_private.enqueue_message(f.club_id,r.player_user_id,null,kind,'reminder:'||f.id||':'||kind||':'||bucket||':'||r.player_user_id,
      case kind when 'booking' then 'Time to arrange your match' when 'upcoming' then 'Your match is coming up' when 'missing_result' then 'Please submit your match result' when 'confirmation' then 'Please review your opponent’s result' else 'Your fixture is overdue' end,
      (x->>'label')||' · Play by '||(x->>'play_by')||case when x->>'starts_at' is not null then ' · Booked for '||to_char((x->>'starts_at')::timestamptz at time zone cfg.timezone,'DD Mon YYYY HH24:MI')||' ('||cfg.timezone||')' else '' end,
      '/clubs/'||(x->>'slug')||'/captain',f.id);
     if q is not null then count:=count+1; end if;
    end if;
   end loop;
  end loop;
 end loop;
 return count;
end $$;

-- New fixture notices follow club channels and never announce private draft fixtures.
drop trigger if exists rallora_fixture_created_notification on public.fixtures;
create function rallora_private.announce_live_fixture() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.seasons%rowtype; slug text; r record;
begin
 select * into s from public.seasons where id=new.season_id;
 if s.status<>'active' or new.status<>'open' then return new; end if;
 select c.slug into slug from public.clubs c where c.id=s.club_id;
 for r in select distinct player_user_id from public.rallora_team_roster_memberships where team_id in(new.home_team_id,new.away_team_id) and role='captain' loop
  perform rallora_private.enqueue_message(s.club_id,r.player_user_id,null,'fixtures','fixture:'||new.id||':'||r.player_user_id,
   'New fixture available',s.name||' · Play by '||new.play_by,'/clubs/'||slug||'/captain');
 end loop;
 return new;
end $$;
revoke all on function rallora_private.announce_live_fixture() from public,anon,authenticated;
create trigger announce_live_fixture after insert on public.fixtures for each row execute function rallora_private.announce_live_fixture();
commit;
