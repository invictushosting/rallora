begin;

-- The fixture is the conversation. No public directory or phone disclosure is needed.
create table public.rallora_fixture_messages (
 id uuid primary key default gen_random_uuid(),
 sequence bigint generated always as identity unique,
 fixture_id uuid not null references public.fixtures(id) on delete cascade,
 sender_user_id uuid not null references auth.users(id),
 sender_team_id uuid references public.teams(id),
 sender_name text not null,
 kind text not null check(kind in ('message','proposal','accepted','declined','help','resolved')),
 body text not null default '' check(char_length(body)<=2000),
 starts_at timestamptz, ends_at timestamptz, court text check(char_length(court)<=120),
 proposal_status text check(proposal_status in ('pending','accepted','declined','superseded')),
 home_roster_version integer, away_roster_version integer,
 created_at timestamptz not null default clock_timestamp(),
 check((kind='proposal' and starts_at is not null and ends_at>starts_at and proposal_status is not null)
   or (kind<>'proposal' and starts_at is null and ends_at is null and proposal_status is null))
);
create index fixture_messages_thread on public.rallora_fixture_messages(fixture_id,sequence desc);
create unique index fixture_messages_one_pending on public.rallora_fixture_messages(fixture_id) where proposal_status='pending';
create table public.rallora_fixture_message_reads (
 fixture_id uuid not null references public.fixtures(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_read_sequence bigint not null default 0 check(last_read_sequence>=0),
 primary key(fixture_id,user_id)
);
create index fixture_message_reads_user on public.rallora_fixture_message_reads(user_id,fixture_id);
create table public.rallora_fixture_help (
 fixture_id uuid primary key references public.fixtures(id) on delete cascade,
 requested_by uuid not null references auth.users(id),
 requested_at timestamptz not null default now(),
 resolved_at timestamptz
);

create function rallora_private.fixture_chat_access(p_fixture uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and p_user=auth.uid() and exists(
  select 1 from public.fixtures f join public.seasons s on s.id=f.season_id
  where f.id=p_fixture and (
   (p_user=auth.uid() and public.rallora_can_manage_club(s.club_id))
   or (s.status<>'draft' and exists(select 1 from public.rallora_team_roster_memberships r
    where r.player_user_id=p_user and r.role='captain' and r.club_id=s.club_id
    and r.season_id=s.id and r.team_id in(f.home_team_id,f.away_team_id)))
  )
 );
$$;
revoke all on function rallora_private.fixture_chat_access(uuid,uuid) from public,anon,authenticated;
grant execute on function rallora_private.fixture_chat_access(uuid,uuid) to authenticated;

alter table public.rallora_fixture_messages enable row level security;
alter table public.rallora_fixture_message_reads enable row level security;
alter table public.rallora_fixture_help enable row level security;
revoke all on public.rallora_fixture_messages,public.rallora_fixture_message_reads,public.rallora_fixture_help from public,anon,authenticated;
grant select on public.rallora_fixture_messages,public.rallora_fixture_message_reads,public.rallora_fixture_help to authenticated;
create policy fixture_messages_participant_read on public.rallora_fixture_messages for select to authenticated
 using(rallora_private.fixture_chat_access(fixture_id,(select auth.uid())));
create policy fixture_reads_self_read on public.rallora_fixture_message_reads for select to authenticated
 using(user_id=(select auth.uid()) and rallora_private.fixture_chat_access(fixture_id,(select auth.uid())));
create policy fixture_help_participant_read on public.rallora_fixture_help for select to authenticated
 using(rallora_private.fixture_chat_access(fixture_id,(select auth.uid())));

-- Add an independently configurable category. Preserve every existing club choice.
create or replace function rallora_private.validate_communication_settings() returns trigger language plpgsql set search_path='' as $$
declare k text; r jsonb; n text;
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Choose a valid time zone'; end if;
 if jsonb_typeof(new.rules)<>'object' then raise exception 'Invalid reminder settings'; end if;
 -- Older clients can still save the original eight categories without losing this one.
 new.rules:=jsonb_build_object('messages',coalesce(old.rules->'messages','{"enabled":true,"email":true,"in_app":true}'::jsonb))||new.rules;
 for k,r in select * from jsonb_each(new.rules) loop
  if k not in ('booking','upcoming','missing_result','confirmation','overdue','registration','fixtures','results','messages') or jsonb_typeof(r)<>'object' then raise exception 'Invalid reminder type'; end if;
  foreach n in array array['enabled','email','in_app'] loop
   if jsonb_typeof(r->n) is distinct from 'boolean' then raise exception 'Choose email and in-app settings for each reminder'; end if;
  end loop;
  if k in ('booking','upcoming','missing_result','confirmation','overdue') and (coalesce(r->>'hours','') !~ '^[0-9]+$' or (r->>'hours')::integer not between 1 and 720) then raise exception 'Timing must be between 1 and 720 hours'; end if;
  if k='overdue' and (coalesce(r->>'repeat_hours','') !~ '^[0-9]+$' or (r->>'repeat_hours')::integer not between 24 and 720) then raise exception 'Repeat timing must be between 24 and 720 hours'; end if;
 end loop;
 if (select count(*) from jsonb_object_keys(new.rules))<>9 then raise exception 'All reminder types are required'; end if;
 new.updated_at:=now(); return new;
end $$;
update public.rallora_communication_settings set rules=rules||'{"messages":{"enabled":true,"email":true,"in_app":true}}'::jsonb;
-- The trigger supplies this category for future inserts using the existing default.

-- Keep existing reminder logic intact, and re-check thread membership/read state
-- before an email leaves the queue. No message text is put in email notifications.
alter function rallora_private.reminder_relevant(uuid,text,uuid) rename to fixture_reminder_relevant;
create function rallora_private.reminder_relevant(p_fixture uuid,p_category text,p_user uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if p_category<>'messages' then return rallora_private.fixture_reminder_relevant(p_fixture,p_category,p_user); end if;
 return exists(select 1 from public.fixtures f join public.seasons s on s.id=f.season_id
  where f.id=p_fixture and s.status<>'draft' and f.status<>'cancelled'
  and (exists(select 1 from public.rallora_team_roster_memberships r where r.player_user_id=p_user and r.role='captain'
    and r.club_id=s.club_id and r.season_id=s.id and r.team_id in(f.home_team_id,f.away_team_id))
   or exists(select 1 from public.rallora_club_memberships cm where cm.club_id=s.club_id and cm.user_id=p_user
     and cm.status='active' and cm.role in('owner','admin','organiser')))
  and exists(select 1 from public.rallora_fixture_messages m where m.fixture_id=f.id and m.sender_user_id<>p_user
   and m.sequence>coalesce((select last_read_sequence from public.rallora_fixture_message_reads where fixture_id=f.id and user_id=p_user),0)));
end $$;
revoke all on function rallora_private.reminder_relevant(uuid,text,uuid) from public,anon,authenticated;

create function rallora_private.alert_fixture_message(p_message uuid) returns void
language plpgsql security definer set search_path='' as $$
declare m public.rallora_fixture_messages%rowtype; c public.clubs%rowtype; recipient uuid; cursor_value bigint; q uuid; n uuid;
begin
 select * into m from public.rallora_fixture_messages where id=p_message;
 select c1.* into c from public.clubs c1 join public.seasons s on s.club_id=c1.id join public.fixtures f on f.season_id=s.id where f.id=m.fixture_id;
 for recipient in
  select r.player_user_id from public.rallora_team_roster_memberships r join public.fixtures f on r.team_id in(f.home_team_id,f.away_team_id)
   where f.id=m.fixture_id and r.role='captain' and r.club_id=c.id and r.season_id=f.season_id and r.player_user_id<>m.sender_user_id
  union
  select cm.user_id from public.rallora_club_memberships cm where cm.club_id=c.id and cm.status='active'
   and cm.role in('owner','admin','organiser') and cm.user_id<>m.sender_user_id
   and (m.kind='help' or exists(select 1 from public.rallora_fixture_help h where h.fixture_id=m.fixture_id and h.resolved_at is null))
 loop
  select coalesce((select last_read_sequence from public.rallora_fixture_message_reads where fixture_id=m.fixture_id and user_id=recipient),0) into cursor_value;
  -- One alert per unread conversation; further messages remain visible in the thread.
  q:=rallora_private.enqueue_message(c.id,recipient,null,'messages','thread:'||m.fixture_id||':'||recipient||':'||cursor_value,
   'New activity in your match conversation','Open the match to read messages, review proposed times or get help from your organiser.',
   '/clubs/'||c.slug||'/matches/'||m.fixture_id,m.fixture_id);
  if q is not null and exists(select 1 from public.rallora_delivery_queue where id=q and in_app_enabled) then
   insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
   values(recipient,c.id,'fixture_message','New activity in your match conversation',
    'Open the match to read messages and review proposed times.','/clubs/'||c.slug||'/matches/'||m.fixture_id) returning id into n;
   update public.rallora_delivery_queue set notification_id=n,in_app_enabled=false where id=q;
  end if;
 end loop;
end $$;
revoke all on function rallora_private.alert_fixture_message(uuid) from public,anon,authenticated;

-- Mutations lock the fixture so retries, simultaneous proposals and replies are atomic.
create function rallora_private.post_fixture_message(p_fixture uuid,p_id uuid,p_kind text,p_body text,p_starts timestamptz,p_ends timestamptz,p_court text)
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
  where r.team_id in(f.home_team_id,f.away_team_id) and r.player_user_id=actor and r.role='captain' and r.club_id=s.club_id and r.season_id=s.id order by r.team_id limit 1;
 who:=coalesce(nullif(who,''),'Club organiser');
 if p_kind not in('message','proposal','help','resolved') or p_kind is null then raise exception 'Invalid message type'; end if;
 if char_length(coalesce(p_body,''))>2000 or char_length(coalesce(p_court,''))>120 then raise exception 'Message or court name is too long'; end if;
 if p_kind in('message','help') and nullif(trim(p_body),'') is null then raise exception 'Enter a message'; end if;
 if p_kind in('proposal','help') and team is null then raise exception 'Only a current captain can do this'; end if;
 if p_kind='resolved' and not manager then raise exception 'Only an organiser can resolve a help request'; end if;
 if (select count(*) from public.rallora_fixture_messages where fixture_id=p_fixture and sender_user_id=actor and created_at>clock_timestamp()-interval '1 minute')>=10 then raise exception 'Please wait a minute before sending more messages'; end if;
 if p_kind='proposal' then
  select coalesce((select timezone from public.rallora_communication_settings where club_id=s.club_id),'Europe/London') into zone;
  if p_starts is null or p_ends is null or not isfinite(p_starts) or not isfinite(p_ends)
   or p_starts<=now() or p_ends<=p_starts or p_ends>p_starts+interval '6 hours'
   or (p_starts at time zone zone)::date<coalesce(f.available_from,s.starts_on)
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
revoke all on function rallora_private.post_fixture_message(uuid,uuid,text,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function rallora_private.post_fixture_message(uuid,uuid,text,text,timestamptz,timestamptz,text) to authenticated;
create function public.rallora_post_fixture_message(p_fixture_id uuid,p_message_id uuid,p_kind text,p_body text default '',p_starts_at timestamptz default null,p_ends_at timestamptz default null,p_court text default null)
returns uuid language sql security invoker set search_path='' as $$
 select rallora_private.post_fixture_message(p_fixture_id,p_message_id,p_kind,p_body,p_starts_at,p_ends_at,p_court);
$$;
revoke all on function public.rallora_post_fixture_message(uuid,uuid,text,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.rallora_post_fixture_message(uuid,uuid,text,text,timestamptz,timestamptz,text) to authenticated;

create function rallora_private.respond_fixture_proposal(p_id uuid,p_decision text)
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
  where r.player_user_id=actor and r.role='captain' and r.club_id=s.club_id and r.season_id=s.id
   and r.team_id in(f.home_team_id,f.away_team_id) and r.team_id<>m.sender_team_id order by r.team_id limit 1;
 if team is null or actor=m.sender_user_id then raise exception 'Only the opposing captain can respond'; end if;
 if p_decision not in('accepted','declined') or p_decision is null then raise exception 'Invalid response'; end if;
 if m.kind<>'proposal' or m.proposal_status<>'pending' then raise exception 'This proposal has already been answered or replaced'; end if;
 if m.home_roster_version<>(select roster_version from public.teams where id=f.home_team_id)
  or m.away_roster_version<>(select roster_version from public.teams where id=f.away_team_id)
  or not exists(select 1 from public.rallora_team_roster_memberships where team_id=m.sender_team_id and player_user_id=m.sender_user_id and role='captain') then raise exception 'The pairing changed. Please propose a new time'; end if;
 select coalesce((select timezone from public.rallora_communication_settings where club_id=s.club_id),'Europe/London') into zone;
 if m.starts_at<=now() or (m.starts_at at time zone zone)::date<coalesce(f.available_from,s.starts_on)
   or (m.ends_at at time zone zone)::date>f.play_by then raise exception 'This time is no longer available. Please propose a new time'; end if;
 if p_decision='accepted' then update public.rallora_fixture_messages set proposal_status='superseded' where fixture_id=f.id and proposal_status='accepted'; end if;
 update public.rallora_fixture_messages set proposal_status=p_decision where id=p_id;
 insert into public.rallora_fixture_messages(id,fixture_id,sender_user_id,sender_team_id,sender_name,kind,body)
 values(event_id,f.id,actor,team,coalesce(who,'Captain'),p_decision,case when p_decision='accepted' then 'Time agreed. A captain still needs to book the court and record the booking.' else 'Proposed time declined. Please suggest another time.' end);
 perform rallora_private.alert_fixture_message(event_id);
end $$;
revoke all on function rallora_private.respond_fixture_proposal(uuid,text) from public,anon,authenticated;
grant execute on function rallora_private.respond_fixture_proposal(uuid,text) to authenticated;
create function public.rallora_respond_fixture_proposal(p_message_id uuid,p_decision text)
returns void language sql security invoker set search_path='' as $$ select rallora_private.respond_fixture_proposal(p_message_id,p_decision); $$;
revoke all on function public.rallora_respond_fixture_proposal(uuid,text) from public,anon,authenticated;
grant execute on function public.rallora_respond_fixture_proposal(uuid,text) to authenticated;

create function rallora_private.read_fixture_messages(p_fixture uuid,p_sequence bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not rallora_private.fixture_chat_access(p_fixture,auth.uid()) then raise exception 'Match conversation unavailable'; end if;
 if not exists(select 1 from public.rallora_fixture_messages where fixture_id=p_fixture and sequence=p_sequence) then raise exception 'Invalid read position'; end if;
 insert into public.rallora_fixture_message_reads(fixture_id,user_id,last_read_sequence) values(p_fixture,auth.uid(),p_sequence)
 on conflict(fixture_id,user_id) do update set last_read_sequence=greatest(rallora_fixture_message_reads.last_read_sequence,excluded.last_read_sequence);
 update public.rallora_notifications set read_at=coalesce(read_at,now()) where recipient_user_id=auth.uid()
  and notification_type='fixture_message' and action_url like '%/matches/'||p_fixture::text
  and created_at<=(select created_at from public.rallora_fixture_messages where fixture_id=p_fixture and sequence=p_sequence);
end $$;
revoke all on function rallora_private.read_fixture_messages(uuid,bigint) from public,anon,authenticated;
grant execute on function rallora_private.read_fixture_messages(uuid,bigint) to authenticated;
create function public.rallora_read_fixture_messages(p_fixture_id uuid,p_sequence bigint)
returns void language sql security invoker set search_path='' as $$ select rallora_private.read_fixture_messages(p_fixture_id,p_sequence); $$;
revoke all on function public.rallora_read_fixture_messages(uuid,bigint) from public,anon,authenticated;
grant execute on function public.rallora_read_fixture_messages(uuid,bigint) to authenticated;

-- Metadata is obtained only after fixture membership is checked; the supplied
-- club slug is verified by the page against this value before showing content.
create function rallora_private.fixture_conversation(p_fixture uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not rallora_private.fixture_chat_access(p_fixture,auth.uid()) then raise exception 'Match conversation unavailable'; end if;
 select jsonb_build_object('id',f.id,'club_id',s.club_id,'slug',c.slug,'club',c.name,'league',s.name,'division',d.name,
 'home',coalesce(nullif(concat_ws(' / ',h.player_one_name,h.player_two_name),''),h.name),
 'away',coalesce(nullif(concat_ws(' / ',a.player_one_name,a.player_two_name),''),a.name),
 'home_team_id',f.home_team_id,'away_team_id',f.away_team_id,'home_roster_version',h.roster_version,'away_roster_version',a.roster_version,
 'play_by',f.play_by,'available_from',coalesce(f.available_from,s.starts_on),'status',f.status,
 'timezone',coalesce(cs.timezone,'Europe/London'),'manager',public.rallora_can_manage_club(s.club_id),
 'viewer_team_id',(select team_id from public.rallora_team_roster_memberships where player_user_id=auth.uid() and role='captain' and team_id in(f.home_team_id,f.away_team_id) order by team_id limit 1),
 'writable',s.status='active' and f.status='open' and not exists(select 1 from public.seasons where previous_season_id=s.id),
 'help_requested',exists(select 1 from public.rallora_fixture_help where fixture_id=f.id and resolved_at is null),
 'alerts_enabled',coalesce(cs.enabled and (cs.rules->'messages'->>'enabled')::boolean,false),
 'email_enabled',coalesce(cs.enabled and (cs.rules->'messages'->>'enabled')::boolean and (cs.rules->'messages'->>'email')::boolean,false)) into result
 from public.fixtures f join public.seasons s on s.id=f.season_id join public.clubs c on c.id=s.club_id
 join public.divisions d on d.id=f.division_id join public.teams h on h.id=f.home_team_id join public.teams a on a.id=f.away_team_id
 left join public.rallora_communication_settings cs on cs.club_id=s.club_id where f.id=p_fixture;
 return result;
end $$;
revoke all on function rallora_private.fixture_conversation(uuid) from public,anon,authenticated;
grant execute on function rallora_private.fixture_conversation(uuid) to authenticated;
create function public.rallora_fixture_conversation(p_fixture_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select rallora_private.fixture_conversation(p_fixture_id); $$;
revoke all on function public.rallora_fixture_conversation(uuid) from public,anon,authenticated;
grant execute on function public.rallora_fixture_conversation(uuid) to authenticated;

create function public.rallora_fixture_conversation_summaries(p_club_id uuid)
returns table(fixture_id uuid,unread_count bigint,last_activity timestamptz)
language sql stable security invoker set search_path='' as $$
 select m.fixture_id,count(*) filter(where m.sender_user_id<>(select auth.uid()) and m.sequence>coalesce(r.last_read_sequence,0)),max(m.created_at)
 from public.rallora_fixture_messages m join public.fixtures f on f.id=m.fixture_id
 join public.seasons s on s.id=f.season_id
 left join public.rallora_fixture_message_reads r on r.fixture_id=f.id and r.user_id=(select auth.uid())
 where s.club_id=p_club_id group by m.fixture_id;
$$;
revoke all on function public.rallora_fixture_conversation_summaries(uuid) from public,anon,authenticated;
grant execute on function public.rallora_fixture_conversation_summaries(uuid) to authenticated;
create function public.rallora_club_conversations(p_club_id uuid)
returns table(fixture_id uuid,league text,division text,home text,away text,help_requested boolean,last_activity timestamptz)
language sql stable security invoker set search_path='' as $$
 select f.id,s.name,d.name,h.name,a.name,coalesce(bool_or(fh.resolved_at is null and fh.fixture_id is not null),false),max(m.created_at)
 from public.rallora_fixture_messages m join public.fixtures f on f.id=m.fixture_id
 join public.seasons s on s.id=f.season_id join public.divisions d on d.id=f.division_id
 join public.teams h on h.id=f.home_team_id join public.teams a on a.id=f.away_team_id
 left join public.rallora_fixture_help fh on fh.fixture_id=f.id
 where s.club_id=p_club_id and public.rallora_can_manage_club(p_club_id)
 group by f.id,s.name,d.name,h.name,a.name
 order by coalesce(bool_or(fh.resolved_at is null and fh.fixture_id is not null),false) desc,max(m.created_at) desc limit 100;
$$;
revoke all on function public.rallora_club_conversations(uuid) from public,anon,authenticated;
grant execute on function public.rallora_club_conversations(uuid) to authenticated;
commit;
