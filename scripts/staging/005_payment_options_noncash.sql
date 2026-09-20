-- RALLORA: payment method selection and non-cash prizes, STAGING ONLY.
-- Applies AFTER synthetic scripts/staging/004_league_entry_prizes.sql.
-- Not approved for production. Does not connect accounts, collect money or pay prizes.
begin;

create table if not exists public.rallora_league_collection_options (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  season_id uuid not null,
  rules_id uuid not null,
  method text not null check (method in (
    'bank_transfer','cash_at_club','stripe_connect','mollie_connect',
    'paypal','revolut_business','adyen')),
  status text not null default 'draft'
    check(status in ('draft','awaiting_approval','approved','disabled')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id,method),
  unique(id,club_id,season_id),
  constraint league_collection_rules_scope
    foreign key(rules_id,club_id,season_id)
    references public.rallora_league_entry_rules(id,club_id,season_id)
);

-- Physical items / memberships / coaching / vouchers are distinct from
-- planned cash awards. No false monetary valuation or promised cash balance.
create table if not exists public.rallora_league_non_cash_prizes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  season_id uuid not null,
  rules_id uuid not null,
  created_by uuid not null,
  title text not null check(char_length(btrim(title)) between 3 and 120),
  description text not null default ''
    check(char_length(description) <= 1500),
  prize_place text not null
    check(prize_place in ('winner','runner_up','remaining','special')),
  status text not null default 'draft'
    check(status in ('draft','published','withdrawn','delivered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,club_id,season_id),
  constraint noncash_prizes_rules_scope
    foreign key(rules_id,club_id,season_id)
    references public.rallora_league_entry_rules(id,club_id,season_id)
);

alter table public.rallora_league_collection_options enable row level security;
alter table public.rallora_league_non_cash_prizes enable row level security;
revoke all on public.rallora_league_collection_options,
  public.rallora_league_non_cash_prizes from public,anon,authenticated;

-- Future staff UI may save drafts only after isolated Supabase staging,
-- recovery checks, approved payment requirements and feature-flag rollout.
grant select,insert,delete on public.rallora_league_collection_options,
  public.rallora_league_non_cash_prizes to authenticated;
grant update(method,updated_at) on
  public.rallora_league_collection_options to authenticated;
grant update(title,description,prize_place,updated_at) on
  public.rallora_league_non_cash_prizes to authenticated;

create policy collection_options_club_read
  on public.rallora_league_collection_options for select
  to authenticated using(public.rallora_can_manage_club(club_id));
create policy collection_options_draft_create
  on public.rallora_league_collection_options for insert
  to authenticated with check(status='draft'
    and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id)
    and exists (select 1 from public.rallora_league_entry_rules r
      where r.id=rules_id and r.club_id=club_id
        and r.season_id=season_id and r.status='draft'));
create policy collection_options_draft_update
  on public.rallora_league_collection_options for update
  to authenticated using(status='draft'
    and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id))
  with check(status='draft'
    and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id)
    and exists (select 1 from public.rallora_league_entry_rules r
      where r.id=rules_id and r.club_id=club_id
        and r.season_id=season_id and r.status='draft'));
create policy collection_options_draft_delete
  on public.rallora_league_collection_options for delete
  to authenticated using(status='draft'
    and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id));

create policy noncash_prizes_club_read
  on public.rallora_league_non_cash_prizes for select
  to authenticated using(public.rallora_can_manage_club(club_id));
create policy noncash_prizes_draft_create
  on public.rallora_league_non_cash_prizes for insert
  to authenticated with check(status='draft'
    and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id)
    and exists (select 1 from public.rallora_league_entry_rules r
      where r.id=rules_id and r.club_id=club_id
        and r.season_id=season_id and r.status='draft'));
create policy noncash_prizes_draft_update
  on public.rallora_league_non_cash_prizes for update
  to authenticated using(status='draft'
    and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id))
  with check(status='draft'
    and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id)
    and exists (select 1 from public.rallora_league_entry_rules r
      where r.id=rules_id and r.club_id=club_id
        and r.season_id=season_id and r.status='draft'));
create policy noncash_prizes_draft_delete
  on public.rallora_league_non_cash_prizes for delete
  to authenticated using(status='draft'
    and created_by=(select auth.uid())
    and public.rallora_can_manage_club(club_id));

commit;
