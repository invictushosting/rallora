-- Targeted security hardening. Preserve public-event RLS visibility while
-- removing anonymous ability to query arbitrary feature entitlements.
begin;
create or replace function public.rallora_public_club_events_enabled(p_club_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select exists(
    select 1
    from public.rallora_club_feature_entitlements e
    left join public.rallora_club_subscriptions s on s.club_id=e.club_id
    where e.club_id=p_club_id and e.feature_key='club_events' and e.is_enabled
      and coalesce(s.status,'active') in ('trialing','active')
  );
$fn$;
revoke all on function public.rallora_public_club_events_enabled(uuid) from public,anon,authenticated;
grant execute on function public.rallora_public_club_events_enabled(uuid) to anon,authenticated;

-- Keep platform admin behaviour exactly as originally implemented: admins
-- can see published events even without a current entitlement.
alter policy "published_events_public_read" on public.rallora_club_events
  using (
    status in ('published','completed')
    and (public.rallora_public_club_events_enabled(club_id)
         or public.rallora_is_platform_admin())
  );

-- Managers still use the existing entitlement function; only signed-in
-- sessions can invoke it after revoking anonymous access.
revoke execute on function public.rallora_club_feature_enabled(uuid,text) from anon;
revoke execute on function public.rallora_club_feature_enabled(uuid,text) from public;
grant execute on function public.rallora_club_feature_enabled(uuid,text) to authenticated;
commit;
