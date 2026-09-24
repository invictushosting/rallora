-- Added to synthetic CI only, after base fixture and core permission helpers.
-- No production data or credentials, intentionally minimal matching live columns.
alter table public.clubs add column is_active boolean not null default true;
alter table public.seasons add column status text not null default 'active';
alter table public.fixtures add column available_from date;
alter table public.fixtures add column status text not null default 'open';
create table public.results (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null unique references public.fixtures(id),
  home_score text,
  away_score text,
  winner_team_id uuid references public.teams(id),
  notes text,
  status text not null,
  confirmed_at timestamptz
);
alter table public.results enable row level security;

-- A draft season in B must not be anonymously visible.
insert into public.seasons(id,club_id,name,status) values
('00000000-0000-0000-0000-0000000001b3',
 '00000000-0000-0000-0000-0000000000b2','Unpublished B season','draft');

-- Published A fixture/result, unreleased B fixture/result.
update public.fixtures set available_from = current_date + 4
where id='00000000-0000-0000-0000-0000000004b2';
insert into public.results(id,fixture_id,winner_team_id,status) values
('00000000-0000-0000-0000-0000000006a1',
 '00000000-0000-0000-0000-0000000004a1',
 '00000000-0000-0000-0000-0000000003a1','confirmed'),
('00000000-0000-0000-0000-0000000006b1',
 '00000000-0000-0000-0000-0000000004b2',
 '00000000-0000-0000-0000-0000000003b1','confirmed');

grant select on public.clubs, public.seasons, public.divisions,
  public.teams, public.fixtures, public.results to anon,authenticated;
grant insert,update,delete on public.clubs, public.seasons, public.divisions,
  public.teams, public.fixtures, public.results to authenticated;
