-- No destructive schema change required.
-- Sponsor placement now supports multiple comma-separated placements in public.sponsors.placement.
-- Examples: homepage,cup,league,division-1
alter table public.sponsors add column if not exists placement text;
