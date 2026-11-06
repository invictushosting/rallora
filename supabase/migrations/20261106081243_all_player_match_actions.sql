begin;
-- Preserve captain roles. Authorisation uses current authenticated roster membership,
-- scoped to the fixture's club and season; never names, email or browser input.
create function rallora_private.is_fixture_player(p_fixture uuid,p_team uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.fixtures f join public.seasons s on s.id=f.season_id
  join public.rallora_team_roster_memberships r on r.club_id=s.club_id and r.season_id=s.id
   and r.team_id in(f.home_team_id,f.away_team_id) and r.player_user_id=auth.uid()
  where f.id=p_fixture and s.status<>'draft' and (p_team is null or r.team_id=p_team));
$$;
revoke all on function rallora_private.is_fixture_player(uuid,uuid) from public,anon;
grant execute on function rallora_private.is_fixture_player(uuid,uuid) to authenticated;

create policy fixture_players_read_submissions on public.result_submissions
 for select to authenticated using (rallora_private.is_fixture_player(fixture_id));
-- All score mutations go through validated RPCs, including existing captains.
-- Direct table writes must not bypass opposite-team review or spoof the actor.
revoke insert,update,delete on public.result_submissions from authenticated,anon;
alter table public.result_submissions add column reviewed_by_user_id uuid references auth.users(id),
 add column reviewed_at timestamptz;


