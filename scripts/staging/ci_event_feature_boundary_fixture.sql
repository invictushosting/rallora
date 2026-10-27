-- Disposable event-RLS security fixture: invented clubs/users only.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table public.rallora_platform_admins(user_id uuid primary key);
create table public.rallora_club_feature_entitlements(club_id uuid,feature_key text,is_enabled boolean);
create table public.rallora_club_subscriptions(club_id uuid,status text);
create table public.rallora_club_events(id uuid,club_id uuid,status text);
alter table public.rallora_club_events enable row level security;
grant select on public.rallora_club_events to anon,authenticated;
create function public.rallora_is_platform_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.rallora_platform_admins a where a.user_id=auth.uid())
$$;
create function public.rallora_club_feature_enabled(p_club_id uuid,p_feature_key text)
returns boolean language sql stable security definer set search_path='' as $$
 select public.rallora_is_platform_admin() or exists(
 select 1 from public.rallora_club_feature_entitlements e
 left join public.rallora_club_subscriptions s on s.club_id=e.club_id
 where e.club_id=p_club_id and e.feature_key=p_feature_key and e.is_enabled
 and coalesce(s.status,'active') in ('trialing','active'))
$$;
grant execute on function public.rallora_club_feature_enabled(uuid,text) to anon,authenticated;
create policy "published_events_public_read" on public.rallora_club_events for select to anon,authenticated
using(public.rallora_club_feature_enabled(club_id,'club_events') and status in ('published','completed'));
insert into public.rallora_platform_admins values ('00000000-0000-0000-0000-000000000901');
insert into public.rallora_club_feature_entitlements values
('00000000-0000-0000-0000-0000000000a1','club_events',true),
('00000000-0000-0000-0000-0000000000b2','club_events',true),
('00000000-0000-0000-0000-0000000000c3','club_events',false);
insert into public.rallora_club_subscriptions values
('00000000-0000-0000-0000-0000000000a1','active'),
('00000000-0000-0000-0000-0000000000b2','paused'),
('00000000-0000-0000-0000-0000000000c3','active');
insert into public.rallora_club_events values
('00000000-0000-0000-0000-0000000001a1','00000000-0000-0000-0000-0000000000a1','published'),
('00000000-0000-0000-0000-0000000001a2','00000000-0000-0000-0000-0000000000a1','draft'),
('00000000-0000-0000-0000-0000000001b2','00000000-0000-0000-0000-0000000000b2','published'),
('00000000-0000-0000-0000-0000000001c3','00000000-0000-0000-0000-0000000000c3','published');
