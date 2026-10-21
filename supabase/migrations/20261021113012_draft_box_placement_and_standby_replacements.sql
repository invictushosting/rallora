begin;
-- Draft placement is atomic, club-scoped, and cannot rewrite played history.
create function rallora_private.place_draft_boxes(p_season_id uuid,p_seed boolean,p_team_id uuid default null,p_division_id uuid default null,p_swap_team_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.seasons%rowtype; ids uuid[]; targets uuid[]; boxes uuid[]; original_names text[]; source uuid; n integer; removed integer:=0; i integer;
begin
 select * into s from public.seasons where id=p_season_id for update;
 if auth.uid() is null or not found or not public.rallora_can_manage_club(s.club_id) then raise exception 'Not authorised'; end if;
 if s.status<>'draft' or exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'Box placement is only editable in an unactivated draft'; end if;
 perform id from public.divisions where season_id=s.id order by sort_order,id for update;
 perform t.id from public.teams t join public.divisions d on d.id=t.division_id where d.season_id=s.id order by t.id for update of t;
 if exists(select 1 from public.fixtures f where f.season_id=s.id and (f.status<>'open' or f.home_score is not null or f.away_score is not null))
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
end $$;
revoke all on function rallora_private.place_draft_boxes(uuid,boolean,uuid,uuid,uuid) from public,anon;
grant execute on function rallora_private.place_draft_boxes(uuid,boolean,uuid,uuid,uuid) to authenticated;
create function public.rallora_place_draft_boxes(p_season_id uuid,p_seed boolean,p_team_id uuid default null,p_division_id uuid default null,p_swap_team_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select rallora_private.place_draft_boxes(p_season_id,p_seed,p_team_id,p_division_id,p_swap_team_id); $$;
revoke all on function public.rallora_place_draft_boxes(uuid,boolean,uuid,uuid,uuid) from public,anon;
grant execute on function public.rallora_place_draft_boxes(uuid,boolean,uuid,uuid,uuid) to authenticated;

create function rallora_private.replace_from_pool(p_team_id uuid,p_slot integer,p_pool_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare s public.seasons%rowtype; t public.teams%rowtype; p public.rallora_player_pools%rowtype; old_email text; old_user uuid; request_id uuid; member_role text;
begin
 select s1.* into s from public.teams t1 join public.divisions d on d.id=t1.division_id join public.seasons s1 on s1.id=d.season_id where t1.id=p_team_id for update of s1;
 if auth.uid() is null or not found or not public.rallora_can_manage_club(s.club_id) then raise exception 'Not authorised'; end if;
 if s.status not in ('draft','active') or exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'Replacements must be made in the current draft or active cycle'; end if;
 if p_slot is null or p_slot not in(1,2) then raise exception 'Choose player one or two'; end if;
 select * into t from public.teams where id=p_team_id for update;
 select * into p from public.rallora_player_pools where id=p_pool_id and club_id=s.club_id and status='available' for update;
 if not found then raise exception 'Replacement player is no longer available'; end if;
 if not exists(with recursive cycles as(select s.id id,s.previous_season_id previous union all select x.id,x.previous_season_id from public.seasons x join cycles c on x.id=c.previous) select 1 from cycles where id=p.season_id) then raise exception 'Choose a player from this league'; end if;
 if exists(select 1 from public.rallora_team_roster_memberships where season_id=s.id and player_user_id=p.user_id) then raise exception 'This player already has a pairing in this cycle'; end if;
 old_email:=case when p_slot=1 then t.player_one_email else t.player_two_email end;
 if old_email is null then select case when p_slot=1 then u.email else a.partner_email end into old_email from public.rallora_team_applications a join auth.users u on u.id=a.requested_by where a.created_team_id=t.id; end if;
 select id into old_user from auth.users where lower(email)=lower(old_email);
 if old_user is null and p_slot=1 then select requested_by into old_user from public.rallora_team_applications where created_team_id=t.id; end if;
 select role into member_role from public.rallora_team_roster_memberships where team_id=t.id and player_user_id=old_user;
 member_role:=coalesce(member_role,case when p_slot=1 then 'captain' else 'player' end);
 delete from public.rallora_team_roster_memberships where team_id=t.id and player_user_id=old_user;
 update public.rallora_team_registration_requests set status='declined',organiser_note='Replaced by club organiser',updated_at=now() where team_id=t.id and player_user_id=old_user;
 update public.rallora_team_member_invites set status='cancelled' where team_id=t.id and lower(invited_email)=lower(old_email) and status='pending';
 if p_slot=1 then update public.teams set player_one_name=p.player_name,player_one_email=lower(p.email),player_one_rating=p.playtomic_rating,captain_email=case when member_role='captain' then lower(p.email) else captain_email end where id=t.id;
 else update public.teams set player_two_name=p.player_name,player_two_email=lower(p.email),player_two_rating=p.playtomic_rating,captain_email=case when member_role='captain' then lower(p.email) else captain_email end where id=t.id; end if;
 update public.rallora_team_applications set
   requested_by=case when p_slot=1 then p.user_id else requested_by end,
   captain_name=case when p_slot=1 then p.player_name else captain_name end,
   captain_playtomic_rating=case when p_slot=1 then p.playtomic_rating else captain_playtomic_rating end,
   partner_name=case when p_slot=2 then p.player_name else partner_name end,
   partner_email=case when p_slot=2 then lower(p.email) else partner_email end,
   partner_playtomic_rating=case when p_slot=2 then p.playtomic_rating else partner_playtomic_rating end,updated_at=now()
 where created_team_id=t.id and season_id=s.id;
 update public.teams set name=left(concat_ws(' / ',player_one_name,player_two_name),60)||' · '||id::text where id=t.id;
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_by,reviewed_at)
 values(s.club_id,s.id,t.division_id,t.id,p.user_id,p.player_name,'approved',auth.uid(),now()) returning id into request_id;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by)
 values(request_id,s.club_id,s.id,t.division_id,t.id,p.user_id,member_role,auth.uid());
 update public.rallora_player_pools set status='matched',updated_at=now() where id=p.id;
 -- Team ID, division, fixtures and scores deliberately stay attached to the same league place.
end $$;
revoke all on function rallora_private.replace_from_pool(uuid,integer,uuid) from public,anon;
grant execute on function rallora_private.replace_from_pool(uuid,integer,uuid) to authenticated;
create function public.rallora_replace_from_pool(p_team_id uuid,p_slot integer,p_pool_id uuid)
returns void language sql security invoker set search_path='' as $$ select rallora_private.replace_from_pool(p_team_id,p_slot,p_pool_id); $$;
revoke all on function public.rallora_replace_from_pool(uuid,integer,uuid) from public,anon;
grant execute on function public.rallora_replace_from_pool(uuid,integer,uuid) to authenticated;
commit;
