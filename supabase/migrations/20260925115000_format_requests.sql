create table if not exists public.rallora_format_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  format_name text not null check (char_length(format_name) between 2 and 120),
  description text not null check (char_length(description) between 10 and 5000),
  team_structure text,
  group_structure text,
  match_structure text,
  scheduling_rules text,
  scoring_rules text,
  promotion_relegation_rules text,
  special_rules text,
  reference_link text,
  status text not null default 'new' check (status in ('new','reviewing','building','testing','available','declined')),
  implemented_format_key text,
  platform_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rallora_format_requests_club_id_idx
  on public.rallora_format_requests(club_id);
create index if not exists rallora_format_requests_status_idx
  on public.rallora_format_requests(status, created_at desc);

alter table public.rallora_format_requests enable row level security;

grant select, insert, update on public.rallora_format_requests to authenticated;

drop policy if exists "Club managers can view own format requests" on public.rallora_format_requests;
create policy "Club managers can view own format requests"
on public.rallora_format_requests for select
to authenticated
using (
  exists (
    select 1 from public.rallora_club_memberships m
    where m.club_id = rallora_format_requests.club_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner','admin','organiser')
  )
  or exists (
    select 1 from public.rallora_platform_admins p
    where p.user_id = (select auth.uid())
  )
);

drop policy if exists "Club managers can submit own format requests" on public.rallora_format_requests;
create policy "Club managers can submit own format requests"
on public.rallora_format_requests for insert
to authenticated
with check (
  requested_by = (select auth.uid())
  and exists (
    select 1 from public.rallora_club_memberships m
    where m.club_id = rallora_format_requests.club_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner','admin','organiser')
  )
);

drop policy if exists "Platform admins can update format requests" on public.rallora_format_requests;
create policy "Platform admins can update format requests"
on public.rallora_format_requests for update
to authenticated
using (
  exists (
    select 1 from public.rallora_platform_admins p
    where p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.rallora_platform_admins p
    where p.user_id = (select auth.uid())
  )
);
