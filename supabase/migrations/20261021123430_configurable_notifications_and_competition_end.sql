begin;
-- Club-controlled transactional communication. Nothing is sent until a club enables it.
create table public.rallora_communication_settings (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 enabled boolean not null default false,
 timezone text not null default 'Europe/London',
 send_hour integer not null default 9 check(send_hour between 0 and 22),
 quiet_end_hour integer not null default 20 check(quiet_end_hour between 1 and 23),
 daily_limit integer not null default 3 check(daily_limit between 1 and 10),
 rules jsonb not null default '{"booking":{"enabled":true,"email":true,"in_app":true,"hours":168},"upcoming":{"enabled":true,"email":true,"in_app":true,"hours":24},"missing_result":{"enabled":true,"email":true,"in_app":true,"hours":24},"confirmation":{"enabled":true,"email":true,"in_app":true,"hours":24},"overdue":{"enabled":true,"email":true,"in_app":true,"hours":24,"repeat_hours":72},"registration":{"enabled":true,"email":true,"in_app":true},"fixtures":{"enabled":true,"email":true,"in_app":true},"results":{"enabled":true,"email":true,"in_app":true}}'::jsonb,
 updated_at timestamptz not null default now(),
 check(send_hour<quiet_end_hour)
);
alter table public.rallora_communication_settings enable row level security;
revoke all on public.rallora_communication_settings from public,anon,authenticated;
grant select,insert,update on public.rallora_communication_settings to authenticated;
create policy communication_manage on public.rallora_communication_settings for all to authenticated
 using(public.rallora_can_manage_club(club_id)) with check(public.rallora_can_manage_club(club_id));

create function rallora_private.validate_communication_settings() returns trigger language plpgsql set search_path='' as $$
declare k text; r jsonb; n text;
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Choose a valid time zone'; end if;
 if jsonb_typeof(new.rules)<>'object' then raise exception 'Invalid reminder settings'; end if;
 for k,r in select * from jsonb_each(new.rules) loop
  if k not in ('booking','upcoming','missing_result','confirmation','overdue','registration','fixtures','results') or jsonb_typeof(r)<>'object' then raise exception 'Invalid reminder type'; end if;
  foreach n in array array['enabled','email','in_app'] loop
   if jsonb_typeof(r->n) is distinct from 'boolean' then raise exception 'Choose email and in-app settings for each reminder'; end if;
  end loop;
  if k in ('booking','upcoming','missing_result','confirmation','overdue') and (coalesce(r->>'hours','') !~ '^[0-9]+$' or (r->>'hours')::integer not between 1 and 720) then raise exception 'Timing must be between 1 and 720 hours'; end if;
  if k='overdue' and (coalesce(r->>'repeat_hours','') !~ '^[0-9]+$' or (r->>'repeat_hours')::integer not between 24 and 720) then raise exception 'Repeat timing must be between 24 and 720 hours'; end if;
 end loop;
 if (select count(*) from jsonb_object_keys(new.rules))<>8 then raise exception 'All reminder types are required'; end if;
 new.updated_at:=now(); return new;
end $$;
revoke all on function rallora_private.validate_communication_settings() from public,anon,authenticated;
create trigger validate_communication_settings before insert or update on public.rallora_communication_settings for each row execute function rallora_private.validate_communication_settings();

