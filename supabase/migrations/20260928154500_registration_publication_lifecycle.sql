alter table public.seasons add column if not exists registration_published boolean not null default false;

comment on column public.seasons.registration_published is 'When true, a draft competition may be shown publicly for player registration without publishing divisions or fixtures.';
