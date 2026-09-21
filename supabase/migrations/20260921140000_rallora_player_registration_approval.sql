-- Authenticated player registration with organiser approval.
-- Player contact details are private; organisers receive only the snapshot supplied
-- with a request for their own club. Approval atomically creates a roster entry.

begin;

create table if not exists public.rallora_player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  phone text check (phone is null or char_length(trim(phone)) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rallora_team_registration_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_user_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null check (char_length(trim(player_name)) between 2 and 120),
  player_phone text check (player_phone is null or char_length(trim(player_phone)) <= 40),
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn')),
  organiser_note text check (organiser_note is null or char_length(organiser_note) <= 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rallora_team_roster_memberships (
  id uuid primary key default gen_random_uuid(),
  registration_request_id uuid not null unique references public.rallora_team_registration_requests(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'player' check (role in ('player','captain')),
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, player_user_id)
);

create index if not exists rallora_registration_requests_player_idx
  on public.rallora_team_registration_requests (player_user_id, created_at desc);
create index if not exists rallora_registration_requests_club_status_idx
  on public.rallora_team_registration_requests (club_id, status, created_at desc);
create index if not exists rallora_roster_player_idx
  on public.rallora_team_roster_memberships (player_user_id);
create index if not exists rallora_roster_club_idx
  on public.rallora_team_roster_memberships (club_id, team_id);
create unique index if not exists rallora_registration_one_pending_team_idx
  on public.rallora_team_registration_requests (team_id, player_user_id) where status = 'pending';

alter table public.rallora_player_profiles enable row level security;
alter table public.rallora_team_registration_requests enable row level security;
alter table public.rallora_team_roster_memberships enable row level security;
revoke all on public.rallora_player_profiles, public.rallora_team_registration_requests,
  public.rallora_team_roster_memberships from public, anon;
grant select, insert, update on public.rallora_player_profiles to authenticated;
grant select, insert, update on public.rallora_team_registration_requests to authenticated;
grant select on public.rallora_team_roster_memberships to authenticated;

create policy "player_profile_self" on public.rallora_player_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "registration_request_player_read" on public.rallora_team_registration_requests for select to authenticated
  using (player_user_id = (select auth.uid()));
create policy "registration_request_organiser_read" on public.rallora_team_registration_requests for select to authenticated
  using (public.rallora_can_manage_club(club_id));
create policy "registration_request_player_insert" on public.rallora_team_registration_requests for insert to authenticated
  with check (
    player_user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null
    and exists (select 1 from public.teams t join public.divisions d on d.id = t.division_id
      join public.seasons s on s.id = d.season_id
      join public.clubs c on c.id = s.club_id
      where t.id = public.rallora_team_registration_requests.team_id
        and d.id = public.rallora_team_registration_requests.division_id
        and s.id = public.rallora_team_registration_requests.season_id
        and c.id = public.rallora_team_registration_requests.club_id
        and c.is_active and s.status = 'active')
  );
create policy "registration_request_player_withdraw" on public.rallora_team_registration_requests for update to authenticated
  using (player_user_id = (select auth.uid()) and status = 'pending')
  with check (player_user_id = (select auth.uid()) and status = 'withdrawn'
    and reviewed_by is null and reviewed_at is null);
create policy "registration_request_organiser_review" on public.rallora_team_registration_requests for update to authenticated
  using (public.rallora_can_manage_club(club_id) and status = 'pending')
  with check (public.rallora_can_manage_club(club_id) and status in ('approved','declined')
    and reviewed_by = (select auth.uid()) and reviewed_at is not null);

create policy "roster_member_read" on public.rallora_team_roster_memberships for select to authenticated
  using (player_user_id = (select auth.uid()));
create policy "roster_organiser_read" on public.rallora_team_roster_memberships for select to authenticated
  using (public.rallora_can_manage_club(club_id));

create or replace function public.rallora_add_approved_player_to_roster()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.rallora_team_roster_memberships
      (registration_request_id, club_id, season_id, division_id, team_id, player_user_id, approved_by)
    values (new.id, new.club_id, new.season_id, new.division_id, new.team_id, new.player_user_id, new.reviewed_by)
    on conflict (team_id, player_user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.rallora_add_approved_player_to_roster() from public, anon, authenticated;
drop trigger if exists rallora_add_approved_player_to_roster on public.rallora_team_registration_requests;
create trigger rallora_add_approved_player_to_roster
  after update of status on public.rallora_team_registration_requests
  for each row execute function public.rallora_add_approved_player_to_roster();

commit;