create table public.rallora_delivery_queue (
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id) on delete cascade,
 recipient_user_id uuid references auth.users(id) on delete cascade, recipient_email text not null,
 category text not null, event_key text not null unique, fixture_id uuid references public.fixtures(id) on delete cascade,
 invite_id uuid references public.rallora_team_member_invites(id) on delete cascade,
 title text not null,body text not null,action_url text not null,
 source_submission_id uuid references public.result_submissions(id) on delete cascade, expected_submission_status text,
 email_enabled boolean not null, in_app_enabled boolean not null, notification_id uuid,
 payload jsonb not null, status text not null default 'queued' check(status in ('queued','sending','accepted','failed','cancelled')),
 attempts integer not null default 0, available_at timestamptz not null default now(),locked_until timestamptz,
 provider_id text,last_error text,created_at timestamptz not null default now(),accepted_at timestamptz
);
create index rallora_delivery_due on public.rallora_delivery_queue(available_at) where status in ('queued','sending');
create index rallora_delivery_club on public.rallora_delivery_queue(club_id,created_at desc);
alter table public.rallora_delivery_queue enable row level security;
revoke all on public.rallora_delivery_queue from public,anon,authenticated;
grant select on public.rallora_delivery_queue to authenticated;
create policy delivery_manager_read on public.rallora_delivery_queue for select to authenticated using(public.rallora_can_manage_club(club_id));

