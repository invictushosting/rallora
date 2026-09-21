begin;
create table public.rallora_club_applications (
 id uuid primary key default gen_random_uuid(), applicant_user_id uuid not null references auth.users(id) on delete cascade,
 club_name text not null check(char_length(trim(club_name)) between 2 and 120), requested_slug text not null unique check(requested_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 contact_email text not null, plan_code text not null default 'starter', status text not null default 'pending' check(status in ('pending','approved','declined','activated')),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.rallora_club_feature_entitlements (
 club_id uuid not null references public.clubs(id) on delete cascade, feature_key text not null,
 is_enabled boolean not null default true, enabled_by uuid references auth.users(id), updated_at timestamptz not null default now(),
 primary key(club_id,feature_key)
);
alter table public.rallora_club_applications enable row level security;
alter table public.rallora_club_feature_entitlements enable row level security;
revoke all on public.rallora_club_applications, public.rallora_club_feature_entitlements from public, anon;
grant select,insert on public.rallora_club_applications to authenticated;
grant select on public.rallora_club_feature_entitlements to authenticated;
create policy "club_application_self_read" on public.rallora_club_applications for select to authenticated using(applicant_user_id=(select auth.uid()));
create policy "club_application_platform_read" on public.rallora_club_applications for select to authenticated using(public.rallora_is_platform_admin());
create policy "club_application_submit" on public.rallora_club_applications for insert to authenticated with check(applicant_user_id=(select auth.uid()) and status='pending' and reviewed_by is null and reviewed_at is null);
create policy "club_entitlement_manager_read" on public.rallora_club_feature_entitlements for select to authenticated using(public.rallora_can_manage_club(club_id));
create or replace function public.rallora_approve_club_application(p_application_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare application public.rallora_club_applications%rowtype; new_club_id uuid;
begin
 if not public.rallora_is_platform_admin() then raise exception 'Not authorised'; end if;
 select * into application from public.rallora_club_applications where id=p_application_id and status='pending' for update;
 if not found then raise exception 'Application is not pending'; end if;
 insert into public.clubs(slug,name,short_name,contact_email,is_active)
 values(application.requested_slug,application.club_name,left(application.club_name,24),application.contact_email,true) returning id into new_club_id;
 insert into public.rallora_club_memberships(club_id,user_id,role,status)
 values(new_club_id,application.applicant_user_id,'owner','active');
 insert into public.rallora_club_feature_entitlements(club_id,feature_key,enabled_by)
 select new_club_id, feature_key, auth.uid() from unnest(case application.plan_code
   when 'pro' then array['core_league','player_registration','captain_results','social_studio','sponsors','reminders']
   when 'league' then array['core_league','player_registration','captain_results','social_studio']
   else array['core_league','player_registration'] end) feature_key;
 update public.rallora_club_applications set status='activated',reviewed_by=auth.uid(),reviewed_at=now() where id=application.id;
 return new_club_id;
end; $$;
revoke all on function public.rallora_approve_club_application(uuid) from public,anon;
grant execute on function public.rallora_approve_club_application(uuid) to authenticated;
commit;
