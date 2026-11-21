begin;

alter table public.rallora_communication_settings add column whatsapp_enabled boolean not null default false;

create table rallora_private.whatsapp_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),
  confirmation_code text unique,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  stopped_at timestamptz,
  consent_version integer not null default 1
);
create unique index whatsapp_one_active_account_per_phone on rallora_private.whatsapp_preferences(phone)
  where confirmed_at is not null and stopped_at is null;

create table rallora_private.whatsapp_inbound_events (
  message_sid text primary key
);

create table rallora_private.whatsapp_deliveries (
  delivery_id uuid primary key references public.rallora_delivery_queue(id) on delete cascade,
  consent_confirmed_at timestamptz not null,
  status text not null default 'queued' check(status in ('queued','sending','accepted','failed','cancelled','unconfirmed')),
  claimed_at timestamptz,
  provider_id text unique
);
create index whatsapp_queued_deliveries on rallora_private.whatsapp_deliveries(delivery_id) where status='queued';

alter table rallora_private.whatsapp_preferences enable row level security;
alter table rallora_private.whatsapp_inbound_events enable row level security;
alter table rallora_private.whatsapp_deliveries enable row level security;
revoke all on rallora_private.whatsapp_preferences,rallora_private.whatsapp_inbound_events,rallora_private.whatsapp_deliveries from public,anon,authenticated;