create function rallora_private.enqueue_message(p_club uuid,p_user uuid,p_email text,p_category text,p_key text,p_title text,p_body text,p_url text,p_fixture uuid default null,p_invite uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare cfg public.rallora_communication_settings%rowtype; c public.clubs%rowtype; r jsonb; address text; q uuid;
begin
 select * into cfg from public.rallora_communication_settings where club_id=p_club and enabled;
 if not found then return null; end if;
 r:=cfg.rules->p_category;
 if not coalesce((r->>'enabled')::boolean,false) or not (coalesce((r->>'email')::boolean,false) or coalesce((r->>'in_app')::boolean,false)) then return null; end if;
 address:=lower(trim(p_email));
 if address is null and p_user is not null then select lower(email) into address from auth.users where id=p_user; end if;
 if address is null or address !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then return null; end if;
 select * into c from public.clubs where id=p_club;
 if not found or p_url not like '/clubs/'||c.slug||'/%' then return null; end if;
 insert into public.rallora_delivery_queue(club_id,recipient_user_id,recipient_email,category,event_key,fixture_id,invite_id,title,body,action_url,email_enabled,in_app_enabled,payload)
 values(p_club,p_user,address,p_category,p_key,p_fixture,p_invite,p_title,p_body,p_url,(r->>'email')::boolean,(r->>'in_app')::boolean,
 jsonb_build_object('name',c.name,'sender',coalesce(nullif(to_jsonb(c)->>'email_sender_name',''),c.name),'logoUrl',to_jsonb(c)->>'logo_url','primaryColour',to_jsonb(c)->>'primary_color','replyTo',coalesce(nullif(to_jsonb(c)->>'contact_email',''),'support@rallora.app')))
 on conflict(event_key) do nothing returning id into q;
 return q;
end $$;
revoke all on function rallora_private.enqueue_message(uuid,uuid,text,text,text,text,text,text,uuid,uuid) from public,anon,authenticated;

-- Existing in-app event triggers remain the source of truth. This adds future email delivery, not a historical backfill.
create function rallora_private.queue_notification_email() returns trigger language plpgsql security definer set search_path='' as $$
declare category text; q uuid; cfg public.rallora_communication_settings%rowtype; expected text;
begin
 category:=case when new.notification_type like '%approved%' or new.notification_type like '%declined%' then 'registration'
 when new.notification_type like 'result_%' then 'results' end;
 if category is not null and new.club_id is not null then
  q:=rallora_private.enqueue_message(new.club_id,new.recipient_user_id,null,category,'notification:'||new.id,new.title,new.body,coalesce(new.action_url,''));
  if new.source_submission_id is not null then select status into expected from public.result_submissions where id=new.source_submission_id; end if;
  update public.rallora_delivery_queue set notification_id=new.id,in_app_enabled=false,source_submission_id=new.source_submission_id,expected_submission_status=expected where id=q;
  select * into cfg from public.rallora_communication_settings where club_id=new.club_id;
  if cfg.enabled and (not coalesce((cfg.rules->category->>'enabled')::boolean,false) or not coalesce((cfg.rules->category->>'in_app')::boolean,false)) then return null; end if;
 end if;
 return new;
end $$;
revoke all on function rallora_private.queue_notification_email() from public,anon,authenticated;
alter table public.rallora_notifications add column source_submission_id uuid references public.result_submissions(id) on delete cascade;
create trigger queue_notification_email before insert on public.rallora_notifications for each row execute function rallora_private.queue_notification_email();

create function rallora_private.queue_registration_email() returns trigger language plpgsql security definer set search_path='' as $$
declare slug text; q uuid;
begin
 select c.slug into slug from public.clubs c where c.id=new.club_id;
 if tg_op='INSERT' and new.status='pending' then
  q:=rallora_private.enqueue_message(new.club_id,new.requested_by,null,'registration','application:'||new.id,'Registration received','Your entry has been received. Your club will review it and confirm your place.','/clubs/'||slug||'/captain');
 elsif new.status='declined' and old.status is distinct from new.status then
  q:=rallora_private.enqueue_message(new.club_id,new.requested_by,null,'registration','declined:'||new.id,'Registration update','Your club has declined this entry. Contact the organiser if you need more information.','/clubs/'||slug||'/captain');
 end if;
 return new;
end $$;
revoke all on function rallora_private.queue_registration_email() from public,anon,authenticated;
create trigger queue_registration_email after insert or update of status on public.rallora_team_applications for each row execute function rallora_private.queue_registration_email();

create function rallora_private.queue_partner_email() returns trigger language plpgsql security definer set search_path='' as $$
declare slug text;
begin
 select c.slug into slug from public.clubs c where c.id=new.club_id;
 -- Next-cycle copies of unclaimed invitations do not send repeat invitations.
 if new.status='pending' and not exists(select 1 from public.seasons where id=new.season_id and previous_season_id is not null) then
  perform rallora_private.enqueue_message(new.club_id,null,new.invited_email,'registration','invite:'||new.id,'Your pairing is ready to join',
  'Your pairing has been approved. Sign in or create your account using this email address to claim your place.', '/clubs/'||slug||'/join-team?invite='||new.id,null,new.id);
 end if;
 return new;
end $$;
revoke all on function rallora_private.queue_partner_email() from public,anon,authenticated;
create trigger queue_partner_email after insert on public.rallora_team_member_invites for each row execute function rallora_private.queue_partner_email();

-- Fixtures are announced when the competition becomes active, never while boxes are being prepared.
create function rallora_private.announce_active_cycle() returns trigger language plpgsql security definer set search_path='' as $$
declare r record; slug text;
begin
 if new.status='active' and old.status is distinct from new.status then
  select c.slug into slug from public.clubs c where c.id=new.club_id;
  for r in select distinct player_user_id from public.rallora_team_roster_memberships where season_id=new.id and role='captain' loop
   perform rallora_private.enqueue_message(new.club_id,r.player_user_id,null,'fixtures','cycle:'||new.id||':'||r.player_user_id,
   'Your fixtures are ready',new.name||' is active. Open your captain centre to see your fixtures and arrange your matches.','/clubs/'||slug||'/captain');
  end loop;
 end if;
 return new;
end $$;
revoke all on function rallora_private.announce_active_cycle() from public,anon,authenticated;
create trigger announce_active_cycle after update of status on public.seasons for each row execute function rallora_private.announce_active_cycle();

-- A captain can record an agreed booking without an API integration. This does not book a court.
create table public.rallora_fixture_arrangements (
 fixture_id uuid primary key references public.fixtures(id) on delete cascade,
 club_id uuid not null references public.clubs(id) on delete cascade,
 starts_at timestamptz not null,ends_at timestamptz not null,court text,
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),check(ends_at>starts_at)
);
alter table public.rallora_fixture_arrangements enable row level security;
revoke all on public.rallora_fixture_arrangements from public,anon,authenticated;
grant select on public.rallora_fixture_arrangements to authenticated;
create policy arrangement_participant_read on public.rallora_fixture_arrangements for select to authenticated using(
 public.rallora_can_manage_club(club_id) or exists(select 1 from public.fixtures f join public.rallora_team_roster_memberships r on r.team_id in(f.home_team_id,f.away_team_id) where f.id=fixture_id and r.player_user_id=auth.uid()));
