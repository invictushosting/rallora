-- Distinguish pair entries, singles seeking a partner, and standby players.
begin;

create table if not exists public.rallora_player_pools (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_type text not null check (pool_type in ('single','standby')),
  player_name text not null check (char_length(trim(player_name)) between 2 and 120),
  email text not null check (char_length(trim(email)) between 3 and 254),
  phone text check (phone is null or char_length(trim(phone)) <= 40),
  playtomic_rating numeric(4,2) check (playtomic_rating is null or playtomic_rating between 0 and 10),
  preferred_level text check (preferred_level is null or char_length(trim(preferred_level)) <= 120),
  availability text check (availability is null or char_length(trim(availability)) <= 500),
  future_leagues boolean not null default false,
  status text not null default 'available' check (status in ('available','matched','invited','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id,user_id,pool_type)
);
alter table public.rallora_player_pools enable row level security;
revoke all on public.rallora_player_pools from public,anon;
grant select,insert,update on public.rallora_player_pools to authenticated;
create policy "player_pool_owner_read" on public.rallora_player_pools for select to authenticated using(user_id=auth.uid());
create policy "player_pool_manager_read" on public.rallora_player_pools for select to authenticated using(public.rallora_can_manage_club(club_id));
create policy "player_pool_owner_insert" on public.rallora_player_pools for insert to authenticated with check(
 user_id=auth.uid() and status='available' and exists(
  select 1 from public.seasons s join public.clubs c on c.id=s.club_id
  where s.id=season_id and c.id=club_id and c.is_active
    and s.registration_published=true
    and (s.registration_opens_at is null or s.registration_opens_at<=now())
    and (s.registration_closes_at is null or s.registration_closes_at>=now())
 )
);
create policy "player_pool_owner_update" on public.rallora_player_pools for update to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid());
commit;