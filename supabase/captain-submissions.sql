-- GSM Padel League Hub: captain login + result submissions
-- Run this once in Supabase SQL Editor after applying the captain update.

create table if not exists public.captain_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  team_id uuid not null references public.teams(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.result_submissions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  submitting_team_id uuid not null references public.teams(id) on delete cascade,
  submitted_by_email text,
  home_score text,
  away_score text,
  winner_team_id uuid references public.teams(id),
  notes text,
  status text not null default 'pending_opponent' check (
    status in (
      'pending_opponent',
      'confirmed_by_opponent',
      'disputed',
      'admin_approved',
      'admin_rejected'
    )
  ),
  opponent_confirmed_by_email text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(fixture_id, submitting_team_id)
);

alter table public.captain_users enable row level security;
alter table public.result_submissions enable row level security;

create or replace function public.current_captain_team_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id
  from public.captain_users
  where lower(email) = lower(auth.jwt() ->> 'email')
  limit 1;
$$;

create or replace function public.is_captain_for_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.captain_users
    where lower(email) = lower(auth.jwt() ->> 'email')
      and team_id = p_team_id
  );
$$;

create or replace function public.captain_can_access_fixture(p_fixture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fixtures f
    join public.captain_users c
      on c.team_id = f.home_team_id or c.team_id = f.away_team_id
    where f.id = p_fixture_id
      and lower(c.email) = lower(auth.jwt() ->> 'email')
  );
$$;

create or replace function public.captain_can_submit_for_fixture(
  p_fixture_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fixtures f
    join public.captain_users c on c.team_id = p_team_id
    where f.id = p_fixture_id
      and (f.home_team_id = p_team_id or f.away_team_id = p_team_id)
      and lower(c.email) = lower(auth.jwt() ->> 'email')
  );
$$;

grant execute on function public.current_captain_team_id() to authenticated;
grant execute on function public.is_captain_for_team(uuid) to authenticated;
grant execute on function public.captain_can_access_fixture(uuid) to authenticated;
grant execute on function public.captain_can_submit_for_fixture(uuid, uuid) to authenticated;

-- Captain user policies

drop policy if exists "Captain can read own record" on public.captain_users;
create policy "Captain can read own record"
on public.captain_users
for select
to authenticated
using (
  lower(email) = lower(auth.jwt() ->> 'email')
  or public.is_admin()
);

drop policy if exists "Admins can insert captain users" on public.captain_users;
create policy "Admins can insert captain users"
on public.captain_users
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update captain users" on public.captain_users;
create policy "Admins can update captain users"
on public.captain_users
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete captain users" on public.captain_users;
create policy "Admins can delete captain users"
on public.captain_users
for delete
to authenticated
using (public.is_admin());

-- Result submission policies

drop policy if exists "Captains and admins can read submissions" on public.result_submissions;
create policy "Captains and admins can read submissions"
on public.result_submissions
for select
to authenticated
using (
  public.is_admin()
  or public.captain_can_access_fixture(fixture_id)
);

drop policy if exists "Captains can insert own submissions" on public.result_submissions;
create policy "Captains can insert own submissions"
on public.result_submissions
for insert
to authenticated
with check (
  public.captain_can_submit_for_fixture(fixture_id, submitting_team_id)
);

drop policy if exists "Captains and admins can update submissions" on public.result_submissions;
create policy "Captains and admins can update submissions"
on public.result_submissions
for update
to authenticated
using (
  public.is_admin()
  or public.captain_can_access_fixture(fixture_id)
)
with check (
  public.is_admin()
  or public.captain_can_access_fixture(fixture_id)
);

drop policy if exists "Captains and admins can delete submissions" on public.result_submissions;
create policy "Captains and admins can delete submissions"
on public.result_submissions
for delete
to authenticated
using (
  public.is_admin()
  or public.is_captain_for_team(submitting_team_id)
);

notify pgrst, 'reload schema';
