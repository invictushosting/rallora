begin;

alter table public.rallora_club_entry_fees drop constraint rallora_club_entry_fees_method_check,
  add check (method in ('bank_transfer','cash_at_club','stripe_connect')),
  add check (method<>'stripe_connect' or amount_pence>=30);
alter table public.rallora_entry_payments drop constraint rallora_entry_payments_status_check,
  add check (status in ('awaiting_payment','paid','partially_refunded','refunded'));
alter table rallora_private.entry_payment_audit drop constraint entry_payment_audit_action_check,
  add check (action in ('awaiting_payment','paid','partially_refunded','refunded'));

create table rallora_private.stripe_club_accounts (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  stripe_account text not null unique check (stripe_account ~ '^acct_[a-zA-Z0-9]+$'),
  authorised boolean not null default true,
  charges_enabled boolean not null default false
);
create table rallora_private.stripe_oauth_states (
  state uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now()+interval '15 minutes'
);
create table rallora_private.stripe_entry_sessions (
  application_id uuid primary key references public.rallora_entry_payments(application_id) on delete cascade,
  stripe_account text not null references rallora_private.stripe_club_accounts(stripe_account),
  attempt uuid not null default gen_random_uuid() unique,
  session_id text unique check (session_id ~ '^cs_test_[a-zA-Z0-9]+$'),
  refunded_pence integer not null default 0 check (refunded_pence>=0)
);
alter table rallora_private.stripe_club_accounts enable row level security;
alter table rallora_private.stripe_oauth_states enable row level security;
alter table rallora_private.stripe_entry_sessions enable row level security;
revoke all on rallora_private.stripe_club_accounts,rallora_private.stripe_oauth_states,rallora_private.stripe_entry_sessions from public,anon,authenticated;

create function rallora_private.can_manage_stripe(p_user uuid,p_club uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from public.rallora_club_memberships m
    where m.user_id=p_user and m.club_id=p_club and m.status='active' and m.role in ('owner','admin'))
    or exists(select 1 from public.rallora_platform_admins p where p.user_id=p_user)
$$;

create function rallora_private.stripe_require_account() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.enabled and new.method='stripe_connect' and not exists (
    select 1 from public.seasons s join rallora_private.stripe_club_accounts x on x.club_id=s.club_id
    where s.id=new.season_id and x.authorised and x.charges_enabled) then
    raise exception 'Connect a Stripe account that can accept payments first';
  end if;
  return new;
end $$;
create trigger stripe_require_account before insert or update on public.rallora_club_entry_fees
  for each row execute function rallora_private.stripe_require_account();

