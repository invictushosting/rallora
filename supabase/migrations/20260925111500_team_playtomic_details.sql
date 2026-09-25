alter table public.teams
  add column if not exists player_one_email text,
  add column if not exists player_two_email text,
  add column if not exists player_one_rating numeric(4,2),
  add column if not exists player_two_rating numeric(4,2),
  add column if not exists player_one_rating_source text not null default 'manual',
  add column if not exists player_two_rating_source text not null default 'manual';

alter table public.teams drop constraint if exists teams_player_one_rating_source_check;
alter table public.teams add constraint teams_player_one_rating_source_check
check (player_one_rating_source in ('manual','playtomic'));

alter table public.teams drop constraint if exists teams_player_two_rating_source_check;
alter table public.teams add constraint teams_player_two_rating_source_check
check (player_two_rating_source in ('manual','playtomic'));

alter table public.teams drop constraint if exists teams_player_one_rating_check;
alter table public.teams add constraint teams_player_one_rating_check
check (player_one_rating is null or (player_one_rating >= 0 and player_one_rating <= 7));

alter table public.teams drop constraint if exists teams_player_two_rating_check;
alter table public.teams add constraint teams_player_two_rating_check
check (player_two_rating is null or (player_two_rating >= 0 and player_two_rating <= 7));
