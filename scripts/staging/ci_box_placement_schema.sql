-- Production-shaped fields missing from the deliberately small CI schema.
alter table public.teams add column if not exists player_one_email text, add column if not exists player_two_email text, add column if not exists captain_email text,
 add column if not exists player_one_rating numeric, add column if not exists player_two_rating numeric;
alter table public.fixtures add column if not exists home_score text,add column if not exists away_score text;
create table public.rallora_playtomic_player_links(club_id uuid,user_id uuid,padel_rating numeric,unique(club_id,user_id));
