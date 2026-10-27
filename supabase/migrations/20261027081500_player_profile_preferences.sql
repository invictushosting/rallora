begin;
-- Player preferences are private to their owner under the existing profile RLS.
-- Never expose these fields via a public player directory without opt-in.
alter table public.rallora_player_profiles
  add column if not exists playing_level text,
  add column if not exists home_town text,
  add column if not exists preferred_club_ids uuid[] not null default '{}'::uuid[],
  add column if not exists partner_preference text;

alter table public.rallora_player_profiles
  add constraint rallora_player_profiles_playing_level_check
  check (playing_level is null or playing_level in ('beginner','improver','intermediate','advanced','competitive')),
  add constraint rallora_player_profiles_home_town_check
  check (home_town is null or char_length(trim(home_town)) between 2 and 120),
  add constraint rallora_player_profiles_partner_preference_check
  check (partner_preference is null or partner_preference in ('open','looking','have_partner','not_looking')),
  add constraint rallora_player_profiles_preferred_clubs_limit_check
  check (coalesce(array_length(preferred_club_ids,1),0) <= 10);

comment on column public.rallora_player_profiles.home_town is 'Broad town or city only, not a full street address. Private by default.';
comment on column public.rallora_player_profiles.preferred_club_ids is 'Up to ten clubs selected for discovery preferences. Private by default.';
comment on column public.rallora_player_profiles.partner_preference is 'Player preference only; does not publish a matchmaking profile.';
commit;