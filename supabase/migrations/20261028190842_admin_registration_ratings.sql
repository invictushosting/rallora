-- Correct league entry ratings without changing the player's external Playtomic profile.
create or replace function public.rallora_admin_update_entry_ratings(
  p_application_id uuid,
  p_captain_rating numeric,
  p_partner_rating numeric,
  p_expected_updated_at timestamptz
) returns boolean
language plpgsql security definer set search_path = '' as $fn$
declare
  a public.rallora_team_applications%rowtype;
  t public.teams%rowtype;
  v_season uuid;
  v_club uuid;
begin
  select season_id,club_id into v_season,v_club
    from public.rallora_team_applications where id=p_application_id;
  if auth.uid() is null or v_club is null or not public.rallora_can_manage_club(v_club) then
    raise exception 'Not authorised';
  end if;
  -- Use the same lock order as application approval.
  perform pg_advisory_xact_lock(hashtextextended(v_season::text,0));
  select * into a from public.rallora_team_applications where id=p_application_id for update;
  if not public.rallora_can_manage_club(a.club_id) then raise exception 'Not authorised'; end if;
  if a.status not in ('pending','approved') then raise exception 'Only pending or approved entries can be edited'; end if;
  if p_expected_updated_at is null or a.updated_at is distinct from p_expected_updated_at then
    raise exception 'This entry has changed. Refresh and try again';
  end if;
  if p_captain_rating is null or p_partner_rating is null
    or p_captain_rating not between 0 and 7 or p_partner_rating not between 0 and 7
    or p_captain_rating <> round(p_captain_rating,2) or p_partner_rating <> round(p_partner_rating,2) then
    raise exception 'Enter both ratings between 0 and 7, with up to two decimal places';
  end if;
  if a.created_team_id is not null then
    select * into t from public.teams where id=a.created_team_id for update;
    if not found or not exists(select 1 from public.divisions d where d.id=t.division_id and d.season_id=a.season_id)
      or t.player_one_name is distinct from a.captain_name or t.player_two_name is distinct from a.partner_name then
      raise exception 'The pairing has changed. Refresh and review its players before editing ratings';
    end if;
    update public.teams set player_one_rating=p_captain_rating,player_two_rating=p_partner_rating,
      player_one_rating_source='manual',player_two_rating_source='manual' where id=t.id;
  end if;
  update public.rallora_team_member_invites set playtomic_rating=p_partner_rating
    where team_application_id=a.id and claimed_by is null;
  update public.rallora_team_applications set
    captain_playtomic_rating=p_captain_rating,partner_playtomic_rating=p_partner_rating,
    organiser_note=right(concat_ws(E'\n',nullif(organiser_note,''),
      format('Ratings corrected by %s at %s: %s / %s -> %s / %s',auth.uid(),now(),
        coalesce(a.captain_playtomic_rating::text,'unset'),coalesce(a.partner_playtomic_rating::text,'unset'),p_captain_rating,p_partner_rating)),1000),
    updated_at=now()
    where id=a.id;
  return true;
end $fn$;
revoke all on function public.rallora_admin_update_entry_ratings(uuid,numeric,numeric,timestamptz) from public,anon;
grant execute on function public.rallora_admin_update_entry_ratings(uuid,numeric,numeric,timestamptz) to authenticated;
