-- GSM Padel League Hub: fixture pack / monthly fixture support
-- Adds optional grouping columns to fixtures so a fixture can be part of:
-- weekly rounds, monthly fixture packs, or custom fixture packs.

alter table public.fixtures
  add column if not exists fixture_group_type text not null default 'weekly';

alter table public.fixtures
  add column if not exists fixture_group_name text;

alter table public.fixtures
  add column if not exists available_from date;

alter table public.fixtures
  add column if not exists fixtures_per_team int;

update public.fixtures
set fixture_group_type = coalesce(fixture_group_type, 'weekly'),
    fixture_group_name = coalesce(fixture_group_name, 'Week ' || week_number::text)
where fixture_group_name is null;

create index if not exists fixtures_group_lookup_idx
on public.fixtures (season_id, division_id, fixture_group_type, fixture_group_name, week_number, play_by);

comment on column public.fixtures.fixture_group_type is 'weekly, monthly, or custom';
comment on column public.fixtures.fixture_group_name is 'Display name such as Week 1, June Fixture Pack, or Corporate League Pack 1';
comment on column public.fixtures.available_from is 'Optional date when a fixture pack becomes available to players';
comment on column public.fixtures.fixtures_per_team is 'For monthly/custom packs, how many fixtures each team should play in the pack';

notify pgrst, 'reload schema';
