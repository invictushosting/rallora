begin;

create table public.rallora_club_entry_fees (
  season_id uuid primary key references public.seasons(id) on delete cascade,
  version uuid not null default gen_random_uuid(),
  enabled boolean not null default false,
  amount_pence integer not null check (amount_pence between 1 and 100000),
  method text not null check (method in ('bank_transfer','cash_at_club')),
  instructions text not null check (char_length(btrim(instructions)) between 5 and 1000),
  refund_terms text not null check (char_length(btrim(refund_terms)) between 5 and 1000)
);

alter table public.rallora_club_entry_fees enable row level security;
revoke all on public.rallora_club_entry_fees from public,anon,authenticated;
grant select,insert,update on public.rallora_club_entry_fees to authenticated;
create policy manage_club_entry_fees on public.rallora_club_entry_fees
  for all to authenticated using (public.rallora_can_manage_season(season_id))
  with check (public.rallora_can_manage_season(season_id));

create function rallora_private.version_entry_fee() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.season_id::text,42));
    new.version:=gen_random_uuid();
    return new;
  end if;
  if new.season_id <> old.season_id then raise exception 'A fee belongs to its original competition'; end if;
  new.version := case
    when (new.enabled,new.amount_pence,new.method,new.instructions,new.refund_terms)
      is distinct from (old.enabled,old.amount_pence,old.method,old.instructions,old.refund_terms)
    then gen_random_uuid() else old.version end;
  return new;
end $$;
create trigger version_entry_fee before insert or update on public.rallora_club_entry_fees
  for each row execute function rallora_private.version_entry_fee();
revoke all on function rallora_private.version_entry_fee() from public,anon,authenticated;

