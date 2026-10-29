-- available_from publishes fixtures for planning. The season start also bounds actual play.
-- Preserve existing visibility, messages, proposals, bookings, permissions and results.
begin;

create or replace function rallora_private.post_fixture_message(p_fixture uuid,p_id uuid,p_kind text,p_body text,p_starts timestamptz,p_ends timestamptz,p_court text)
returns uuid language plpgsql security definer set search_path='' as $$
declare f public.fixtures%rowtype; s public.seasons%rowtype; actor uuid:=auth.uid(); team uuid; who text; manager boolean; hv integer; av integer; zone text;
begin
 if actor is null then raise exception 'Sign in first'; end if;
 select * into f from public.fixtures where id=p_fixture;
 select * into s from public.seasons where id=f.season_id for share;
 perform id from public.teams where id in(f.home_team_id,f.away_team_id) order by id for share;
 select * into f from public.fixtures where id=p_fixture for update;
 if not found or not rallora_private.fixture_chat_access(p_fixture,actor) then raise exception 'Match conversation unavailable'; end if;
 select * into s from public.seasons where id=f.season_id;
 if s.status<>'active' or f.status<>'open' or exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'This match conversation is read-only'; end if;
 if p_id is null then raise exception 'A message identifier is required'; end if;
 if exists(select 1 from public.rallora_fixture_messages where id=p_id and fixture_id=p_fixture and sender_user_id=actor) then return p_id; end if;
 manager:=public.rallora_can_manage_club(s.club_id);
 select r.team_id,req.player_name into team,who from public.rallora_team_roster_memberships r
  join public.rallora_team_registration_requests req on req.id=r.registration_request_id
  where r.team_id in(f.home_team_id,f.away_team_id) and r.player_user_id=actor and r.club_id=s.club_id and r.season_id=s.id order by r.team_id limit 1;
 who:=coalesce(nullif(who,''),case when team is not null then 'Player' else 'Club organiser' end);
 if p_kind not in('message','proposal','help','resolved') or p_kind is null then raise exception 'Invalid message type'; end if;
 if char_length(coalesce(p_body,''))>2000 or char_length(coalesce(p_court,''))>120 then raise exception 'Message or court name is too long'; end if;
 if p_kind in('message','help') and nullif(trim(p_body),'') is null then raise exception 'Enter a message'; end if;
 if p_kind in('proposal','help') and team is null then raise exception 'Only a current fixture player can do this'; end if;
 if p_kind='resolved' and not manager then raise exception 'Only an organiser can resolve a help request'; end if;
 if (select count(*) from public.rallora_fixture_messages where fixture_id=p_fixture and sender_user_id=actor and created_at>clock_timestamp()-interval '1 minute')>=10 then raise exception 'Please wait a minute before sending more messages'; end if;
 if p_kind='proposal' then
  select coalesce((select timezone from public.rallora_communication_settings where club_id=s.club_id),'Europe/London') into zone;
  if p_starts is null or p_ends is null or not isfinite(p_starts) or not isfinite(p_ends)
   or p_starts<=now() or p_ends<=p_starts or p_ends>p_starts+interval '6 hours'
   or (p_starts at time zone zone)::date<greatest(f.available_from,s.starts_on)
   or (p_ends at time zone zone)::date>f.play_by then raise exception 'Choose a future time within this fixture’s playing window, lasting at most six hours'; end if;
  select roster_version into hv from public.teams where id=f.home_team_id;
  select roster_version into av from public.teams where id=f.away_team_id;
  update public.rallora_fixture_messages set proposal_status='superseded' where fixture_id=p_fixture and proposal_status='pending';
 else
  if p_starts is not null or p_ends is not null then raise exception 'Only proposals can include a time'; end if;
 end if;
 if p_kind='help' then
  insert into public.rallora_fixture_help(fixture_id,requested_by) values(p_fixture,actor)
  on conflict(fixture_id) do update set requested_by=excluded.requested_by,requested_at=now(),resolved_at=null;
 elsif p_kind='resolved' then
  update public.rallora_fixture_help set resolved_at=now() where fixture_id=p_fixture and resolved_at is null;
  if not found then raise exception 'There is no open help request'; end if;
 end if;
 insert into public.rallora_fixture_messages(id,fixture_id,sender_user_id,sender_team_id,sender_name,kind,body,starts_at,ends_at,court,proposal_status,home_roster_version,away_roster_version)
 values(p_id,p_fixture,actor,team,who,p_kind,trim(coalesce(p_body,'')),p_starts,p_ends,nullif(trim(p_court),''),case when p_kind='proposal' then 'pending' end,hv,av);
 perform rallora_private.alert_fixture_message(p_id);
 return p_id;
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
 values(event_id,f.id,actor,team,coalesce(who,'Player'),p_decision,case when p_decision='accepted' then 'Time agreed. A captain still needs to book the court and record the booking.' else 'Proposed time declined. Please suggest another time.' end);
 perform rallora_private.alert_fixture_message(event_id);
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
 'can_record_booking',public.rallora_can_manage_club(s.club_id) or public.is_captain_for_team(f.home_team_id) or public.is_captain_for_team(f.away_team_id),
 'writable',s.status='active' and f.status='open' and not exists(select 1 from public.seasons where previous_season_id=s.id),
 'help_requested',exists(select 1 from public.rallora_fixture_help where fixture_id=f.id and resolved_at is null),
 'alerts_enabled',coalesce(cs.enabled and (cs.rules->'messages'->>'enabled')::boolean,false),
 'email_enabled',coalesce(cs.enabled and (cs.rules->'messages'->>'enabled')::boolean and (cs.rules->'messages'->>'email')::boolean,false)) into result
 from public.fixtures f join public.seasons s on s.id=f.season_id join public.clubs c on c.id=s.club_id
 join public.divisions d on d.id=f.division_id join public.teams h on h.id=f.home_team_id join public.teams a on a.id=f.away_team_id
 left join public.rallora_communication_settings cs on cs.club_id=s.club_id where f.id=p_fixture;
 return result;
