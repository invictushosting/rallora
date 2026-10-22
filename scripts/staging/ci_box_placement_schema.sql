-- Production-shaped fields missing from the deliberately small CI schema.
alter table public.teams add column if not exists player_one_email text, add column if not exists player_two_email text, add column if not exists captain_email text,
 add column if not exists player_one_rating numeric, add column if not exists player_two_rating numeric;
-- Match production: scores belong to results and result_submissions, not fixtures.
create table public.rallora_playtomic_player_links(club_id uuid,user_id uuid,padel_rating numeric,unique(club_id,user_id));