create function rallora_private.entry_fee_quote(p_season_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('version',f.version,'amount_pence',f.amount_pence,
    'method',f.method,'refund_terms',f.refund_terms)
  from public.rallora_club_entry_fees f
  join public.seasons s on s.id=f.season_id
  join public.clubs c on c.id=s.club_id
  where f.season_id=p_season_id and f.enabled and s.registration_published and c.is_active
$$;
create function public.rallora_entry_fee_quote(p_season_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select rallora_private.entry_fee_quote(p_season_id)
$$;
revoke all on function rallora_private.entry_fee_quote(uuid),public.rallora_entry_fee_quote(uuid) from public;
grant execute on function rallora_private.entry_fee_quote(uuid),public.rallora_entry_fee_quote(uuid) to anon,authenticated;

alter table public.rallora_team_applications add column entry_fee_version uuid;

create table public.rallora_entry_payments (
  application_id uuid primary key references public.rallora_team_applications(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  payer_user_id uuid references auth.users(id) on delete set null,
  payment_reference text generated always as (upper(left(replace(application_id::text,'-',''),16))) stored unique,
  amount_pence integer not null,
  method text not null,
  instructions text not null,
  refund_terms text not null,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment','paid','refunded'))
);
alter table public.rallora_entry_payments enable row level security;
revoke all on public.rallora_entry_payments from public,anon,authenticated;
grant select on public.rallora_entry_payments to authenticated;
create policy read_own_entry_payment on public.rallora_entry_payments for select to authenticated
  using (payer_user_id=(select auth.uid()) or public.rallora_can_manage_club(club_id));

create table rallora_private.entry_payment_audit (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.rallora_entry_payments(application_id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('paid','awaiting_payment','refunded')),
  recorded_at timestamptz not null default now()
);
alter table rallora_private.entry_payment_audit enable row level security;
revoke all on rallora_private.entry_payment_audit from public,anon,authenticated;

create function rallora_private.snapshot_entry_fee() returns trigger
language plpgsql security definer set search_path='' as $$
declare fee public.rallora_club_entry_fees%rowtype;
begin
  if new.status <> 'pending' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.season_id::text,42));
  select * into fee from public.rallora_club_entry_fees where season_id=new.season_id for share;
  if coalesce(fee.enabled,false) then
    if not exists (select 1 from public.seasons s where s.id=new.season_id and s.club_id=new.club_id) then
      raise exception 'The entry fee applies only to this club and competition';
    end if;
    if new.created_team_id is not null then
      raise exception 'For this paid competition, submit the pair through registration before approving it';
    end if;
    if new.entry_fee_version is distinct from fee.version then
      raise exception 'The entry fee has changed. Refresh the registration and review the current fee.';
    end if;
    insert into public.rallora_entry_payments(application_id,club_id,payer_user_id,amount_pence,method,instructions,refund_terms)
      values(new.id,new.club_id,new.requested_by,fee.amount_pence,fee.method,fee.instructions,fee.refund_terms);
  elsif new.entry_fee_version is not null then
    raise exception 'The entry fee has changed. Refresh the registration and review the current fee.';
  end if;
  return new;
end $$;
revoke all on function rallora_private.snapshot_entry_fee() from public,anon,authenticated;
create trigger snapshot_entry_fee after insert on public.rallora_team_applications
  for each row execute function rallora_private.snapshot_entry_fee();

create function rallora_private.require_entry_payment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (new.club_id,new.season_id,new.entry_fee_version) is distinct from (old.club_id,old.season_id,old.entry_fee_version)
    and exists (select 1 from public.rallora_entry_payments p where p.application_id=old.id) then
    raise exception 'A paid entry record belongs to its original league';
  end if;
  if new.status='approved' and old.status is distinct from new.status
    and exists (select 1 from public.rallora_entry_payments p
      where p.application_id=new.id and p.status<>'paid') then
    raise exception 'Record the full entry payment before approving this pair';
  end if;
  return new;
end $$;
revoke all on function rallora_private.require_entry_payment() from public,anon,authenticated;
create trigger require_entry_payment before update of status,club_id,season_id,entry_fee_version on public.rallora_team_applications
  for each row execute function rallora_private.require_entry_payment();

create function rallora_private.record_entry_payment(p_application_id uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare entry public.rallora_team_applications%rowtype; current_status text;
begin
  select * into entry from public.rallora_team_applications where id=p_application_id for update;
  if not found or not public.rallora_can_manage_club(entry.club_id) then raise exception 'Entry unavailable'; end if;
  select status into current_status from public.rallora_entry_payments where application_id=entry.id for update;
  if not found then raise exception 'This entry has no fee'; end if;
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
create function public.rallora_record_entry_payment(p_application_id uuid,p_action text) returns void
language sql security invoker set search_path='' as $$
  select rallora_private.record_entry_payment(p_application_id,p_action)
$$;
revoke all on function rallora_private.record_entry_payment(uuid,text),public.rallora_record_entry_payment(uuid,text) from public,anon;
grant execute on function rallora_private.record_entry_payment(uuid,text),public.rallora_record_entry_payment(uuid,text) to authenticated;

create function rallora_private.my_entry_payments() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'application_id',p.application_id,'club_name',c.name,'season_name',s.name,'entry_status',a.status,
    'amount_pence',p.amount_pence,'method',p.method,'instructions',p.instructions,'refund_terms',p.refund_terms,
    'payment_reference',p.payment_reference,'status',p.status) order by a.created_at desc),'[]'::jsonb)
  from public.rallora_entry_payments p
  join public.rallora_team_applications a on a.id=p.application_id
  join public.seasons s on s.id=a.season_id
  join public.clubs c on c.id=p.club_id
  where p.payer_user_id=(select auth.uid())
$$;
create function public.rallora_my_entry_payments() returns jsonb
language sql stable security invoker set search_path='' as $$
  select rallora_private.my_entry_payments()
$$;
revoke all on function rallora_private.my_entry_payments(),public.rallora_my_entry_payments() from public,anon;
grant execute on function rallora_private.my_entry_payments(),public.rallora_my_entry_payments() to authenticated;

commit;