create function rallora_private.save_arrangement(p_fixture_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_court text,p_clear boolean)
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
 if p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '6 hours' or (p_starts_at at time zone 'Europe/London')::date>f.play_by or (p_starts_at at time zone 'Europe/London')::date<coalesce(f.available_from,s.starts_on) then raise exception 'Choose a booking within the fixture window, lasting at most six hours'; end if;
 insert into public.rallora_fixture_arrangements values(f.id,s.club_id,p_starts_at,p_ends_at,left(trim(p_court),120),auth.uid(),now())
 on conflict(fixture_id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,court=excluded.court,updated_by=excluded.updated_by,updated_at=now();
 update public.fixtures set arrangement_status='arranged',booking_starts_at=p_starts_at,booking_ends_at=p_ends_at,booking_court=left(trim(p_court),120),booking_type='MANUAL',booking_matched_players=0 where id=f.id;
end $$;
revoke all on function rallora_private.save_arrangement(uuid,timestamptz,timestamptz,text,boolean) from public,anon;
grant execute on function rallora_private.save_arrangement(uuid,timestamptz,timestamptz,text,boolean) to authenticated;
create function public.rallora_save_fixture_arrangement(p_fixture_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_court text default '',p_clear boolean default false)
returns void language sql security invoker set search_path='' as $$ select rallora_private.save_arrangement(p_fixture_id,p_starts_at,p_ends_at,p_court,p_clear) $$;
revoke all on function public.rallora_save_fixture_arrangement(uuid,timestamptz,timestamptz,text,boolean) from public,anon;
grant execute on function public.rallora_save_fixture_arrangement(uuid,timestamptz,timestamptz,text,boolean) to authenticated;

-- One place decides whether a reminder is still relevant, including at delivery time.
create function rallora_private.fixture_context(p_fixture uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('club_id',s.club_id,'slug',c.slug,'active',s.status='active' and not exists(select 1 from public.seasons n where n.previous_season_id=s.id),
 'closed',f.status in ('confirmed','cancelled','forfeit','double_forfeit','disputed') or exists(select 1 from public.results rs where rs.fixture_id=f.id and rs.status in ('confirmed','approved','admin_override','admin_approved')),
 'play_by',f.play_by,'available_from',f.available_from,
 'starts_at',coalesce(a.starts_at,b.starts_at),'ends_at',coalesce(a.ends_at,b.ends_at),
 'submission_id',rs.id,'submission_at',rs.updated_at,'submitting_team_id',rs.submitting_team_id,'home_team_id',f.home_team_id,'away_team_id',f.away_team_id,
 'label',concat_ws(' / ',nullif(h.player_one_name,''),nullif(h.player_two_name,''))||' vs '||concat_ws(' / ',nullif(w.player_one_name,''),nullif(w.player_two_name,'')))
 from public.fixtures f join public.seasons s on s.id=f.season_id join public.clubs c on c.id=s.club_id
 join public.teams h on h.id=f.home_team_id join public.teams w on w.id=f.away_team_id
 left join public.rallora_fixture_arrangements a on a.fixture_id=f.id
 left join lateral(select starts_at,ends_at from public.rallora_playtomic_bookings where matched_fixture_id=f.id and match_state='confirmed' and matched_player_count=4 and booking_status not in ('CANCELED','CANCELLED') order by last_synced_at desc limit 1)b on true
 left join lateral(select id,updated_at,submitting_team_id from public.result_submissions where fixture_id=f.id and status='pending_opponent' order by updated_at desc limit 1)rs on true
 where f.id=p_fixture;
$$;
revoke all on function rallora_private.fixture_context(uuid) from public,anon,authenticated;
create function rallora_private.reminder_relevant(p_fixture uuid,p_category text,p_user uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare x jsonb;
begin
 x:=rallora_private.fixture_context(p_fixture);
 if x is null or not (x->>'active')::boolean or (x->>'closed')::boolean then return false; end if;
 if not exists(select 1 from public.rallora_team_roster_memberships where player_user_id=p_user and role='captain' and team_id in((x->>'home_team_id')::uuid,(x->>'away_team_id')::uuid)) then return false; end if;
 return case p_category when 'booking' then x->>'starts_at' is null and x->>'submission_id' is null
 when 'upcoming' then (x->>'starts_at')::timestamptz>now() and x->>'submission_id' is null
 when 'missing_result' then (x->>'ends_at')::timestamptz<now() and x->>'submission_id' is null
 when 'confirmation' then x->>'submission_id' is not null and not exists(select 1 from public.rallora_team_roster_memberships where team_id=(x->>'submitting_team_id')::uuid and player_user_id=p_user)
 when 'overdue' then x->>'submission_id' is null and (x->>'play_by')::date<(now() at time zone 'Europe/London')::date else false end;
end $$;
revoke all on function rallora_private.reminder_relevant(uuid,text,uuid) from public,anon,authenticated;

create function rallora_private.generate_reminders() returns integer language plpgsql security definer set search_path='' as $$
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
    when 'booking' then (x->>'play_by')::date>=local_day and (x->>'play_by')::date<=local_day+ceil(hours/24.0)::int
    when 'upcoming' then (x->>'starts_at')::timestamptz<=now()+make_interval(hours=>hours)
    when 'missing_result' then (x->>'ends_at')::timestamptz<=now()-make_interval(hours=>hours)
    when 'confirmation' then (x->>'submission_at')::timestamptz<=now()-make_interval(hours=>hours)
    when 'overdue' then (x->>'play_by')::timestamp at time zone cfg.timezone<=now()-make_interval(hours=>hours) end;
   if not coalesce(due,false) then continue; end if;
   bucket:=case kind when 'upcoming' then x->>'starts_at' when 'missing_result' then x->>'ends_at' when 'confirmation' then x->>'submission_id' when 'overdue' then floor(extract(epoch from (now()-((x->>'play_by')::timestamp at time zone cfg.timezone)))/(3600*(rule->>'repeat_hours')::integer))::text else x->>'play_by' end;
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
revoke all on function rallora_private.generate_reminders() from public,anon,authenticated;
-- Retire the fixed legacy generator so old cron calls cannot bypass club preferences.
create or replace function public.rallora_generate_fixture_reminders() returns integer language sql security invoker set search_path='' as $$ select rallora_private.generate_reminders() $$;
revoke all on function public.rallora_generate_fixture_reminders() from public,anon,authenticated;

create function rallora_private.manual_fixture_reminder(p_fixture_id uuid,p_send boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare x jsonb; r record; kind text; people jsonb:='[]'; q uuid; count integer:=0;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform id from public.fixtures where id=p_fixture_id for update;
 x:=rallora_private.fixture_context(p_fixture_id);
 if x is null or not public.rallora_can_manage_club((x->>'club_id')::uuid) then raise exception 'Not authorised'; end if;
 kind:=case when x->>'submission_id' is not null then 'confirmation' when (x->>'ends_at')::timestamptz<now() then 'missing_result' when (x->>'starts_at')::timestamptz>now() then 'upcoming' when (x->>'play_by')::date<(now() at time zone 'Europe/London')::date then 'overdue' else 'booking' end;
 for r in select distinct rr.player_user_id,u.email from public.rallora_team_roster_memberships rr join auth.users u on u.id=rr.player_user_id where rr.team_id in((x->>'home_team_id')::uuid,(x->>'away_team_id')::uuid) and rr.role='captain' loop
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
revoke all on function rallora_private.manual_fixture_reminder(uuid,boolean) from public,anon;
grant execute on function rallora_private.manual_fixture_reminder(uuid,boolean) to authenticated;
create function public.rallora_fixture_reminder(p_fixture_id uuid,p_send boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select rallora_private.manual_fixture_reminder(p_fixture_id,p_send) $$;
revoke all on function public.rallora_fixture_reminder(uuid,boolean) from public,anon;
grant execute on function public.rallora_fixture_reminder(uuid,boolean) to authenticated;

-- A narrow worker capability: random token never leaves the database except in the scheduler's HTTPS header.
create table rallora_private.delivery_worker_config(singleton boolean primary key default true check(singleton),token text not null);
alter table rallora_private.delivery_worker_config enable row level security;
revoke all on rallora_private.delivery_worker_config from public,anon,authenticated;
insert into rallora_private.delivery_worker_config values(true,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
create function rallora_private.claim_deliveries(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.rallora_delivery_queue%rowtype; cfg public.rallora_communication_settings%rowtype; batch jsonb:='[]'; notification uuid; rule jsonb; day date;
begin
 if not exists(select 1 from rallora_private.delivery_worker_config where token=p_token and length(p_token)=64) then raise exception 'Not authorised'; end if;
 perform pg_advisory_xact_lock(734821);
 for q in select j.* from public.rallora_delivery_queue j join public.rallora_communication_settings cs on cs.club_id=j.club_id
 where ((j.status='queued' and j.available_at<=now()) or (j.status='sending' and j.locked_until<now()))
 and (not cs.enabled or (extract(hour from now() at time zone cs.timezone)>=cs.send_hour and extract(hour from now() at time zone cs.timezone)<cs.quiet_end_hour))
 order by j.created_at limit 100 for update of j skip locked loop
  if jsonb_array_length(batch)>=5 then exit; end if;
  select * into cfg from public.rallora_communication_settings where club_id=q.club_id;
  rule:=cfg.rules->q.category;
  if not coalesce(cfg.enabled,false) or not coalesce((rule->>'enabled')::boolean,false)
    or (q.fixture_id is not null and not rallora_private.reminder_relevant(q.fixture_id,q.category,q.recipient_user_id))
    or (q.source_submission_id is not null and not exists(select 1 from public.result_submissions rs where rs.id=q.source_submission_id and rs.status=q.expected_submission_status))
    or (q.invite_id is not null and not exists(select 1 from public.rallora_team_member_invites i join public.rallora_team_applications a on a.id=i.team_application_id where i.id=q.invite_id and i.status='pending' and a.status='approved')) then
   update public.rallora_delivery_queue set status='cancelled',last_error='No longer applicable or disabled by club' where id=q.id; continue;
  end if;
  if q.attempts>=6 or (q.attempts>0 and q.created_at<now()-interval '20 hours') then update public.rallora_delivery_queue set status='failed',last_error='Retry limit reached; organiser review required' where id=q.id; continue; end if;
  if extract(hour from now() at time zone cfg.timezone)<cfg.send_hour or extract(hour from now() at time zone cfg.timezone)>=cfg.quiet_end_hour then continue; end if;
  day:=(now() at time zone cfg.timezone)::date;
  if q.category in ('booking','upcoming','missing_result','confirmation','overdue') and (select count(*) from public.rallora_delivery_queue j where j.club_id=q.club_id and j.recipient_email=q.recipient_email and j.category in ('booking','upcoming','missing_result','confirmation','overdue') and j.id<>q.id and j.status in ('accepted','sending') and (coalesce(j.accepted_at,j.locked_until) at time zone cfg.timezone)::date=day)>=cfg.daily_limit then
   update public.rallora_delivery_queue set available_at=((day+1)::timestamp+make_interval(hours=>cfg.send_hour)) at time zone cfg.timezone where id=q.id; continue;
  end if;
  if q.in_app_enabled and coalesce((rule->>'in_app')::boolean,false) and q.recipient_user_id is not null and q.notification_id is null then
   insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url) values(q.recipient_user_id,q.club_id,'reminder_'||q.category,q.title,q.body,q.action_url) returning id into notification;
   update public.rallora_delivery_queue set notification_id=notification where id=q.id;
  end if;
  if not q.email_enabled or not coalesce((rule->>'email')::boolean,false) then
   update public.rallora_delivery_queue set status='accepted',accepted_at=now(),last_error=null where id=q.id; continue;
  end if;
  update public.rallora_delivery_queue set status='sending',attempts=attempts+1,locked_until=now()+interval '6 minutes' where id=q.id;
  batch:=batch||jsonb_build_array(jsonb_build_object('id',q.id,'to',q.recipient_email,'title',q.title,'body',q.body,'actionUrl',q.action_url,'brand',q.payload));
 end loop;
 return batch;
end $$;
revoke all on function rallora_private.claim_deliveries(text) from public;
grant usage on schema rallora_private to anon;
grant execute on function rallora_private.claim_deliveries(text) to anon,authenticated;
create function public.rallora_claim_deliveries(p_token text) returns jsonb language sql security invoker set search_path='' as $$ select rallora_private.claim_deliveries(p_token) $$;
revoke all on function public.rallora_claim_deliveries(text) from public;
grant execute on function public.rallora_claim_deliveries(text) to anon,authenticated;
create function rallora_private.finish_delivery(p_token text,p_id uuid,p_provider_id text,p_error text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from rallora_private.delivery_worker_config where token=p_token and length(p_token)=64) then raise exception 'Not authorised'; end if;
 update public.rallora_delivery_queue set status=case when p_provider_id is not null then 'accepted' when attempts>=6 then 'failed' else 'queued' end,
 provider_id=p_provider_id,last_error=left(p_error,300),accepted_at=case when p_provider_id is not null then now() end,
 available_at=now()+make_interval(mins=>least(120,power(2,attempts)::int)),locked_until=null where id=p_id and status='sending';
end $$;
revoke all on function rallora_private.finish_delivery(text,uuid,text,text) from public;
grant execute on function rallora_private.finish_delivery(text,uuid,text,text) to anon,authenticated;
create function public.rallora_finish_delivery(p_token text,p_id uuid,p_provider_id text default null,p_error text default null) returns void language sql security invoker set search_path='' as $$ select rallora_private.finish_delivery(p_token,p_id,p_provider_id,p_error) $$;
revoke all on function public.rallora_finish_delivery(text,uuid,text,text) from public;
grant execute on function public.rallora_finish_delivery(text,uuid,text,text) to anon,authenticated;

-- Structured end date propagates with cycles and blocks any generation past the finish.
alter table public.seasons add column competition_ends_on date;
create function rallora_private.enforce_competition_end() returns trigger language plpgsql security definer set search_path='' as $$
declare cutoff date;
begin
 if new.previous_season_id is not null then
  select competition_ends_on into cutoff from public.seasons where id=new.previous_season_id;
  if cutoff is not null then new.competition_ends_on:=cutoff; end if;
 end if;
 if new.competition_ends_on is not null and (new.starts_on>new.competition_ends_on or new.ends_on>new.competition_ends_on) then raise exception 'The fixture window cannot run past the competition finish date (%)',new.competition_ends_on; end if;
 if tg_op='UPDATE' and old.competition_ends_on is distinct from new.competition_ends_on and exists(select 1 from public.seasons where previous_season_id=new.id) then raise exception 'Update the latest cycle; historical cycles are locked'; end if;
 return new;
end $$;
revoke all on function rallora_private.enforce_competition_end() from public,anon,authenticated;
create trigger enforce_competition_end before insert or update on public.seasons for each row execute function rallora_private.enforce_competition_end();
create or replace function public.rallora_notify_result_submission()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_slug text; v_opponent uuid; v_home uuid; v_away uuid;
begin
 select s.club_id,c.slug,f.home_team_id,f.away_team_id,case when f.home_team_id=new.submitting_team_id then f.away_team_id else f.home_team_id end
 into v_club,v_slug,v_home,v_away,v_opponent from public.fixtures f join public.seasons s on s.id=f.season_id join public.clubs c on c.id=s.club_id where f.id=new.fixture_id;
 if tg_op='INSERT' or new.status is distinct from old.status then
  if new.status='pending_opponent' then
   insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url,source_submission_id)
   select distinct r.player_user_id,v_club,'result_review','Result awaiting confirmation','The opposing captain has submitted a result. Please review it in your captain centre.','/clubs/'||v_slug||'/captain',new.id
   from public.rallora_team_roster_memberships r where r.team_id=v_opponent and r.role='captain' and r.player_user_id is distinct from new.submitted_by_user_id;
  elsif new.status in ('confirmed_by_opponent','admin_approved','disputed') then
   insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url,source_submission_id)
   select distinct r.player_user_id,v_club,'result_'||new.status,case when new.status='disputed' then 'Result disputed' else 'Result confirmed' end,
    case when new.status='disputed' then 'This result has been disputed. Your organiser will review it.' else 'Your fixture has an official result. The league standings have been updated.' end,
    '/clubs/'||v_slug||'/captain',new.id
   from public.rallora_team_roster_memberships r where r.team_id in(v_home,v_away) and r.role='captain';
   if new.status='disputed' then
    insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url,source_submission_id)
    select distinct m.user_id,v_club,'result_disputed','A result needs your review','A captain has disputed a result. Open fixture operations to review the score and dispute note.','/clubs/'||v_slug||'/admin',new.id
    from public.rallora_club_memberships m where m.club_id=v_club and m.status='active' and m.role in ('owner','admin','organiser');
   end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.rallora_notify_result_submission() from public,anon,authenticated;
create function rallora_private.enforce_fixture_finish() returns trigger language plpgsql security definer set search_path='' as $$
declare finish date;
begin
 select competition_ends_on into finish from public.seasons where id=new.season_id;
 if finish is not null and (new.play_by>finish or new.available_from>finish) then raise exception 'A fixture cannot run beyond the competition finish date (%)',finish; end if;
 return new;
end $$;
revoke all on function rallora_private.enforce_fixture_finish() from public,anon,authenticated;
create trigger enforce_fixture_finish before insert or update of play_by,available_from,season_id on public.fixtures for each row execute function rallora_private.enforce_fixture_finish();

create function rallora_private.validate_entry_ratings() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='pending' and exists(select 1 from public.seasons where id=new.season_id and division_assignment_mode='combined_rating') and
 (new.captain_playtomic_rating is null or new.partner_playtomic_rating is null or new.captain_playtomic_rating not between 0 and 10 or new.partner_playtomic_rating not between 0 and 10) then
 raise exception 'Both players need current Playtomic ratings (0–10) for initial box placement'; end if;
 return new;
end $$;
revoke all on function rallora_private.validate_entry_ratings() from public,anon,authenticated;
create trigger validate_entry_ratings before insert on public.rallora_team_applications for each row execute function rallora_private.validate_entry_ratings();
create function rallora_private.queue_pool_registration() returns trigger language plpgsql security definer set search_path='' as $$
declare slug text;
begin
 select c.slug into slug from public.clubs c where c.id=new.club_id;
 perform rallora_private.enqueue_message(new.club_id,new.user_id,null,'registration','pool:'||new.id,
 case when new.pool_type='single' then 'You have joined the partner-finding list' else 'You have joined the standby list' end,
 case when new.pool_type='single' then 'Your club can now see your entry and will try to help find a suitable partner. A pairing is not guaranteed.' else 'Your club can contact you if a replacement player is needed.' end,'/clubs/'||slug||'/register');
 return new;
end $$;
revoke all on function rallora_private.queue_pool_registration() from public,anon,authenticated;
create trigger queue_pool_registration after insert on public.rallora_player_pools for each row execute function rallora_private.queue_pool_registration();

commit;
