-- Synthetic legacy submission table required before captain workflow migrations.
create table public.result_submissions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  submitting_team_id uuid not null references public.teams(id) on delete cascade,
  submitted_by_email text, home_score text, away_score text,
  winner_team_id uuid references public.teams(id), notes text,
  status text not null default 'pending_opponent',
  opponent_confirmed_by_email text, confirmed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(fixture_id,submitting_team_id)
);
alter table public.result_submissions enable row level security;
grant select,insert,update on public.result_submissions to authenticated;