create or replace function rallora_private.record_entry_payment(p_application_id uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare entry public.rallora_team_applications%rowtype; current_status text; payment_method text;
begin
  select * into entry from public.rallora_team_applications where id=p_application_id for update;
  if not found or not public.rallora_can_manage_club(entry.club_id) then raise exception 'Entry unavailable'; end if;
  select status,method into current_status,payment_method from public.rallora_entry_payments where application_id=entry.id for update;
  if not found then raise exception 'This entry has no fee'; end if;
  if payment_method='stripe_connect' then raise exception 'Stripe confirms payments and refunds for this entry'; end if;
  if p_action=current_status then return; end if;
  if not coalesce(
    (p_action='paid' and current_status='awaiting_payment')
    or (p_action='awaiting_payment' and current_status='paid' and entry.status='pending')
    or (p_action='refunded' and current_status='paid'),false) then
    raise exception 'That payment change is unavailable';
  end if;
  update public.rallora_entry_payments set status=p_action where application_id=entry.id;
  insert into rallora_private.entry_payment_audit(application_id,actor_id,action)
    values(entry.id,auth.uid(),p_action);
end $$;
create function rallora_private.stripe_account(p_user uuid,p_slug text,p_account text,p_ready boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c uuid; result jsonb;
begin
  select id into c from public.clubs where slug=p_slug and is_active;
  if not found or not rallora_private.can_manage_stripe(p_user,c) then return null; end if;
  if p_account is not null then
    insert into rallora_private.stripe_club_accounts(club_id,stripe_account,charges_enabled)
      values(c,p_account,coalesce(p_ready,false))
      on conflict(club_id) do update set authorised=true,charges_enabled=excluded.charges_enabled
      where stripe_club_accounts.stripe_account=excluded.stripe_account;
    if not found then raise exception 'Reconnect the original Stripe account for this club'; end if;
  end if;
  select jsonb_build_object('connected',authorised,'ready',authorised and charges_enabled) into result
    from rallora_private.stripe_club_accounts where club_id=c;
  return coalesce(result,'{"connected":false,"ready":false}'::jsonb);
end $$;

create function rallora_private.stripe_oauth(p_user uuid,p_slug text,p_state uuid) returns text
language plpgsql security definer set search_path='' as $$
declare result text; c uuid;
begin
  if p_state is not null then
    delete from rallora_private.stripe_oauth_states s using public.clubs club
      where s.state=p_state and s.user_id=p_user and s.expires_at>now()
      and club.id=s.club_id and club.is_active and rallora_private.can_manage_stripe(p_user,club.id)
      returning club.slug into result;
    return result;
  end if;
  select id into c from public.clubs where slug=p_slug and is_active;
  if not found or not rallora_private.can_manage_stripe(p_user,c) then return null; end if;
  delete from rallora_private.stripe_oauth_states where expires_at<=now();
  insert into rallora_private.stripe_oauth_states(club_id,user_id) values(c,p_user) returning state::text into result;
  return result;
end $$;

create function rallora_private.stripe_checkout(p_user uuid,p_entry uuid,p_attempt uuid,p_session text,p_expired boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.rallora_entry_payments%rowtype; x rallora_private.stripe_entry_sessions%rowtype; account_id text;
begin
  perform 1 from public.rallora_team_applications where id=p_entry and status='pending' for update;
  if not found then return null; end if;
  select * into p from public.rallora_entry_payments
    where application_id=p_entry and payer_user_id=p_user and method='stripe_connect' and status='awaiting_payment' for update;
  if not found then return null; end if;
  select connected.stripe_account into account_id from rallora_private.stripe_club_accounts connected
    join public.clubs c on c.id=connected.club_id and c.is_active
    where connected.club_id=p.club_id and connected.authorised and connected.charges_enabled;
  if not found then return null; end if;
  insert into rallora_private.stripe_entry_sessions(application_id,stripe_account) values(p_entry,account_id)
    on conflict (application_id) do nothing;
  select * into x from rallora_private.stripe_entry_sessions where application_id=p_entry;
  if p_expired and x.attempt=p_attempt and x.session_id=p_session then
    update rallora_private.stripe_entry_sessions set attempt=gen_random_uuid(),session_id=null
      where application_id=p_entry returning * into x;
  elsif not p_expired and p_session is not null then
    if x.attempt is distinct from p_attempt or (x.session_id is not null and x.session_id<>p_session) then return null; end if;
    update rallora_private.stripe_entry_sessions set session_id=p_session
      where application_id=p_entry returning * into x;
  end if;
  return jsonb_build_object('attempt',x.attempt,'account',x.stripe_account,'session',x.session_id,'amount',p.amount_pence);
end $$;

create function rallora_private.stripe_session(p_account text,p_attempt uuid) returns text
language sql stable security definer set search_path='' as $$
  select session_id from rallora_private.stripe_entry_sessions where stripe_account=p_account and attempt=p_attempt
$$;

create function rallora_private.stripe_reconcile(p_account text,p_attempt uuid,p_session text,p_amount integer,p_refunded integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare entry uuid; p public.rallora_entry_payments%rowtype; refunded integer; next_status text;
begin
  select application_id into entry from rallora_private.stripe_entry_sessions
    where stripe_account=p_account and attempt=p_attempt and session_id=p_session;
  if not found then return false; end if;
  perform 1 from public.rallora_team_applications where id=entry for update;
  select * into p from public.rallora_entry_payments where application_id=entry for update;
  if not found or p.method<>'stripe_connect' or p.amount_pence is distinct from p_amount or p_refunded not between 0 and p_amount
    or p_refunded is null then return false; end if;
  update rallora_private.stripe_entry_sessions set refunded_pence=greatest(refunded_pence,p_refunded)
    where application_id=entry and stripe_account=p_account and attempt=p_attempt and session_id=p_session
    returning refunded_pence into refunded;
  if not found then return false; end if;
  next_status:=case when refunded=p_amount then 'refunded' when refunded>0 then 'partially_refunded' else 'paid' end;
  if next_status is distinct from p.status then
    update public.rallora_entry_payments set status=next_status where application_id=entry;
    insert into rallora_private.entry_payment_audit(application_id,action) values(entry,next_status);
  end if;
  return true;
end $$;

create function rallora_private.stripe_account_event(p_account text,p_authorised boolean,p_ready boolean) returns void
language sql security definer set search_path='' as $$
  update rallora_private.stripe_club_accounts
    set authorised=authorised and p_authorised,charges_enabled=p_ready and authorised and p_authorised
    where stripe_account=p_account
$$;

create function public.rallora_stripe_account(p_user uuid,p_slug text,p_account text,p_ready boolean) returns jsonb
language sql security invoker set search_path='' as $$
  select rallora_private.stripe_account(p_user,p_slug,p_account,p_ready)
$$;
revoke all on function rallora_private.stripe_account(uuid,text,text,boolean),public.rallora_stripe_account(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function rallora_private.stripe_account(uuid,text,text,boolean),public.rallora_stripe_account(uuid,text,text,boolean) to service_role;

create function public.rallora_stripe_oauth(p_user uuid,p_slug text,p_state uuid) returns text
language sql security invoker set search_path='' as $$
  select rallora_private.stripe_oauth(p_user,p_slug,p_state)
$$;
revoke all on function rallora_private.stripe_oauth(uuid,text,uuid),public.rallora_stripe_oauth(uuid,text,uuid) from public,anon,authenticated;
grant execute on function rallora_private.stripe_oauth(uuid,text,uuid),public.rallora_stripe_oauth(uuid,text,uuid) to service_role;

create function public.rallora_stripe_checkout(p_user uuid,p_entry uuid,p_attempt uuid,p_session text,p_expired boolean) returns jsonb
language sql security invoker set search_path='' as $$
  select rallora_private.stripe_checkout(p_user,p_entry,p_attempt,p_session,p_expired)
$$;
revoke all on function rallora_private.stripe_checkout(uuid,uuid,uuid,text,boolean),public.rallora_stripe_checkout(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function rallora_private.stripe_checkout(uuid,uuid,uuid,text,boolean),public.rallora_stripe_checkout(uuid,uuid,uuid,text,boolean) to service_role;

create function public.rallora_stripe_session(p_account text,p_attempt uuid) returns text
language sql security invoker set search_path='' as $$
  select rallora_private.stripe_session(p_account,p_attempt)
$$;
revoke all on function rallora_private.stripe_session(text,uuid),public.rallora_stripe_session(text,uuid) from public,anon,authenticated;
grant execute on function rallora_private.stripe_session(text,uuid),public.rallora_stripe_session(text,uuid) to service_role;

create function public.rallora_stripe_reconcile(p_account text,p_attempt uuid,p_session text,p_amount integer,p_refunded integer) returns boolean
language sql security invoker set search_path='' as $$
  select rallora_private.stripe_reconcile(p_account,p_attempt,p_session,p_amount,p_refunded)
$$;
revoke all on function rallora_private.stripe_reconcile(text,uuid,text,integer,integer),public.rallora_stripe_reconcile(text,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function rallora_private.stripe_reconcile(text,uuid,text,integer,integer),public.rallora_stripe_reconcile(text,uuid,text,integer,integer) to service_role;

create function public.rallora_stripe_account_event(p_account text,p_authorised boolean,p_ready boolean) returns void
language sql security invoker set search_path='' as $$
  select rallora_private.stripe_account_event(p_account,p_authorised,p_ready)
$$;
revoke all on function rallora_private.stripe_account_event(text,boolean,boolean),public.rallora_stripe_account_event(text,boolean,boolean) from public,anon,authenticated;
grant execute on function rallora_private.stripe_account_event(text,boolean,boolean),public.rallora_stripe_account_event(text,boolean,boolean) to service_role;

grant usage on schema rallora_private to service_role;
revoke all on function rallora_private.can_manage_stripe(uuid,uuid),
  rallora_private.stripe_require_account()
  from public,anon,authenticated;

commit;
