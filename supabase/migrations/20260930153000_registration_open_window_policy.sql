-- Allow registration submissions immediately after sign-up while email confirmation
-- is handled by the normal Rallora auth lifecycle.
begin;
drop policy if exists "team_application_owner_insert" on public.rallora_team_applications;
create policy "team_application_owner_insert" on public.rallora_team_applications for insert to authenticated with check(
 requested_by=auth.uid() and status='pending' and reviewed_by is null and reviewed_at is null
 and exists(select 1 from public.seasons s join public.clubs c on c.id=s.club_id where s.id=season_id and c.id=club_id and c.is_active
 and s.registration_published=true
 and (s.registration_opens_at is null or s.registration_opens_at<=now())
 and (s.registration_closes_at is null or s.registration_closes_at>=now()))
);
commit;