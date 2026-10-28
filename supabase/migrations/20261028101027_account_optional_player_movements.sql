begin;
-- League identities are independent of optional authenticated accounts. Stable
-- roster IDs also let organisers move name-only entries without inventing emails.
alter table public.teams add column player_one_roster_id uuid,add column player_two_roster_id uuid;
update public.teams set player_one_roster_id=case when nullif(trim(player_one_name),'') is not null then gen_random_uuid() end,
 player_two_roster_id=case when nullif(trim(player_two_name),'') is not null then gen_random_uuid() end;
alter table public.rallora_player_pools alter column user_id drop not null,alter column email drop not null,
 add column roster_player_id uuid not null default gen_random_uuid();
update public.rallora_player_pools p set roster_player_id=coalesce((
 select v.roster_id from public.teams t join public.divisions d on d.id=t.division_id
 cross join lateral(values(t.player_one_roster_id,lower(t.player_one_email)),(t.player_two_roster_id,lower(t.player_two_email)))v(roster_id,email)
 where d.season_id=p.season_id and v.roster_id is not null and v.email is not null
 and (v.email=lower(p.email) or v.email=(select lower(email) from auth.users where id=p.user_id))
 order by t.id limit 1),p.roster_player_id);
create unique index rallora_pool_roster_identity on public.rallora_player_pools(season_id,roster_player_id,pool_type);
alter table public.rallora_player_movements add column affected_roster_ids uuid[] not null default '{}';
-- Accountless entries do not have an account to notify. Existing signed-in
-- registration behaviour is unchanged, and owner RLS still requires auth.uid().
drop trigger queue_pool_registration on public.rallora_player_pools;
create trigger queue_pool_registration after insert on public.rallora_player_pools
 for each row when(new.user_id is not null) execute function rallora_private.queue_pool_registration();

create or replace function rallora_private.version_team_roster() returns trigger
language plpgsql set search_path='' as $$
begin
 if nullif(trim(new.player_one_name),'') is null then new.player_one_roster_id:=null;
 else new.player_one_roster_id:=coalesce(new.player_one_roster_id,gen_random_uuid()); end if;
 if nullif(trim(new.player_two_name),'') is null then new.player_two_roster_id:=null;
 else new.player_two_roster_id:=coalesce(new.player_two_roster_id,gen_random_uuid()); end if;
 if tg_op='UPDATE' then
 if row(new.player_one_name,new.player_two_name,new.player_one_email,new.player_two_email,new.player_one_rating,new.player_two_rating,new.player_one_roster_id,new.player_two_roster_id)
 is distinct from row(old.player_one_name,old.player_two_name,old.player_one_email,old.player_two_email,old.player_one_rating,old.player_two_rating,old.player_one_roster_id,old.player_two_roster_id) then
 new.roster_version:=old.roster_version+1; else new.roster_version:=old.roster_version; end if;
 end if;
 return new;
end $$;
create trigger initialise_team_roster before insert on public.teams for each row execute function rallora_private.version_team_roster();

create or replace function rallora_private.roster_slot(p_team uuid,p_slot integer) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('roster_id',case when p_slot=1 then t.player_one_roster_id else t.player_two_roster_id end,'name',case when p_slot=1 then t.player_one_name else t.player_two_name end,
 'email',case when nullif(trim(case when p_slot=1 then t.player_one_name else t.player_two_name end),'') is not null then lower(coalesce(case when p_slot=1 then t.player_one_email else t.player_two_email end,case when p_slot=1 then coalesce(u.email,t.captain_email) else a.partner_email end)) end,
 'rating',case when p_slot=1 then t.player_one_rating else t.player_two_rating end,
 'rating_source',case when p_slot=1 then t.player_one_rating_source else t.player_two_rating_source end)
 from public.teams t left join public.rallora_team_applications a on a.created_team_id=t.id and a.status='approved'
 left join auth.users u on u.id=a.requested_by where t.id=p_team limit 1;
$$;

