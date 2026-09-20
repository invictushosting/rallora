-- RALLORA: proposed manual bank/cash receipt verification, STAGING ONLY.
-- Not installed on any real Supabase project and no live reconciliation API.
-- Applies after 004_league_entry_prizes.sql and 005_payment_options_noncash.sql.
begin;

-- Make currency part of the database-enforced registration identity.
create unique index if not exists league_registration_currency_scope
  on public.rallora_league_paid_registrations
    (id,club_id,season_id,currency);

create table if not exists public.rallora_league_manual_receipt_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  season_id uuid not null,
  registration_id uuid not null,
  option_id uuid not null,
  kind text not null check(kind in ('captured','refunded','part_refunded','reversed')),
  related_event_id uuid,
  constraint manual_reversal_has_source check(
    (kind='reversed') = (related_event_id is not null)),
  amount_pence bigint not null check(amount_pence between 1 and 100000000),
  currency text not null check(currency in ('GBP','EUR','USD')),
  -- Server-side hash of source receipt reference. Do not persist card numbers,
  -- account numbers, raw bank statement lines or sensitive player notes.
  receipt_fingerprint text not null
    check(receipt_fingerprint ~ '^[a-f0-9]{64}$'),
  verified_by uuid not null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(club_id,season_id,receipt_fingerprint),
  unique(related_event_id),
  unique(id,club_id,season_id),
  constraint manual_reversal_same_club_fk foreign key
    (related_event_id,club_id,season_id)
    references public.rallora_league_manual_receipt_events
      (id,club_id,season_id),
  constraint manual_receipt_registration_fk
    foreign key(registration_id,club_id,season_id,currency)
    references public.rallora_league_paid_registrations
      (id,club_id,season_id,currency),
  constraint manual_receipt_option_fk
    foreign key(option_id,club_id,season_id)
    references public.rallora_league_collection_options(id,club_id,season_id)
);

-- Trusted backend inserts still receive database validation. No browser role
-- gains INSERT, UPDATE or DELETE privileges through this feature.
create or replace function public.rallora_validate_manual_receipt()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  method text;
  enabled_status text;
  reversed_event public.rallora_league_manual_receipt_events%rowtype;
begin
  select o.method,o.status into method,enabled_status
    from public.rallora_league_collection_options o
    where o.id=new.option_id and o.club_id=new.club_id
      and o.season_id=new.season_id;
  if method not in ('bank_transfer','cash_at_club')
      or enabled_status <> 'approved' then
    raise exception 'Verified manual receipt requires an approved club collection option'
      using errcode='23514';
  end if;
  if new.kind='reversed' then
    select * into reversed_event
      from public.rallora_league_manual_receipt_events e
      where e.id=new.related_event_id
        and e.club_id=new.club_id and e.season_id=new.season_id;
    if not found
      or reversed_event.kind='reversed'
      or reversed_event.registration_id<>new.registration_id
      or reversed_event.option_id<>new.option_id
      or reversed_event.currency<>new.currency
      or reversed_event.amount_pence<>new.amount_pence then
      raise exception 'Reversal must reference an identical earlier event'
        using errcode='23514';
    end if;
  end if;
  if not (
    exists (select 1 from public.rallora_platform_admins p
      where p.user_id=new.verified_by)
    or exists (select 1 from public.rallora_club_memberships m
      where m.user_id=new.verified_by and m.club_id=new.club_id
        and m.status='active' and m.role in ('owner','admin'))
  ) then
    raise exception 'Verifier is not an active authorised finance manager'
      using errcode='23514';
  end if;
  return new;
end
$$;
revoke all on function public.rallora_validate_manual_receipt()
  from public,anon,authenticated;

create trigger manual_receipt_verify
  before insert on public.rallora_league_manual_receipt_events
  for each row execute function public.rallora_validate_manual_receipt();

-- Append-only, even a background worker cannot quietly edit earlier records.
create or replace function public.rallora_deny_receipt_rewrite()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  raise exception 'Manual receipt events are append-only; add a correction event'
    using errcode='23514';
end
$$;
revoke all on function public.rallora_deny_receipt_rewrite()
  from public,anon,authenticated;

create trigger manual_receipt_no_update_delete
  before update or delete on public.rallora_league_manual_receipt_events
  for each row execute function public.rallora_deny_receipt_rewrite();

create index if not exists league_receipt_registration
  on public.rallora_league_manual_receipt_events
  (club_id,season_id,registration_id,created_at);

alter table public.rallora_league_manual_receipt_events enable row level security;
revoke all on public.rallora_league_manual_receipt_events
  from public,anon,authenticated;

-- Club owner and administrator may VIEW source-verification audit events.
-- Organiser roles do not see bank/cash receipt-level data by default.
grant select on public.rallora_league_manual_receipt_events to authenticated;

-- Explicit helper parameter prevents correlated SQL accidentally resolving
-- club_id to m.club_id inside the membership subquery (an interclub data leak).
create or replace function public.rallora_finance_can_read_club(p_club uuid)
returns boolean language sql stable security definer set search_path=''
as $
  select exists(select 1 from public.rallora_platform_admins p
    where p.user_id=(select auth.uid()))
    or exists(select 1 from public.rallora_club_memberships m
      where m.user_id=(select auth.uid()) and m.club_id=p_club
        and m.status='active' and m.role in ('owner','admin'));
$;
revoke all on function public.rallora_finance_can_read_club(uuid)
  from public,anon,authenticated;
grant execute on function public.rallora_finance_can_read_club(uuid)
  to authenticated;

create policy finance_receipts_manager_read
  on public.rallora_league_manual_receipt_events
  for select to authenticated
  using(public.rallora_finance_can_read_club(club_id));

commit;
