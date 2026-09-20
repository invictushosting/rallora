-- RALLORA LEAGUES: PAID ENTRY & PRIZE FUNDING, STAGING-ONLY DESIGN.
-- DO NOT apply to production until real isolated Supabase staging, backup/restore,
-- provider approval, prize/legal checks, and owner sign-off. Synthetic CI ONLY.
-- None of these tables holds money or triggers provider checkout / payout.
begin;

-- Enforce a season belongs to precisely the claimed club, regardless of RLS
-- and even for later trusted backend writers.
create unique index if not exists rallora_seasons_id_club_unique
  on public.seasons(id, club_id);

create table if not exists public.rallora_league_entry_rules (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  season_id uuid not null,
  created_by uuid not null,
  status text not null default 'draft'
    check(status in ('draft','published','closed','cancelled')),
  currency text not null default 'GBP'
    check(currency in ('GBP','EUR','USD')),
  entry_unit text not null default 'team'
    check(entry_unit in ('team','player')),
  fee_pence bigint not null default 0
    check(fee_pence between 0 and 100000000),
  players_per_team smallint not null default 2
    check(players_per_team between 1 and 8),
  pot_mode text not null default 'no_prize'
    check(pot_mode in ('no_prize','entry_percentage','guaranteed')),
  prize_share_percent smallint not null default 0
    check(prize_share_percent between 0 and 100),
  guaranteed_pence bigint not null default 0
    check(guaranteed_pence between 0 and 100000000),
  promised_sponsor_pence bigint not null default 0
    check(promised_sponsor_pence between 0 and 100000000),
  winner_percent smallint not null default 60
    check(winner_percent between 0 and 100),
  runner_up_percent smallint not null default 30
    check(runner_up_percent between 0 and 100),
  entry_terms text not null default '',
  refund_terms text not null default '',
  prize_terms text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id),
  unique(id,club_id,season_id),
  constraint paid_entry_rules_season_club
    foreign key(season_id,club_id) references public.seasons(id,club_id),
  constraint paid_entry_winner_split
    check(winner_percent + runner_up_percent <= 100),
  constraint paid_entry_published_disclosure
    check(status = 'draft' or
      (char_length(btrim(entry_terms)) >= 20
        and char_length(btrim(refund_terms)) >= 20
        and char_length(btrim(prize_terms)) >= 20))
);

-- A registration is not a payment receipt. Only a reviewed worker can write.
-- Never infer 'paid' merely because a team has joined a season.
create table if not exists public.rallora_league_paid_registrations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  season_id uuid not null,
  rules_id uuid not null,
  team_id uuid not null references public.teams(id),
  entry_unit text not null check(entry_unit in ('team','player')),
  currency text not null check(currency in ('GBP','EUR','USD')),
  fee_snapshot_pence bigint not null check(fee_snapshot_pence between 0 and 100000000),
  status text not null default 'awaiting_payment'
    check(status in ('awaiting_payment','paid','withdrawn','refunded','disputed','cancelled')),
  created_at timestamptz not null default now(),
  unique(season_id,team_id),
  unique(id,club_id,season_id),
  constraint paid_registrations_rules_scope foreign key(rules_id,club_id,season_id)
    references public.rallora_league_entry_rules(id,club_id,season_id),
  constraint paid_registrations_season_scope foreign key(season_id,club_id)
    references public.seasons(id,club_id)
);

-- Receipt/refund/dispute events are an append-only financial audit log, never
-- a player-writeable payment status or a club-editable balance.
create table if not exists public.rallora_league_payment_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  season_id uuid not null,
  registration_id uuid not null,
  event_type text not null
    check(event_type in ('captured','refunded','part_refunded','disputed','dispute_reversed')),
  amount_pence bigint not null check(amount_pence between 1 and 100000000),
  currency text not null check(currency in ('GBP','EUR','USD')),
  provider text not null,
  provider_event_id text not null,
  created_at timestamptz not null default now(),
  unique(provider,provider_event_id),
  constraint league_payment_registration_scope
    foreign key(registration_id,club_id,season_id)
    references public.rallora_league_paid_registrations(id,club_id,season_id)
);