create or replace function rallora_private.assign_roster_slot(p_team uuid,p_slot integer,p_player jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare t public.teams%rowtype; s public.seasons%rowtype; previous jsonb; uid uuid; old_uid uuid; req uuid; member_role text;
begin
 select * into t from public.teams where id=p_team;
 select x.* into s from public.seasons x join public.divisions d on d.season_id=x.id where d.id=t.division_id;
 previous:=rallora_private.roster_slot(p_team,p_slot);
 select id into old_uid from auth.users where lower(email)=previous->>'email';
 select role into member_role from public.rallora_team_roster_memberships where team_id=t.id and player_user_id=old_uid;
 member_role:=coalesce(member_role,case when lower(t.captain_email)=previous->>'email' or p_slot=1 then 'captain' else 'player' end);
 select id into uid from auth.users where lower(email)=p_player->>'email';
 delete from public.rallora_team_roster_memberships where team_id=t.id and player_user_id=old_uid;
 -- Keep the original registration and invite history; withdraw current access.
 update public.rallora_team_registration_requests set status='withdrawn',organiser_note='Moved by club administrator',updated_at=now()
 where team_id=t.id and player_user_id=old_uid and status in ('approved','pending');
 update public.rallora_team_member_invites set status='cancelled' where team_id=t.id and lower(invited_email)=previous->>'email' and status='pending';
 if p_slot=1 then
 update public.teams set player_one_roster_id=(p_player->>'roster_id')::uuid,player_one_name=p_player->>'name',player_one_email=p_player->>'email',player_one_rating=(p_player->>'rating')::numeric,
 player_one_rating_source=coalesce(p_player->>'rating_source','manual'),captain_email=case when member_role='captain' then p_player->>'email' else captain_email end where id=t.id;
 else
 update public.teams set player_two_roster_id=(p_player->>'roster_id')::uuid,player_two_name=p_player->>'name',player_two_email=p_player->>'email',player_two_rating=(p_player->>'rating')::numeric,
 player_two_rating_source=coalesce(p_player->>'rating_source','manual'),captain_email=case when member_role='captain' then p_player->>'email' else captain_email end where id=t.id;
 end if;
 -- Applications are the current pairing summary used by admin and invitation UI.
 -- The immutable before/after audit below preserves the previous summary.
 update public.rallora_team_applications set
 requested_by=case when p_slot=1 and uid is not null then uid else requested_by end,
 captain_name=case when p_slot=1 then coalesce(p_player->>'name','Player to be confirmed') else captain_name end,
 captain_phone=case when p_slot=1 then null else captain_phone end,
 captain_playtomic_rating=case when p_slot=1 then (p_player->>'rating')::numeric else captain_playtomic_rating end,
 partner_invite_id=case when p_slot=2 then null else partner_invite_id end,
 partner_name=case when p_slot=2 then coalesce(p_player->>'name','Player to be confirmed') else partner_name end,
 partner_email=case when p_slot=2 then p_player->>'email' else partner_email end,
 partner_playtomic_email=case when p_slot=2 then (select coalesce(playtomic_email,p_player->>'email') from public.rallora_player_profiles where user_id=uid) else partner_playtomic_email end,
 partner_playtomic_rating=case when p_slot=2 then (p_player->>'rating')::numeric else partner_playtomic_rating end,
 updated_at=now() where created_team_id=t.id and status='approved';
 if uid is not null then
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_by,reviewed_at)
 values(s.club_id,s.id,t.division_id,t.id,uid,p_player->>'name','approved',auth.uid(),now()) returning id into req;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by)
 values(req,s.club_id,s.id,t.division_id,t.id,uid,member_role,auth.uid());
 end if;
end $$;