create or replace function rallora_private.submit_player_result(
 p_fixture_id uuid,p_home_score text,p_away_score text,
 p_winner_team_id uuid default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare f public.fixtures%rowtype;s public.seasons%rowtype;submission_id uuid;p_team_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into f from public.fixtures where id=p_fixture_id;
 select * into s from public.seasons where id=f.season_id for share;
 perform id from public.teams where id in(f.home_team_id,f.away_team_id) order by id for share;
 select * into f from public.fixtures where id=p_fixture_id for update;
 if not found then raise exception 'Fixture not found'; end if;
 select r.team_id into p_team_id from public.rallora_team_roster_memberships r
 where r.player_user_id=auth.uid() and r.club_id=s.club_id and r.season_id=s.id
 and r.team_id in(f.home_team_id,f.away_team_id) order by r.team_id limit 1;
 if p_team_id is null then raise exception 'Not authorised for this fixture'; end if;
 select * into s from public.seasons where id=f.season_id for share;
 if s.status<>'active' or f.status<>'open' or exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'This fixture is locked'; end if;
 if nullif(trim(p_home_score),'') is null or nullif(trim(p_away_score),'') is null then raise exception 'Both scores are required'; end if;
 if length(trim(p_home_score))>100 or length(trim(p_away_score))>100 then raise exception 'Score is too long'; end if;
 if p_notes is not null and length(trim(p_notes))>1000 then raise exception 'Notes are too long'; end if;
 if p_winner_team_id is not null and p_winner_team_id not in(f.home_team_id,f.away_team_id) then raise exception 'Invalid winner'; end if;
 if exists(select 1 from public.results where fixture_id=f.id and status in('confirmed','admin_override')) then raise exception 'This fixture already has an official result'; end if;
 if exists(select 1 from public.result_submissions where fixture_id=f.id and status in('pending_opponent','confirmed_by_opponent','admin_approved','disputed')) then raise exception 'This fixture already has a result to review'; end if;
 insert into public.result_submissions(fixture_id,submitting_team_id,submitted_by_user_id,home_score,away_score,winner_team_id,notes,status,updated_at)
 values(f.id,p_team_id,auth.uid(),trim(p_home_score),trim(p_away_score),p_winner_team_id,nullif(trim(p_notes),''),'pending_opponent',now())
 on conflict(fixture_id,submitting_team_id) do update set submitted_by_user_id=auth.uid(),home_score=excluded.home_score,away_score=excluded.away_score,
 winner_team_id=excluded.winner_team_id,notes=excluded.notes,status='pending_opponent',dispute_note=null,opponent_confirmed_by_user_id=null,confirmed_at=null,reviewed_by_user_id=null,reviewed_at=null,updated_at=now()
 returning id into submission_id;
 update public.fixtures set status='submitted' where id=f.id;
 return submission_id;
end $$;

create or replace function public.rallora_submit_captain_result(p_fixture_id uuid,p_home_score text,p_away_score text,p_winner_team_id uuid default null,p_notes text default null)
returns uuid language sql security invoker set search_path='' as $$
 select rallora_private.submit_player_result(p_fixture_id,p_home_score,p_away_score,p_winner_team_id,p_notes);
$$;

create function rallora_private.review_player_result(p_submission_id uuid,p_decision text,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare sub public.result_submissions%rowtype; f public.fixtures%rowtype; s public.seasons%rowtype; opponent uuid; manager boolean;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_decision is null or p_decision not in('confirm','dispute') then raise exception 'Invalid decision'; end if;
 if p_decision='dispute' and (nullif(trim(p_note),'') is null or length(trim(p_note))>1000) then raise exception 'Explain the dispute in 1 to 1000 characters'; end if;
 select * into sub from public.result_submissions where id=p_submission_id;
 select * into f from public.fixtures where id=sub.fixture_id;
 select * into s from public.seasons where id=f.season_id for share;
 perform id from public.teams where id in(f.home_team_id,f.away_team_id) order by id for share;
 select * into f from public.fixtures where id=sub.fixture_id for update;
 select * into sub from public.result_submissions where id=p_submission_id for update;
 if not found or sub.status<>'pending_opponent' then raise exception 'Submission is not awaiting review'; end if;
 if s.status<>'active' or f.status<>'submitted' or exists(select 1 from public.seasons where previous_season_id=s.id)
  or exists(select 1 from public.results where fixture_id=f.id and status in('confirmed','admin_override')) then raise exception 'This fixture is locked'; end if;
 if sub.submitting_team_id not in(f.home_team_id,f.away_team_id) then raise exception 'Invalid submitting pairing'; end if;
 opponent:=case when sub.submitting_team_id=f.home_team_id then f.away_team_id else f.home_team_id end;
 manager:=public.rallora_can_manage_fixture(f.id);
 if not manager and (sub.submitted_by_user_id=auth.uid()
  or rallora_private.is_fixture_player(f.id,sub.submitting_team_id)
  or not rallora_private.is_fixture_player(f.id,opponent)) then raise exception 'Only an opposing fixture player or organiser can review'; end if;
 update public.result_submissions set status=case when p_decision='confirm' then 'confirmed_by_opponent' else 'disputed' end,
 opponent_confirmed_by_user_id=case when p_decision='confirm' then auth.uid() else null end,
 confirmed_at=case when p_decision='confirm' then now() else null end,
 dispute_note=case when p_decision='dispute' then trim(p_note) else null end,
 reviewed_by_user_id=auth.uid(),reviewed_at=now(),updated_at=now() where id=sub.id;
 update public.fixtures set status=case when p_decision='confirm' then 'confirmed' else 'disputed' end where id=f.id;
 if p_decision='confirm' then
  insert into public.results(fixture_id,home_score,away_score,winner_team_id,notes,status,confirmed_at)
  values(f.id,sub.home_score,sub.away_score,sub.winner_team_id,sub.notes,'confirmed',now())
  on conflict(fixture_id) do update set home_score=excluded.home_score,away_score=excluded.away_score,winner_team_id=excluded.winner_team_id,notes=excluded.notes,status='confirmed',confirmed_at=now();
  perform public.recalculate_standings_for_season(s.id);
 end if;
end $$;
create or replace function public.rallora_review_captain_result(p_submission_id uuid,p_decision text)
returns void language sql security invoker set search_path='' as $$
 select rallora_private.review_player_result(p_submission_id,p_decision);
$$;
create or replace function public.rallora_dispute_captain_result(p_submission_id uuid,p_note text)
returns void language sql security invoker set search_path='' as $$
 select rallora_private.review_player_result(p_submission_id,'dispute',p_note);
$$;
revoke all on function rallora_private.submit_player_result(uuid,text,text,uuid,text),rallora_private.review_player_result(uuid,text,text) from public,anon;
grant execute on function rallora_private.submit_player_result(uuid,text,text,uuid,text),rallora_private.review_player_result(uuid,text,text) to authenticated;


create or replace function rallora_private.save_arrangement(p_fixture_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_court text,p_clear boolean)
returns void language plpgsql security definer set search_path='' as $$
declare f public.fixtures%rowtype; s public.seasons%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into f from public.fixtures where id=p_fixture_id;
 select * into s from public.seasons where id=f.season_id for share;
 perform id from public.teams where id in(f.home_team_id,f.away_team_id) order by id for share;
 select * into f from public.fixtures where id=p_fixture_id for update;
 select * into s from public.seasons where id=f.season_id;
 if not found or not (public.rallora_can_manage_club(s.club_id) or rallora_private.is_fixture_player(f.id)) then raise exception 'Not authorised'; end if;
 if s.status<>'active' or f.status in ('confirmed','cancelled','forfeit','double_forfeit','submitted','disputed') or exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'This fixture is locked'; end if;
 if p_clear then
  delete from public.rallora_fixture_arrangements where fixture_id=f.id;
  update public.fixtures set arrangement_status='not_arranged',booking_starts_at=null,booking_ends_at=null,booking_court=null,booking_type=null,booking_matched_players=0 where id=f.id and booking_type='MANUAL';
  return;
 end if;
 if p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at) or p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '6 hours' or (p_ends_at at time zone 'Europe/London')::date>f.play_by or (p_starts_at at time zone 'Europe/London')::date<greatest(f.available_from,s.starts_on) then raise exception 'Choose a booking within the fixture window, lasting at most six hours'; end if;
 insert into public.rallora_fixture_arrangements values(f.id,s.club_id,p_starts_at,p_ends_at,left(trim(p_court),120),auth.uid(),now())
 on conflict(fixture_id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,court=excluded.court,updated_by=excluded.updated_by,updated_at=now();
 update public.fixtures set arrangement_status='arranged',booking_starts_at=p_starts_at,booking_ends_at=p_ends_at,booking_court=left(trim(p_court),120),booking_type='MANUAL',booking_matched_players=0 where id=f.id;
end $$;

create or replace function rallora_private.fixture_conversation(p_fixture uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not rallora_private.fixture_chat_access(p_fixture,auth.uid()) then raise exception 'Match conversation unavailable'; end if;
 select jsonb_build_object('id',f.id,'club_id',s.club_id,'slug',c.slug,'club',c.name,'league',s.name,'division',d.name,
 'home',coalesce(nullif(concat_ws(' / ',h.player_one_name,h.player_two_name),''),h.name),
 'away',coalesce(nullif(concat_ws(' / ',a.player_one_name,a.player_two_name),''),a.name),
 'home_team_id',f.home_team_id,'away_team_id',f.away_team_id,'home_roster_version',h.roster_version,'away_roster_version',a.roster_version,
 'play_by',f.play_by,'available_from',greatest(f.available_from,s.starts_on),'status',f.status,
 'timezone',coalesce(cs.timezone,'Europe/London'),'manager',public.rallora_can_manage_club(s.club_id),
 'viewer_team_id',(select team_id from public.rallora_team_roster_memberships where player_user_id=auth.uid() and club_id=s.club_id and season_id=s.id and team_id in(f.home_team_id,f.away_team_id) order by team_id limit 1),
 'can_record_booking',public.rallora_can_manage_club(s.club_id) or rallora_private.is_fixture_player(f.id),
 'writable',s.status='active' and f.status='open' and not exists(select 1 from public.seasons where previous_season_id=s.id),
 'help_requested',exists(select 1 from public.rallora_fixture_help where fixture_id=f.id and resolved_at is null),
 'alerts_enabled',coalesce(cs.enabled and (cs.rules->'messages'->>'enabled')::boolean,false),
 'email_enabled',coalesce(cs.enabled and (cs.rules->'messages'->>'enabled')::boolean and (cs.rules->'messages'->>'email')::boolean,false)) into result
 from public.fixtures f join public.seasons s on s.id=f.season_id join public.clubs c on c.id=s.club_id
 join public.divisions d on d.id=f.division_id join public.teams h on h.id=f.home_team_id join public.teams a on a.id=f.away_team_id
 left join public.rallora_communication_settings cs on cs.club_id=s.club_id where f.id=p_fixture;
 return result;
end $$;

create or replace function rallora_private.respond_fixture_proposal(p_id uuid,p_decision text)
returns void language plpgsql security definer set search_path='' as $$
declare m public.rallora_fixture_messages%rowtype; f public.fixtures%rowtype; s public.seasons%rowtype; actor uuid:=auth.uid(); team uuid; who text; event_id uuid:=gen_random_uuid(); zone text;
begin
 if actor is null then raise exception 'Sign in first'; end if;
 select * into m from public.rallora_fixture_messages where id=p_id;
 select * into f from public.fixtures where id=m.fixture_id;
 select * into s from public.seasons where id=f.season_id for share;
 perform id from public.teams where id in(f.home_team_id,f.away_team_id) order by id for share;
 select * into f from public.fixtures where id=m.fixture_id for update;
 if not found or not rallora_private.fixture_chat_access(f.id,actor) then raise exception 'Match conversation unavailable'; end if;
 select * into m from public.rallora_fixture_messages where id=p_id for update;
 select * into s from public.seasons where id=f.season_id;
 if s.status<>'active' or f.status<>'open' or exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'This match conversation is read-only'; end if;
 select r.team_id,req.player_name into team,who from public.rallora_team_roster_memberships r
  join public.rallora_team_registration_requests req on req.id=r.registration_request_id
  where r.player_user_id=actor and r.club_id=s.club_id and r.season_id=s.id
   and r.team_id in(f.home_team_id,f.away_team_id) and r.team_id<>m.sender_team_id order by r.team_id limit 1;
 if team is null or actor=m.sender_user_id then raise exception 'Only an opposing fixture player can respond'; end if;
 if p_decision not in('accepted','declined') or p_decision is null then raise exception 'Invalid response'; end if;
 if m.kind<>'proposal' or m.proposal_status<>'pending' then raise exception 'This proposal has already been answered or replaced'; end if;
 if m.home_roster_version<>(select roster_version from public.teams where id=f.home_team_id)
  or m.away_roster_version<>(select roster_version from public.teams where id=f.away_team_id)
  or not exists(select 1 from public.rallora_team_roster_memberships where team_id=m.sender_team_id and player_user_id=m.sender_user_id and club_id=s.club_id and season_id=s.id) then raise exception 'The pairing changed. Please propose a new time'; end if;
 select coalesce((select timezone from public.rallora_communication_settings where club_id=s.club_id),'Europe/London') into zone;
 if m.starts_at<=now() or (m.starts_at at time zone zone)::date<greatest(f.available_from,s.starts_on)
   or (m.ends_at at time zone zone)::date>f.play_by then raise exception 'This time is no longer available. Please propose a new time'; end if;
 if p_decision='accepted' then update public.rallora_fixture_messages set proposal_status='superseded' where fixture_id=f.id and proposal_status='accepted'; end if;
 update public.rallora_fixture_messages set proposal_status=p_decision where id=p_id;
 insert into public.rallora_fixture_messages(id,fixture_id,sender_user_id,sender_team_id,sender_name,kind,body)
 values(event_id,f.id,actor,team,coalesce(who,'Player'),p_decision,case when p_decision='accepted' then 'Time agreed. Either player can now book the court and record the booking.' else 'Proposed time declined. Please suggest another time.' end);
 perform rallora_private.alert_fixture_message(event_id);
end $$;

create or replace function public.rallora_notify_result_submission()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_slug text; v_opponent uuid; v_home uuid; v_away uuid;
begin
 select s.club_id,c.slug,f.home_team_id,f.away_team_id,case when f.home_team_id=new.submitting_team_id then f.away_team_id else f.home_team_id end
 into v_club,v_slug,v_home,v_away,v_opponent from public.fixtures f join public.seasons s on s.id=f.season_id join public.clubs c on c.id=s.club_id where f.id=new.fixture_id;
 if tg_op='INSERT' or new.status is distinct from old.status then
  if new.status='pending_opponent' then
   insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url,source_submission_id)
   select distinct r.player_user_id,v_club,'result_review','Result awaiting confirmation','The opposing team has submitted a result. Either player can review it in the Match centre.','/clubs/'||v_slug||'/captain',new.id
   from public.rallora_team_roster_memberships r where r.club_id=v_club and r.season_id=(select season_id from public.fixtures where id=new.fixture_id) and r.team_id=v_opponent and r.player_user_id is distinct from new.submitted_by_user_id;
  elsif new.status in ('confirmed_by_opponent','admin_approved','disputed') then
   insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url,source_submission_id)
   select distinct r.player_user_id,v_club,'result_'||new.status,case when new.status='disputed' then 'Result disputed' else 'Result confirmed' end,
    case when new.status='disputed' then 'This result has been disputed. Your organiser will review it.' else 'Your fixture has an official result. The league standings have been updated.' end,
    '/clubs/'||v_slug||'/captain',new.id
   from public.rallora_team_roster_memberships r where r.club_id=v_club and r.season_id=(select season_id from public.fixtures where id=new.fixture_id) and r.team_id in(v_home,v_away);
   if new.status='disputed' then
    insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url,source_submission_id)
    select distinct m.user_id,v_club,'result_disputed','A result needs your review','A player has disputed a result. Open fixture operations to review the score and dispute note.','/clubs/'||v_slug||'/admin',new.id
    from public.rallora_club_memberships m where m.club_id=v_club and m.status='active' and m.role in ('owner','admin','organiser');
   end if;
  end if;
 end if;
 return new;