end $$;

create or replace function rallora_private.save_arrangement(p_fixture_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_court text,p_clear boolean)
returns void language plpgsql security definer set search_path='' as $$
declare f public.fixtures%rowtype; s public.seasons%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into f from public.fixtures where id=p_fixture_id for update;
 select * into s from public.seasons where id=f.season_id;
 if not found or not (public.rallora_can_manage_club(s.club_id) or exists(select 1 from public.rallora_team_roster_memberships where team_id in(f.home_team_id,f.away_team_id) and player_user_id=auth.uid() and role='captain')) then raise exception 'Not authorised'; end if;
 if s.status<>'active' or f.status in ('confirmed','cancelled','forfeit','double_forfeit','submitted','disputed') or exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'This fixture is locked'; end if;
 if p_clear then
  delete from public.rallora_fixture_arrangements where fixture_id=f.id;
  update public.fixtures set arrangement_status='not_arranged',booking_starts_at=null,booking_ends_at=null,booking_court=null,booking_type=null,booking_matched_players=0 where id=f.id and booking_type='MANUAL';
  return;
 end if;
 if p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '6 hours' or (p_ends_at at time zone 'Europe/London')::date>f.play_by or (p_starts_at at time zone 'Europe/London')::date<greatest(f.available_from,s.starts_on) then raise exception 'Choose a booking within the fixture window, lasting at most six hours'; end if;
 insert into public.rallora_fixture_arrangements values(f.id,s.club_id,p_starts_at,p_ends_at,left(trim(p_court),120),auth.uid(),now())
 on conflict(fixture_id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,court=excluded.court,updated_by=excluded.updated_by,updated_at=now();
 update public.fixtures set arrangement_status='arranged',booking_starts_at=p_starts_at,booking_ends_at=p_ends_at,booking_court=left(trim(p_court),120),booking_type='MANUAL',booking_matched_players=0 where id=f.id;
end $$;

commit;