create or replace function rallora_private.manage_players(p_action text,p_team_id uuid,p_slot integer,p_expected_version bigint,
 p_other_team_id uuid default null,p_other_slot integer default null,p_other_version bigint default null,p_pool_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.seasons%rowtype; t public.teams%rowtype; other public.teams%rowtype; pool public.rallora_player_pools%rowtype;
 outgoing jsonb; incoming jsonb; old_uid uuid; incoming_uid uuid; before_rows jsonb; after_rows jsonb; audit_id uuid; standby_id uuid;
begin
 select x.* into s from public.teams tt join public.divisions d on d.id=tt.division_id join public.seasons x on x.id=d.season_id where tt.id=p_team_id;
 if auth.uid() is null or not found or not public.rallora_can_manage_club(s.club_id) then raise exception 'Not authorised'; end if;
 -- Same advisory lock as application approval and late entry; season row lock
 -- also serialises with cycle generation and the legacy placement functions.
 perform pg_advisory_xact_lock(hashtextextended(s.id::text,0));
 select * into s from public.seasons where id=s.id for update;
 if s.status not in ('draft','active') or exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'Choose the current draft or active cycle'; end if;
 if p_action is null or p_action not in ('swap','add','standby') or p_slot is null or p_slot not in(1,2) then raise exception 'Choose a valid player action and slot'; end if;
 if p_action<>'swap' and (p_other_team_id is not null or p_other_slot is not null or p_other_version is not null) then raise exception 'Other pairing is only valid for swaps'; end if;
 if p_action<>'add' and p_pool_id is not null then raise exception 'Standby selection is only valid when adding'; end if;
 perform id from public.teams where id in(p_team_id,p_other_team_id) order by id for update;
 -- Serialise with invitation claims before revoking memberships.
 perform id from public.rallora_team_member_invites where team_id in(p_team_id,p_other_team_id) order by id for update;
 select * into t from public.teams where id=p_team_id;
 if not coalesce(t.is_active,true) or t.roster_version is distinct from p_expected_version then raise exception 'The pairing changed. Refresh and review it again'; end if;
 outgoing:=rallora_private.roster_slot(t.id,p_slot);
 if nullif(outgoing->>'name','') is not null then
 select id into old_uid from auth.users where lower(email)=outgoing->>'email';
 end if;
 select jsonb_agg(to_jsonb(x) order by x.id) into before_rows from public.teams x where id in(p_team_id,p_other_team_id);
 if p_action='swap' then
 select * into other from public.teams where id=p_other_team_id;
 if p_other_slot is null or p_other_slot not in(1,2) or other.id is null or other.id=t.id or other.division_id<>t.division_id or not coalesce(other.is_active,true) then raise exception 'Choose a different pairing in the same division'; end if;
 if other.roster_version is distinct from p_other_version then raise exception 'The other pairing changed. Refresh and review it again'; end if;
 incoming:=rallora_private.roster_slot(other.id,p_other_slot);
 if nullif(outgoing->>'name','') is null or nullif(incoming->>'name','') is null then raise exception 'Choose two occupied player slots to swap'; end if;
 select id into incoming_uid from auth.users where lower(email)=incoming->>'email';
 elsif p_action='add' then
 select * into pool from public.rallora_player_pools where id=p_pool_id and club_id=s.club_id and pool_type='standby' and status='available' for update;
 if not found then raise exception 'This standby player is no longer available'; end if;
 if not exists(with recursive cycles as(select s.id id,s.previous_season_id previous union all select x.id,x.previous_season_id from public.seasons x join cycles c on x.id=c.previous) select 1 from cycles where id=pool.season_id) then raise exception 'Choose standby from this competition'; end if;
 incoming_uid:=coalesce(pool.user_id,(select id from auth.users where lower(email)=lower(pool.email)));
 -- The login identity is authoritative; stale registration emails cannot grant access.
 incoming:=jsonb_build_object('roster_id',pool.roster_player_id,'name',pool.player_name,'email',coalesce((select lower(email) from auth.users where id=incoming_uid),lower(pool.email)),'rating',pool.playtomic_rating,'rating_source','manual');
 else
 if nullif(outgoing->>'name','') is null then raise exception 'This player slot is already empty'; end if;
 incoming:=jsonb_build_object('name',null,'email',null,'rating',null,'rating_source',null);
 end if;
 -- Check both identity and unclaimed email assignments, including the other slot
 -- in the source pairing. Only the two selected slots are excluded for a swap.
 if p_action in ('add','swap') and s.division_assignment_mode='combined_rating' and (incoming->>'rating') is null then raise exception 'This competition requires a rating for the incoming player'; end if;
 if incoming_uid=old_uid or incoming->>'roster_id'=outgoing->>'roster_id' or (incoming->>'email' is not null and incoming->>'email'=outgoing->>'email') then raise exception 'Choose a different player'; end if;
 if exists(select 1 from public.teams x join public.divisions d on d.id=x.division_id
 cross join lateral (values(1,x.player_one_roster_id,lower(x.player_one_email)),(2,x.player_two_roster_id,lower(x.player_two_email))) v(slot,roster_id,email)
 where d.season_id=s.id and coalesce(x.is_active,true) and (v.email in(incoming->>'email',outgoing->>'email') or v.roster_id in((incoming->>'roster_id')::uuid,(outgoing->>'roster_id')::uuid))
 and not(x.id=t.id and v.slot=p_slot) and not(p_action='swap' and x.id=other.id and v.slot=p_other_slot))
 or exists(select 1 from public.rallora_team_roster_memberships r where r.season_id=s.id
 and r.player_user_id in(incoming_uid,old_uid) and r.team_id<>t.id and (p_action<>'swap' or r.team_id<>other.id))
 then raise exception 'A selected player already belongs to another pairing'; end if;
 -- Freeze any legacy activity before changing either roster. Future result inserts
 -- snapshot automatically. Fixtures, IDs, scores and standings are not rebuilt.
 update public.fixtures f set home_player_names=coalesce(f.home_player_names,array[h.player_one_name,h.player_two_name]),
 away_player_names=coalesce(f.away_player_names,array[a.player_one_name,a.player_two_name])
 from public.teams h,public.teams a where h.id=f.home_team_id and a.id=f.away_team_id
 and (f.home_team_id in(t.id,other.id) or f.away_team_id in(t.id,other.id))
 and (f.status in ('submitted','disputed','confirmed','completed','played','awaiting_result') or exists(select 1 from public.results r where r.fixture_id=f.id) or exists(select 1 from public.result_submissions r where r.fixture_id=f.id));
 -- Team-scoped memberships move together in this transaction.
 if p_action='swap' then
 perform rallora_private.assign_roster_slot(other.id,p_other_slot,outgoing);
 elsif nullif(outgoing->>'name','') is not null then
 select id into standby_id from public.rallora_player_pools where season_id=s.id and pool_type='standby'
 and (roster_player_id=(outgoing->>'roster_id')::uuid or user_id=old_uid or (email is not null and lower(email)=outgoing->>'email'))
 order by id limit 1 for update;
 if standby_id is not null then
 update public.rallora_player_pools set roster_player_id=(outgoing->>'roster_id')::uuid,user_id=old_uid,player_name=outgoing->>'name',email=outgoing->>'email',playtomic_rating=(outgoing->>'rating')::numeric,status='available',updated_at=now() where id=standby_id;
 else
 insert into public.rallora_player_pools(club_id,season_id,user_id,roster_player_id,pool_type,player_name,email,playtomic_rating,status)
 values(s.club_id,s.id,old_uid,(outgoing->>'roster_id')::uuid,'standby',outgoing->>'name',outgoing->>'email',(outgoing->>'rating')::numeric,'available');
 end if;
 end if;
 perform rallora_private.assign_roster_slot(t.id,p_slot,incoming);
 if incoming->>'roster_id' is not null then
 with recursive cycles as(select s.id id,s.previous_season_id previous union all select x.id,x.previous_season_id from public.seasons x join cycles c on x.id=c.previous)
 update public.rallora_player_pools set status='matched',updated_at=now() where season_id in(select id from cycles) and status in('available','invited')
 and (roster_player_id=(incoming->>'roster_id')::uuid or user_id=incoming_uid or lower(email)=incoming->>'email'
 or (p_action='swap' and (roster_player_id=(outgoing->>'roster_id')::uuid or user_id=old_uid or lower(email)=outgoing->>'email')));
 end if;
 if p_action='add' then update public.rallora_player_pools set status='matched',updated_at=now() where id=pool.id; end if;
 select jsonb_agg(to_jsonb(x) order by x.id) into after_rows from public.teams x where id in(p_team_id,p_other_team_id);
 insert into public.rallora_player_movements(club_id,season_id,administrator_id,movement_type,source_team_id,destination_team_id,source_slot,destination_slot,affected_player_ids,affected_roster_ids,before_rosters,after_rosters)
 values(s.club_id,s.id,auth.uid(),p_action,case when p_action<>'add' then t.id end,case when p_action='swap' then other.id when p_action='add' then t.id end,case when p_action<>'add' then p_slot end,case when p_action='swap' then p_other_slot when p_action='add' then p_slot end,array_remove(array[old_uid,incoming_uid],null),array_remove(array[(outgoing->>'roster_id')::uuid,(incoming->>'roster_id')::uuid],null),before_rows,after_rows) returning id into audit_id;
 return jsonb_build_object('audit_id',audit_id,'incomplete',p_action='standby');
end $$;

-- CREATE OR REPLACE preserves the existing checked-wrapper and helper grants.
commit;