end $$;

create or replace function rallora_private.fixture_reminder_relevant(p_fixture uuid,p_category text,p_user uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare x jsonb;
begin
 x:=rallora_private.fixture_context(p_fixture);
 if x is null or not (x->>'active')::boolean or (x->>'closed')::boolean then return false; end if;
 if not exists(select 1 from public.rallora_team_roster_memberships where player_user_id=p_user and club_id=(x->>'club_id')::uuid and season_id=(select season_id from public.fixtures where id=p_fixture) and team_id in((x->>'home_team_id')::uuid,(x->>'away_team_id')::uuid)) then return false; end if;
 return case p_category when 'booking' then x->>'starts_at' is null and x->>'submission_id' is null
 when 'upcoming' then (x->>'starts_at')::timestamptz>now() and x->>'submission_id' is null
 when 'missing_result' then (x->>'ends_at')::timestamptz<now() and x->>'submission_id' is null
 when 'confirmation' then x->>'submission_id' is not null and not exists(select 1 from public.rallora_team_roster_memberships where team_id=(x->>'submitting_team_id')::uuid and player_user_id=p_user)
 when 'overdue' then x->>'submission_id' is null and (x->>'play_by')::date<(now() at time zone 'Europe/London')::date else false end;
end $$;

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
   for r in select distinct player_user_id from public.rallora_team_roster_memberships where club_id=(x->>'club_id')::uuid and season_id=(select season_id from public.fixtures where id=f.id) and team_id in((x->>'home_team_id')::uuid,(x->>'away_team_id')::uuid) loop
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

create or replace function rallora_private.manual_fixture_reminder(p_fixture_id uuid,p_send boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare x jsonb; r record; kind text; people jsonb:='[]'; q uuid; count integer:=0;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform id from public.fixtures where id=p_fixture_id for update;
 x:=rallora_private.fixture_context(p_fixture_id);
 if x is null or not public.rallora_can_manage_club((x->>'club_id')::uuid) then raise exception 'Not authorised'; end if;
 kind:=case when x->>'submission_id' is not null then 'confirmation' when (x->>'ends_at')::timestamptz<now() then 'missing_result' when (x->>'starts_at')::timestamptz>now() then 'upcoming' when (x->>'play_by')::date<(now() at time zone 'Europe/London')::date then 'overdue' else 'booking' end;
 for r in select distinct rr.player_user_id,u.email from public.rallora_team_roster_memberships rr join auth.users u on u.id=rr.player_user_id where rr.club_id=(x->>'club_id')::uuid and rr.season_id=(select season_id from public.fixtures where id=p_fixture_id) and rr.team_id in((x->>'home_team_id')::uuid,(x->>'away_team_id')::uuid) loop
  if rallora_private.reminder_relevant(p_fixture_id,kind,r.player_user_id) then
   people:=people||jsonb_build_array(jsonb_build_object('email',r.email));
   if p_send then
    if exists(select 1 from public.rallora_delivery_queue where fixture_id=p_fixture_id and recipient_user_id=r.player_user_id and created_at>now()-interval '24 hours' and status in ('queued','sending','accepted')) then continue; end if;
    q:=rallora_private.enqueue_message((x->>'club_id')::uuid,r.player_user_id,null,kind,'manual:'||p_fixture_id||':'||r.player_user_id||':'||gen_random_uuid(),'Your club has sent a fixture reminder',(x->>'label')||' · Play by '||(x->>'play_by'),'/clubs/'||(x->>'slug')||'/captain',p_fixture_id);
    if q is not null then count:=count+1; end if;
   end if;
  end if;
 end loop;
 return jsonb_build_object('category',kind,'recipients',people,'queued',count,'enabled',coalesce((select enabled and (rules->kind->>'enabled')::boolean from public.rallora_communication_settings where club_id=(x->>'club_id')::uuid),false));
end $$;

create or replace function rallora_private.announce_live_fixture() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.seasons%rowtype; slug text; r record;
begin
 select * into s from public.seasons where id=new.season_id;
 if s.status<>'active' or new.status<>'open' then return new; end if;
 select c.slug into slug from public.clubs c where c.id=s.club_id;
 for r in select distinct player_user_id from public.rallora_team_roster_memberships where club_id=s.club_id and season_id=s.id and team_id in(new.home_team_id,new.away_team_id) loop
  perform rallora_private.enqueue_message(s.club_id,r.player_user_id,null,'fixtures','fixture:'||new.id||':'||r.player_user_id,
   'New fixture available',s.name||' · Play by '||new.play_by,'/clubs/'||slug||'/captain');
 end loop;
 return new;
end $$;

create or replace function rallora_private.announce_active_cycle() returns trigger language plpgsql security definer set search_path='' as $$
declare r record; slug text;
begin
 if new.status='active' and old.status is distinct from new.status then
  select c.slug into slug from public.clubs c where c.id=new.club_id;
  for r in select distinct player_user_id from public.rallora_team_roster_memberships where club_id=new.club_id and season_id=new.id loop
   perform rallora_private.enqueue_message(new.club_id,r.player_user_id,null,'fixtures','cycle:'||new.id||':'||r.player_user_id,
   'Your fixtures are ready',new.name||' is active. Open your Match centre to see your fixtures and arrange your matches.','/clubs/'||slug||'/captain');
  end loop;
 end if;
 return new;
end $$;

-- Append-only action history keeps attribution after bookings are removed or updated.
create table public.rallora_fixture_player_actions (
 id bigint generated always as identity primary key,
 fixture_id uuid not null references public.fixtures(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null,
 action text not null,
 created_at timestamptz not null default now()
);
create index fixture_player_actions_fixture_idx on public.rallora_fixture_player_actions(fixture_id,created_at);
create index fixture_player_actions_actor_idx on public.rallora_fixture_player_actions(actor_user_id);
alter table public.rallora_fixture_player_actions enable row level security;
revoke all on public.rallora_fixture_player_actions from public,anon,authenticated;
grant select on public.rallora_fixture_player_actions to authenticated;
create policy fixture_actions_read on public.rallora_fixture_player_actions for select to authenticated
 using (rallora_private.is_fixture_player(fixture_id) or public.rallora_can_manage_fixture(fixture_id));
create function rallora_private.audit_fixture_player_action() returns trigger
language plpgsql security definer set search_path='' as $$
declare fixture uuid; label text;
begin
 if tg_op='DELETE' then fixture:=old.fixture_id; else fixture:=new.fixture_id; end if;
 if tg_table_name='rallora_fixture_arrangements' then
  label:=case tg_op when 'DELETE' then 'booking_removed' when 'INSERT' then 'booking_recorded' else 'booking_updated' end;
 else
  label:='result_'||new.status;
 end if;
 if auth.uid() is not null and exists(select 1 from public.fixtures where id=fixture) then
  insert into public.rallora_fixture_player_actions(fixture_id,actor_user_id,action) values(fixture,auth.uid(),label);
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function rallora_private.audit_fixture_player_action() from public,anon,authenticated;
create trigger audit_fixture_booking_action after insert or update or delete on public.rallora_fixture_arrangements
 for each row execute function rallora_private.audit_fixture_player_action();
create trigger audit_fixture_result_action after insert or update on public.result_submissions
 for each row execute function rallora_private.audit_fixture_player_action();

commit;
