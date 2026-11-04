-- Recovered from the production migration ledger; already applied.
drop policy if exists tenant_seasons_published on public.seasons;
create policy tenant_seasons_published on public.seasons for select using (
  (status = any (array['active'::text, 'completed'::text]) or (status = 'draft'::text and registration_published = true))
  and exists (select 1 from public.clubs c where c.id = seasons.club_id and c.is_active)
);
