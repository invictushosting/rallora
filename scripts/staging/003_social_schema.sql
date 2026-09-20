-- RALLORA SOCIAL: STAGING-ONLY SCHEMA DRAFT.
-- NOT in supabase/migrations. Never run on the live Rallora DB until a full
-- recoverable backup, isolated staging, tenant UAT and explicit go-live approval.
-- No tokens, phone numbers, email lists or private recipient content in this schema.
begin;

create table if not exists public.rallora_social_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  created_by uuid not null,
  kind text not null default 'news'
    check (kind in ('news','result','roundup','fixture','announcement')),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  body text not null check (char_length(btrim(body)) between 1 and 3500),
  source_fixture_id uuid references public.fixtures(id),
  status text not null default 'draft'
    check (status in ('draft','awaiting_approval','scheduled','publishing',
       'published','failed','archived')),
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, club_id),
  constraint social_schedule_requires_date check
    (status not in ('scheduled','publishing') or scheduled_for is not null)
);

create table if not exists public.rallora_social_post_targets (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  post_id uuid not null,
  channel text not null
    check (channel in ('facebook','instagram','whatsapp','email','website')),
  caption text not null check (char_length(caption) between 1 and 5000),
  status text not null default 'draft'
    check (status in ('draft','ready','queued','sent','failed','cancelled')),
  created_at timestamptz not null default now(),
  unique(id, club_id),
  constraint social_post_target_club_fk foreign key(post_id, club_id)
    references public.rallora_social_posts(id,club_id) on delete cascade
);

-- Public metadata only. No access tokens or recipient details stored here.
-- Service-side OAuth/secrets need a separate private vault and explicit review.
create table if not exists public.rallora_social_connections (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  channel text not null
    check (channel in ('facebook','instagram','whatsapp','email')),
  external_account_id text not null check (char_length(external_account_id) between 1 and 255),
  account_label text not null check (char_length(account_label) between 1 and 255),
  status text not null default 'pending'
    check (status in ('pending','connected','expired','revoked','error')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(club_id, channel, external_account_id)
);

-- Delivery jobs must be created/claimed by audited backend workers only.
-- No member INSERT/UPDATE/DELETE grant or RLS write policy, even for platform admins.
create table if not exists public.rallora_social_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  post_id uuid not null,
  target_id uuid not null,
  idempotency_key text not null unique,
  status text not null default 'queued'
    check (status in ('queued','processing','sent','failed','cancelled')),
  attempts integer not null default 0 check(attempts between 0 and 15),
  run_after timestamptz not null default now(),
  external_post_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  constraint social_delivery_post_club_fk foreign key(post_id,club_id)
    references public.rallora_social_posts(id,club_id),
  constraint social_delivery_target_club_fk foreign key(target_id,club_id)
    references public.rallora_social_post_targets(id,club_id)
);

create index if not exists rallora_social_posts_club_idx
  on public.rallora_social_posts(club_id, created_at desc);
create index if not exists rallora_social_targets_post_idx
  on public.rallora_social_post_targets(post_id);
create index if not exists rallora_social_jobs_due_idx
  on public.rallora_social_delivery_jobs(status,run_after)
  where status in ('queued','failed');

-- Never allow a foreign-club fixture, or an unconfirmed score, to be used as
-- the source for an "official result" social post.
create or replace function public.rallora_social_fixture_is_confirmed(
  p_club uuid, p_fixture uuid
) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_fixture is null or exists (
    select 1 from public.fixtures f
    join public.seasons s on s.id = f.season_id
    join public.results r on r.fixture_id = f.id
    where f.id = p_fixture and s.club_id = p_club
      and s.status in ('active','completed')
      and (f.available_from is null or f.available_from <= current_date)
      and r.status in ('confirmed','admin_override')
  );
$$;

revoke all on function public.rallora_social_fixture_is_confirmed(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.rallora_social_fixture_is_confirmed(uuid,uuid)
  to authenticated;

alter table public.rallora_social_posts enable row level security;
alter table public.rallora_social_post_targets enable row level security;
alter table public.rallora_social_connections enable row level security;
alter table public.rallora_social_delivery_jobs enable row level security;

revoke all on public.rallora_social_posts,public.rallora_social_post_targets,
  public.rallora_social_connections,public.rallora_social_delivery_jobs
  from public,anon,authenticated;

grant select,insert,update,delete on
  public.rallora_social_posts,public.rallora_social_post_targets
  to authenticated;
grant select on
  public.rallora_social_connections,public.rallora_social_delivery_jobs
  to authenticated;

create policy social_posts_read on public.rallora_social_posts
  for select to authenticated
  using (public.rallora_can_manage_club(club_id));

create policy social_posts_create_draft on public.rallora_social_posts
  for insert to authenticated
  with check (
    public.rallora_can_manage_club(club_id)
    and created_by = (select auth.uid())
    and status = 'draft' and scheduled_for is null
    and public.rallora_social_fixture_is_confirmed(club_id,source_fixture_id)
  );

create policy social_posts_edit_draft on public.rallora_social_posts
  for update to authenticated
  using (status = 'draft' and public.rallora_can_manage_club(club_id))
  with check (
    status = 'draft' and scheduled_for is null
    and public.rallora_can_manage_club(club_id)
    and created_by = (select auth.uid())
    and public.rallora_social_fixture_is_confirmed(club_id,source_fixture_id)
  );

create policy social_posts_delete_draft on public.rallora_social_posts
  for delete to authenticated
  using (status = 'draft' and public.rallora_can_manage_club(club_id));

create policy social_targets_read on public.rallora_social_post_targets
  for select to authenticated
  using (public.rallora_can_manage_club(club_id));

create policy social_targets_create_draft on public.rallora_social_post_targets
  for insert to authenticated
  with check (
    status = 'draft' and public.rallora_can_manage_club(club_id)
    and exists (select 1 from public.rallora_social_posts p
      where p.id = post_id and p.club_id = club_id and p.status = 'draft')
  );

create policy social_targets_edit_draft on public.rallora_social_post_targets
  for update to authenticated
  using (status = 'draft' and public.rallora_can_manage_club(club_id)
    and exists (select 1 from public.rallora_social_posts p
      where p.id = post_id and p.club_id = club_id and p.status = 'draft'))
  with check (status = 'draft' and public.rallora_can_manage_club(club_id)
    and exists (select 1 from public.rallora_social_posts p
      where p.id = post_id and p.club_id = club_id and p.status = 'draft'));

create policy social_targets_delete_draft on public.rallora_social_post_targets
  for delete to authenticated
  using (status = 'draft' and public.rallora_can_manage_club(club_id)
    and exists (select 1 from public.rallora_social_posts p
      where p.id = post_id and p.club_id = club_id and p.status = 'draft'));

create policy social_connections_read on public.rallora_social_connections
  for select to authenticated using (public.rallora_can_manage_club(club_id));

create policy social_delivery_read on public.rallora_social_delivery_jobs
  for select to authenticated using (public.rallora_can_manage_club(club_id));

commit;
