-- Match production's rating provenance fields and constraints in the small CI schema.
alter table public.teams add column if not exists player_one_rating_source text not null default 'manual' check(player_one_rating_source in ('manual','playtomic')),
 add column if not exists player_two_rating_source text not null default 'manual' check(player_two_rating_source in ('manual','playtomic'));
