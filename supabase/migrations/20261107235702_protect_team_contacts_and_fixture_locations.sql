-- Phase 1: additive admin contact reader. Apply before the compatible frontend.
begin;

-- Only an active manager of this season (or a platform administrator) may obtain
-- the contact-bearing team rows. Never trust a club ID supplied by the browser.
create function public.rallora_admin_season_teams(p_season_id uuid)
returns setof public.teams
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.rallora_can_manage_season(p_season_id),false) then
  raise exception 'Club administrator access required' using errcode='42501';
 end if;
 return query select t.* from public.teams t join public.divisions d on d.id=t.division_id
 where d.season_id=p_season_id;
end $$;
revoke all on function public.rallora_admin_season_teams(uuid) from public,anon,authenticated;
grant execute on function public.rallora_admin_season_teams(uuid) to authenticated;

comment on function public.rallora_admin_season_teams(uuid) is
 'Contact-bearing team rows scoped to the authenticated active season manager. Public team reads use explicit non-contact columns.';
notify pgrst,'reload schema';
commit;