create table rallora_private.whatsapp_prompt_seen (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table rallora_private.whatsapp_prompt_seen enable row level security;
revoke all on rallora_private.whatsapp_prompt_seen from public,anon,authenticated;

create function rallora_private.claim_whatsapp_prompt(p_club_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null or public.rallora_is_platform_admin() then return false; end if;
  insert into rallora_private.whatsapp_prompt_seen(user_id)
    select uid
    where exists (
      select 1 from public.rallora_team_roster_memberships m
      join public.seasons s on s.id=m.season_id and s.club_id=m.club_id and s.status='active'
      join public.clubs c on c.id=m.club_id and c.is_active
      join public.rallora_communication_settings cs on cs.club_id=m.club_id and cs.enabled and cs.whatsapp_enabled
      where m.player_user_id=uid and m.club_id=p_club_id
    ) and not exists (
      select 1 from rallora_private.whatsapp_preferences where user_id=uid
    )
    on conflict (user_id) do nothing;
  return found;
end $$;
create function public.rallora_claim_whatsapp_prompt(p_club_id uuid) returns boolean
language sql security invoker set search_path='' as $$
  select rallora_private.claim_whatsapp_prompt(p_club_id)
$$;
revoke all on function rallora_private.claim_whatsapp_prompt(uuid),public.rallora_claim_whatsapp_prompt(uuid) from public,anon;
grant execute on function rallora_private.claim_whatsapp_prompt(uuid),public.rallora_claim_whatsapp_prompt(uuid) to authenticated;

create function rallora_private.whatsapp_preference(p_action text,p_phone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); preference rallora_private.whatsapp_preferences%rowtype; code text;
begin
  if uid is null then raise exception 'Sign in to manage WhatsApp reminders'; end if;
  if p_action='request' then
    if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Enter your WhatsApp number with its country code'; end if;
    code:=replace(gen_random_uuid()::text,'-','');
    insert into rallora_private.whatsapp_preferences(user_id,phone,confirmation_code)
      values(uid,p_phone,code)
      on conflict(user_id) do update set phone=excluded.phone,confirmation_code=excluded.confirmation_code,
        requested_at=now(),confirmed_at=null,stopped_at=null,consent_version=1;
    return jsonb_build_object('status','pending','phone',p_phone,'code',code);
  elsif p_action='stop' then
    update rallora_private.whatsapp_preferences set stopped_at=now(),confirmation_code=null where user_id=uid and stopped_at is null;
  elsif p_action is distinct from 'read' then
    raise exception 'Invalid WhatsApp preference action';
  end if;
  select * into preference from rallora_private.whatsapp_preferences where user_id=uid;
  return case
    when preference.confirmed_at is not null and preference.stopped_at is null then jsonb_build_object('status','active','phone',preference.phone)
    when preference.confirmation_code is not null and preference.requested_at>now()-interval '15 minutes' then
      jsonb_build_object('status','pending','phone',preference.phone,'code',preference.confirmation_code)
    else jsonb_build_object('status','off') end;
end $$;
create function public.rallora_whatsapp_preference(p_action text,p_phone text default null) returns jsonb
language sql security invoker set search_path='' as $$
  select rallora_private.whatsapp_preference(p_action,p_phone)
$$;
revoke all on function rallora_private.whatsapp_preference(text,text),public.rallora_whatsapp_preference(text,text) from public,anon;
grant execute on function rallora_private.whatsapp_preference(text,text),public.rallora_whatsapp_preference(text,text) to authenticated;

create function rallora_private.whatsapp_inbound(p_sid text,p_phone text,p_command text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_sid is null or p_sid !~ '^SM[0-9a-fA-F]{32}$' or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$'
    or p_command is null or (p_command<>'STOP' and p_command !~ '^JOIN [0-9a-f]{32}$') then return; end if;
  insert into rallora_private.whatsapp_inbound_events(message_sid) values(p_sid) on conflict do nothing;
  if not found then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_phone,0));
  if p_command='STOP' then
    update rallora_private.whatsapp_preferences set stopped_at=now(),confirmation_code=null where phone=p_phone and stopped_at is null;
  else
    -- A number already linked to another account must be disconnected there or by STOP first.
    if exists(select 1 from rallora_private.whatsapp_preferences
      where phone=p_phone and confirmed_at is not null and stopped_at is null) then return; end if;
    update rallora_private.whatsapp_preferences set confirmed_at=now(),confirmation_code=null
      where phone=p_phone and confirmation_code=substr(p_command,6) and stopped_at is null
      and requested_at>now()-interval '15 minutes';
  end if;
end $$;
create function public.rallora_whatsapp_inbound(p_sid text,p_phone text,p_command text) returns void
language sql security invoker set search_path='' as $$
  select rallora_private.whatsapp_inbound(p_sid,p_phone,p_command)
$$;
revoke all on function rallora_private.whatsapp_inbound(text,text,text),public.rallora_whatsapp_inbound(text,text,text) from public,anon,authenticated;
grant usage on schema rallora_private to service_role;
grant execute on function rallora_private.whatsapp_inbound(text,text,text),public.rallora_whatsapp_inbound(text,text,text) to service_role;

create function rallora_private.queue_whatsapp_reminder() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.fixture_id is not null and new.category in ('booking','upcoming','missing_result','confirmation','overdue') then
    insert into rallora_private.whatsapp_deliveries(delivery_id,consent_confirmed_at)
      select new.id,p.confirmed_at from rallora_private.whatsapp_preferences p
      join public.rallora_communication_settings cs on cs.club_id=new.club_id and cs.whatsapp_enabled
      where p.user_id=new.recipient_user_id and p.confirmed_at is not null and p.stopped_at is null;
  end if;
  return new;
end $$;
revoke all on function rallora_private.queue_whatsapp_reminder() from public,anon,authenticated;
create trigger queue_whatsapp_reminder after insert on public.rallora_delivery_queue
  for each row execute function rallora_private.queue_whatsapp_reminder();

create or replace function rallora_private.enqueue_message(p_club uuid,p_user uuid,p_email text,p_category text,p_key text,p_title text,p_body text,p_url text,p_fixture uuid default null,p_invite uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare cfg public.rallora_communication_settings%rowtype; c public.clubs%rowtype; r jsonb; address text; q uuid;
begin
 select * into cfg from public.rallora_communication_settings where club_id=p_club and enabled;
 if not found then return null; end if;
 r:=cfg.rules->p_category;
 if not coalesce((r->>'enabled')::boolean,false) or not (coalesce((r->>'email')::boolean,false) or coalesce((r->>'in_app')::boolean,false)
   or (cfg.whatsapp_enabled and p_fixture is not null and p_category in ('booking','upcoming','missing_result','confirmation','overdue')
       and exists (select 1 from rallora_private.whatsapp_preferences p
         where p.user_id=p_user and p.confirmed_at is not null and p.stopped_at is null))) then return null; end if;
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

create function rallora_private.claim_whatsapp_reminder(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare reminder record; clock_hour integer;
begin
  if not exists(select 1 from rallora_private.delivery_worker_config where token=p_token and length(p_token)=64) then raise exception 'Not authorised'; end if;
  perform pg_advisory_xact_lock(734822);
  -- An interrupted provider request has an unknown outcome. Do not send twice.
  update rallora_private.whatsapp_deliveries set status='unconfirmed'
    where status='sending' and claimed_at<now()-interval '6 minutes';

  for reminder in
    select j.id,j.category,j.fixture_id,j.title,j.body,j.action_url,j.payload,j.club_id,j.recipient_user_id,j.created_at,
      d.consent_confirmed_at,p.confirmed_at,p.stopped_at,p.phone,cs.enabled,cs.whatsapp_enabled,cs.rules,
      cs.timezone,cs.send_hour,cs.quiet_end_hour,cs.daily_limit
    from rallora_private.whatsapp_deliveries d
      join public.rallora_delivery_queue j on j.id=d.delivery_id
      join public.rallora_communication_settings cs on cs.club_id=j.club_id
      left join rallora_private.whatsapp_preferences p on p.user_id=j.recipient_user_id
    where d.status='queued'
    order by j.created_at,j.id
    for update of d skip locked
  loop
    if not reminder.enabled or not reminder.whatsapp_enabled
      or not coalesce((reminder.rules->reminder.category->>'enabled')::boolean,false)
      or reminder.confirmed_at is distinct from reminder.consent_confirmed_at or reminder.stopped_at is not null
      or reminder.created_at<now()-interval '24 hours'
      or not rallora_private.reminder_relevant(reminder.fixture_id,reminder.category,reminder.recipient_user_id) then
      update rallora_private.whatsapp_deliveries set status='cancelled' where delivery_id=reminder.id;
      continue;
    end if;
    clock_hour:=extract(hour from now() at time zone reminder.timezone);
    if clock_hour<reminder.send_hour or clock_hour>=reminder.quiet_end_hour then continue; end if;
    if (select count(*) from rallora_private.whatsapp_deliveries d
        join public.rallora_delivery_queue j on j.id=d.delivery_id
        where j.club_id=reminder.club_id and j.recipient_user_id=reminder.recipient_user_id
          and (d.claimed_at at time zone reminder.timezone)::date=(now() at time zone reminder.timezone)::date)
      >=reminder.daily_limit then continue; end if;
    update rallora_private.whatsapp_deliveries set status='sending',claimed_at=now() where delivery_id=reminder.id;
    return jsonb_build_object('id',reminder.id,'to',reminder.phone,'title',reminder.title,
      'body',reminder.body,'actionUrl',reminder.action_url,'clubName',reminder.payload->>'name');
  end loop;
  return null;
end $$;

create function rallora_private.finish_whatsapp_reminder(p_token text,p_id uuid,p_sid text,p_status text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from rallora_private.delivery_worker_config where token=p_token and length(p_token)=64) then raise exception 'Not authorised'; end if;
  if p_status is null or p_status not in ('accepted','failed','unconfirmed')
    or (p_status='accepted' and (p_sid is null or p_sid !~ '^SM[0-9a-fA-F]{32}$')) then
    raise exception 'Invalid WhatsApp delivery result';
  end if;
  update rallora_private.whatsapp_deliveries set status=p_status,provider_id=p_sid
    where delivery_id=p_id and status='sending';
end $$;
create function public.rallora_claim_whatsapp_reminder(p_token text) returns jsonb
language sql security invoker set search_path='' as $$
  select rallora_private.claim_whatsapp_reminder(p_token)
$$;
create function public.rallora_finish_whatsapp_reminder(p_token text,p_id uuid,p_sid text,p_status text) returns void
language sql security invoker set search_path='' as $$
  select rallora_private.finish_whatsapp_reminder(p_token,p_id,p_sid,p_status)
$$;
revoke all on function rallora_private.claim_whatsapp_reminder(text),public.rallora_claim_whatsapp_reminder(text),
  rallora_private.finish_whatsapp_reminder(text,uuid,text,text),public.rallora_finish_whatsapp_reminder(text,uuid,text,text) from public,anon,authenticated;
grant execute on function rallora_private.claim_whatsapp_reminder(text),public.rallora_claim_whatsapp_reminder(text),
  rallora_private.finish_whatsapp_reminder(text,uuid,text,text),public.rallora_finish_whatsapp_reminder(text,uuid,text,text) to anon,authenticated;

create function rallora_private.whatsapp_delivery_history(p_club_id uuid) returns table(delivery_id uuid,status text)
language sql stable security definer set search_path='' as $$
  select d.delivery_id,d.status
  from (select q.id from public.rallora_delivery_queue q where q.club_id=p_club_id
        order by q.created_at desc,q.id desc limit 50) recent
  join rallora_private.whatsapp_deliveries d on d.delivery_id=recent.id
  where public.rallora_can_manage_club(p_club_id)
$$;
create function public.rallora_whatsapp_delivery_history(p_club_id uuid) returns table(delivery_id uuid,status text)
language sql stable security invoker set search_path='' as $$
  select * from rallora_private.whatsapp_delivery_history(p_club_id)
$$;
revoke all on function rallora_private.whatsapp_delivery_history(uuid),public.rallora_whatsapp_delivery_history(uuid) from public,anon;
grant execute on function rallora_private.whatsapp_delivery_history(uuid),public.rallora_whatsapp_delivery_history(uuid) to authenticated;

commit;