-- Award proposals are not authorisation for a payout. A reviewed server-side
-- process must reconcile captured-minus-refunded/disputed amounts before any
-- external transfer, and persist disbursement receipts separately.
create table if not exists public.rallora_league_prize_awards (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  season_id uuid not null,
  rules_id uuid not null,
  team_id uuid not null references public.teams(id),
  prize_place text not null check(prize_place in ('winner','runner_up','remaining')),
  currency text not null check(currency in ('GBP','EUR','USD')),
  planned_amount_pence bigint not null check(planned_amount_pence between 0 and 100000000),
  status text not null default 'proposed'
    check(status in ('proposed','approved','paid','cancelled')),
  created_at timestamptz not null default now(),
  unique(season_id,prize_place),
  constraint league_prize_awards_rules_scope foreign key(rules_id,club_id,season_id)
    references public.rallora_league_entry_rules(id,club_id,season_id)
);

create or replace function public.rallora_league_check_team_season()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.teams t
      join public.divisions d on d.id=t.division_id
      join public.seasons s on s.id=d.season_id
      where t.id=new.team_id and s.id=new.season_id
        and s.club_id=new.club_id
  ) then
    raise exception 'Team does not belong to season and club'
      using errcode = '23514';
  end if;
  return new;
end
$$;
revoke all on function public.rallora_league_check_team_season()
  from public, anon, authenticated;

create trigger paid_registration_team_scope
  before insert or update of team_id,season_id,club_id
  on public.rallora_league_paid_registrations
  for each row execute function public.rallora_league_check_team_season();
create trigger prize_award_team_scope
  before insert or update of team_id,season_id,club_id
  on public.rallora_league_prize_awards
  for each row execute function public.rallora_league_check_team_season();

create index if not exists league_paid_registrations_club_season
  on public.rallora_league_paid_registrations(club_id,season_id,status);
create index if not exists league_payment_events_season
  on public.rallora_league_payment_events(club_id,season_id,created_at);

alter table public.rallora_league_entry_rules enable row level security;
alter table public.rallora_league_paid_registrations enable row level security;
alter table public.rallora_league_payment_events enable row level security;
alter table public.rallora_league_prize_awards enable row level security;

revoke all on public.rallora_league_entry_rules,
  public.rallora_league_paid_registrations,public.rallora_league_payment_events,
  public.rallora_league_prize_awards from public,anon,authenticated;

-- Authenticated club managers may design a season draft; neither the
-- browser nor an unapproved organiser may publish payment terms.
grant select,insert,delete on public.rallora_league_entry_rules to authenticated;
grant update(currency,entry_unit,fee_pence,players_per_team,pot_mode,
  prize_share_percent,guaranteed_pence,promised_sponsor_pence,
  winner_percent,runner_up_percent,entry_terms,refund_terms,prize_terms,
  updated_at) on public.rallora_league_entry_rules to authenticated;

create policy entry_rules_manager_read on public.rallora_league_entry_rules
  for select to authenticated
  using (public.rallora_can_manage_club(club_id));
create policy entry_rules_create_draft on public.rallora_league_entry_rules
  for insert to authenticated
  with check (
    status='draft'
    and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id)
  );
create policy entry_rules_edit_own_draft on public.rallora_league_entry_rules
  for update to authenticated
  using (status='draft' and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id))
  with check (status='draft' and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id));
create policy entry_rules_delete_own_draft on public.rallora_league_entry_rules
  for delete to authenticated
  using (status='draft' and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id));

-- Financial records are server-owned (even for platform administrators).
grant select on public.rallora_league_paid_registrations,
  public.rallora_league_payment_events,public.rallora_league_prize_awards
  to authenticated;
create policy entry_registrations_manager_read
  on public.rallora_league_paid_registrations for select to authenticated
  using (public.rallora_can_manage_club(club_id));
create policy entry_events_manager_read
  on public.rallora_league_payment_events for select to authenticated
  using (public.rallora_can_manage_club(club_id));
create policy entry_awards_manager_read
  on public.rallora_league_prize_awards for select to authenticated
  using (public.rallora_can_manage_club(club_id));

commit;
