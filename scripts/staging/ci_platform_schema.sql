-- Synthetic platform onboarding tables required by the launch operations migration.
alter table public.clubs
  add column short_name text,
  add column contact_email text,
  add column updated_at timestamptz not null default now();

create table public.rallora_club_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references auth.users(id),
  club_name text not null,
  requested_slug text not null unique,
  contact_email text not null,
  plan_code text not null default 'starter',
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.rallora_club_feature_entitlements (
  club_id uuid not null references public.clubs(id),
  feature_key text not null,
  is_enabled boolean not null default true,
  enabled_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key(club_id,feature_key)
);
alter table public.rallora_club_applications enable row level security;
alter table public.rallora_club_feature_entitlements enable row level security;
grant select,insert on public.rallora_club_applications to authenticated;
grant select on public.rallora_club_feature_entitlements to authenticated;
