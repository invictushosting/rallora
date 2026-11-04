-- Scores live in results/result_submissions, both checked below, not fixtures.
-- Keep the existing authorisation and draft-only safeguards unchanged.
CREATE OR REPLACE FUNCTION rallora_private.place_draft_boxes(p_season_id uuid, p_seed boolean, p_team_id uuid DEFAULT NULL::uuid, p_division_id uuid DEFAULT NULL::uuid, p_swap_team_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.seasons%rowtype; ids uuid[]; targets uuid[]; boxes uuid[]; original_names text[]; source uuid; n integer; removed integer:=0; i integer;
begin
 select * into s from public.seasons where id=p_season_id for update;
 if auth.uid() is null or not found or not public.rallora_can_manage_club(s.club_id) then raise exception 'Not authorised'; end if;
 if s.status<>'draft' or exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'Box placement is only editable in an unactivated draft'; end if;
 perform id from public.divisions where season_id=s.id order by sort_order,id for update;
 perform t.id from public.teams t join public.divisions d on d.id=t.division_id where d.season_id=s.id order by t.id for update of t;
 if exists(select 1 from public.fixtures f where f.season_id=s.id and f.status is distinct from 'open')
 or exists(select 1 from public.results r join public.fixtures f on f.id=r.fixture_id where f.season_id=s.id)
 or exists(select 1 from public.result_submissions r join public.fixtures f on f.id=r.fixture_id where f.season_id=s.id)
 then raise exception 'This draft has match activity; its divisions cannot be changed'; end if;
 if p_seed then
   if s.previous_season_id is not null then raise exception 'Rating seeding is for the initial cycle only; later cycles use promotion and relegation'; end if;
   select array_agg(id order by sort_order,id) into boxes from public.divisions where season_id=s.id;
   if coalesce(cardinality(boxes),0)=0 or s.teams_per_division is null then raise exception 'Set up boxes and their size first'; end if;
   -- Synced ratings take priority; entered ratings remain explicitly self-reported.
   select array_agg(t.id order by
     coalesce(l1.padel_rating,t.player_one_rating,a.captain_playtomic_rating)+coalesce(l2.padel_rating,t.player_two_rating,a.partner_playtomic_rating) desc nulls last,t.name,t.id)
   into ids from public.teams t join public.divisions d on d.id=t.division_id
   left join public.rallora_team_applications a on a.created_team_id=t.id and a.status='approved'
   left join public.rallora_playtomic_player_links l1 on l1.club_id=s.club_id and l1.user_id=a.requested_by
   left join auth.users u2 on lower(u2.email)=lower(coalesce(t.player_two_email,a.partner_email))
   left join public.rallora_playtomic_player_links l2 on l2.club_id=s.club_id and l2.user_id=u2.id
   where d.season_id=s.id and coalesce(t.is_active,true);
   n:=coalesce(cardinality(ids),0);
   if n=0 then raise exception 'Approve pairings before seeding boxes'; end if;
   if n>cardinality(boxes)*s.teams_per_division then raise exception 'There are more pairings than box places'; end if;
   if exists(select 1 from public.teams t join public.divisions d on d.id=t.division_id
     left join public.rallora_team_applications a on a.created_team_id=t.id and a.status='approved'
     left join public.rallora_playtomic_player_links l1 on l1.club_id=s.club_id and l1.user_id=a.requested_by
     left join auth.users u2 on lower(u2.email)=lower(coalesce(t.player_two_email,a.partner_email))
     left join public.rallora_playtomic_player_links l2 on l2.club_id=s.club_id and l2.user_id=u2.id
     where d.season_id=s.id and coalesce(t.is_active,true) and
      (coalesce(l1.padel_rating,t.player_one_rating,a.captain_playtomic_rating) is null or coalesce(l2.padel_rating,t.player_two_rating,a.partner_playtomic_rating) is null))
   then raise exception 'Both players need a rating before seeding; add missing ratings first'; end if;
   for i in 1..n loop targets:=array_append(targets,boxes[1+(i-1)/s.teams_per_division]); end loop;
 else
   select t.division_id into source from public.teams t join public.divisions d on d.id=t.division_id where t.id=p_team_id and d.season_id=s.id and coalesce(t.is_active,true);
   if source is null or source=p_division_id or not exists(select 1 from public.divisions where id=p_division_id and season_id=s.id) then raise exception 'Choose a different box in this competition'; end if;
   ids:=array[p_team_id]; targets:=array[p_division_id];
   if p_swap_team_id is not null then
     if not exists(select 1 from public.teams where id=p_swap_team_id and division_id=p_division_id and coalesce(is_active,true)) then raise exception 'Choose a pairing from the destination box to swap'; end if;
     ids:=array_append(ids,p_swap_team_id);targets:=array_append(targets,source);
   elsif (select count(*) from public.teams where division_id=p_division_id and coalesce(is_active,true))>=coalesce(s.teams_per_division,100) then raise exception 'Destination box is full; choose a pairing to swap'; end if;
 end if;
 -- Only untouched draft fixtures are discarded. The organiser regenerates after final placement.
 delete from public.fixtures where season_id=s.id; get diagnostics removed=row_count;
 select array_agg(t.name order by v.ordinality) into original_names from unnest(ids) with ordinality v(id,ordinality) join public.teams t on t.id=v.id;
 -- Temporarily unique references avoid name collisions when swapping identical pairing references.
 for i in 1..cardinality(ids) loop
   update public.teams set name='placement-'||id::text where id=ids[i];
 end loop;
 for i in 1..cardinality(ids) loop
   update public.teams set division_id=targets[i] where id=ids[i];
   update public.rallora_team_registration_requests set division_id=targets[i] where team_id=ids[i] and season_id=s.id;
   update public.rallora_team_roster_memberships set division_id=targets[i] where team_id=ids[i] and season_id=s.id;
   update public.rallora_team_member_invites set division_id=targets[i] where team_id=ids[i] and season_id=s.id;
   update public.rallora_team_applications set division_id=targets[i] where created_team_id=ids[i] and season_id=s.id;
 end loop;
 for i in 1..cardinality(ids) loop
   update public.teams set name=case when exists(select 1 from public.teams other where other.division_id=targets[i] and other.id<>ids[i] and other.name=original_names[i]) then left(original_names[i],60)||' · '||ids[i]::text else original_names[i] end where id=ids[i];
 end loop;
 perform public.recalculate_standings_for_season(s.id);
 return jsonb_build_object('pairings',cardinality(ids),'fixtures_cleared',removed);
end $function$;
