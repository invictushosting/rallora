begin;
-- Pairings have two player slots in the existing Rallora schema. Versions reject
-- stale confirmations, including ABA changes, rather than trusting browser state.
alter table public.teams add column roster_version bigint not null default 0;
alter table public.fixtures add column home_player_names text[], add column away_player_names text[];

create table public.rallora_player_movements (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id),
 season_id uuid not null references public.seasons(id),
 administrator_id uuid not null references auth.users(id),
 movement_type text not null check(movement_type in ('swap','add','standby')),
 source_team_id uuid not null references public.teams(id),
 destination_team_id uuid references public.teams(id),
 source_slot integer not null check(source_slot in(1,2)),
 destination_slot integer check(destination_slot in(1,2)),
 affected_player_ids uuid[] not null,
 before_rosters jsonb not null, after_rosters jsonb not null,
 created_at timestamptz not null default now()
);
create index rallora_player_movements_club_idx on public.rallora_player_movements(club_id,created_at desc);
create index rallora_player_movements_season_idx on public.rallora_player_movements(season_id,created_at desc);
alter table public.rallora_player_movements enable row level security;
revoke all on public.rallora_player_movements from public,anon,authenticated;
grant select on public.rallora_player_movements to authenticated;
create policy movement_manager_read on public.rallora_player_movements for select to authenticated
 using(public.rallora_can_manage_club(club_id));

-- Only names are exposed with a fixture, never account emails or audit details.
-- For legacy matches this captures the roster available at migration time; it
-- cannot reconstruct unrecorded historical substitutions.
update public.fixtures f set
 home_player_names=array[h.player_one_name,h.player_two_name],
 away_player_names=array[a.player_one_name,a.player_two_name]
from public.teams h,public.teams a
where h.id=f.home_team_id and a.id=f.away_team_id and
 (f.status in ('submitted','disputed','confirmed','completed','played','awaiting_result')
 or exists(select 1 from public.results r where r.fixture_id=f.id)
 or exists(select 1 from public.result_submissions r where r.fixture_id=f.id));

create function rallora_private.capture_match_roster() returns trigger
language plpgsql security definer set search_path='' as $$
declare f public.fixtures%rowtype; fid uuid;
begin
 fid:=new.fixture_id;
 select * into f from public.fixtures where id=fid;
 -- Lock in the same deterministic order as movements. A competing write either
 -- sees this roster or retries after PostgreSQL rolls back a deadlock victim.
 perform id from public.teams where id in(f.home_team_id,f.away_team_id) order by id for update;
 update public.fixtures x set
 home_player_names=coalesce(x.home_player_names,array[h.player_one_name,h.player_two_name]),
 away_player_names=coalesce(x.away_player_names,array[a.player_one_name,a.player_two_name])
 from public.teams h,public.teams a where x.id=fid and h.id=x.home_team_id and a.id=x.away_team_id;
 return new;
end $$;
revoke all on function rallora_private.capture_match_roster() from public,anon,authenticated;
create trigger capture_submission_roster before insert on public.result_submissions
 for each row execute function rallora_private.capture_match_roster();
create trigger capture_result_roster before insert on public.results
 for each row execute function rallora_private.capture_match_roster();

create function rallora_private.version_team_roster() returns trigger
language plpgsql set search_path='' as $$
begin
 if row(new.player_one_name,new.player_two_name,new.player_one_email,new.player_two_email,new.player_one_rating,new.player_two_rating)
 is distinct from row(old.player_one_name,old.player_two_name,old.player_one_email,old.player_two_email,old.player_one_rating,old.player_two_rating) then
 new.roster_version:=old.roster_version+1;
 else new.roster_version:=old.roster_version; end if;
 return new;
end $$;
revoke all on function rallora_private.version_team_roster() from public,anon,authenticated;
create trigger version_team_roster before update on public.teams for each row execute function rallora_private.version_team_roster();

-- Internal helpers are not executable by API roles. The checked operation below
-- is their only entry point. auth.users access is required to resolve identities.
create function rallora_private.roster_slot(p_team uuid,p_slot integer) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('name',case when p_slot=1 then t.player_one_name else t.player_two_name end,
 'email',lower(coalesce(case when p_slot=1 then t.player_one_email else t.player_two_email end,
 case when p_slot=1 then u.email else a.partner_email end)),
 'rating',case when p_slot=1 then t.player_one_rating else t.player_two_rating end,
 'rating_source',case when p_slot=1 then t.player_one_rating_source else t.player_two_rating_source end)
 from public.teams t left join public.rallora_team_applications a on a.created_team_id=t.id and a.status='approved'
 left join auth.users u on u.id=a.requested_by where t.id=p_team limit 1;
$$;
revoke all on function rallora_private.roster_slot(uuid,integer) from public,anon,authenticated;

create function rallora_private.assign_roster_slot(p_team uuid,p_slot integer,p_player jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare t public.teams%rowtype; s public.seasons%rowtype; previous jsonb; uid uuid; old_uid uuid; req uuid; member_role text;
begin
 select * into t from public.teams where id=p_team;
 select x.* into s from public.seasons x join public.divisions d on d.season_id=x.id where d.id=t.division_id;
 previous:=rallora_private.roster_slot(p_team,p_slot);
 select id into old_uid from auth.users where lower(email)=previous->>'email';
 select role into member_role from public.rallora_team_roster_memberships where team_id=t.id and player_user_id=old_uid;
 member_role:=coalesce(member_role,case when p_slot=1 then 'captain' else 'player' end);
 select id into uid from auth.users where lower(email)=p_player->>'email';
 if nullif(p_player->>'name','') is not null and uid is null then raise exception 'The incoming player needs a registered Rallora account'; end if;
 delete from public.rallora_team_roster_memberships where team_id=t.id and player_user_id=old_uid;
 -- Keep the original registration and invite history; withdraw current access.
 update public.rallora_team_registration_requests set status='withdrawn',organiser_note='Moved by club administrator',updated_at=now()
 where team_id=t.id and player_user_id=old_uid and status in ('approved','pending');
 update public.rallora_team_member_invites set status='cancelled' where team_id=t.id and lower(invited_email)=previous->>'email' and status='pending';
 if p_slot=1 then
 update public.teams set player_one_name=p_player->>'name',player_one_email=p_player->>'email',player_one_rating=(p_player->>'rating')::numeric,
 player_one_rating_source=coalesce(p_player->>'rating_source','manual'),captain_email=case when member_role='captain' then p_player->>'email' else captain_email end where id=t.id;
 else
 update public.teams set player_two_name=p_player->>'name',player_two_email=p_player->>'email',player_two_rating=(p_player->>'rating')::numeric,
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
revoke all on function rallora_private.assign_roster_slot(uuid,integer,jsonb) from public,anon,authenticated;

create function rallora_private.manage_players(p_action text,p_team_id uuid,p_slot integer,p_expected_version bigint,
 p_other_team_id uuid default null,p_other_slot integer default null,p_other_version bigint default null,p_pool_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.seasons%rowtype; t public.teams%rowtype; other public.teams%rowtype; pool public.rallora_player_pools%rowtype;
 outgoing jsonb; incoming jsonb; old_uid uuid; incoming_uid uuid; before_rows jsonb; after_rows jsonb; audit_id uuid;
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
 if old_uid is null then raise exception 'This player must claim their Rallora account before being moved'; end if;
 end if;
 select jsonb_agg(to_jsonb(x) order by x.id) into before_rows from public.teams x where id in(p_team_id,p_other_team_id);
 if p_action='swap' then
 select * into other from public.teams where id=p_other_team_id;
 if p_other_slot is null or p_other_slot not in(1,2) or other.id is null or other.id=t.id or other.division_id<>t.division_id or not coalesce(other.is_active,true) then raise exception 'Choose a different pairing in the same division'; end if;
 if other.roster_version is distinct from p_other_version then raise exception 'The other pairing changed. Refresh and review it again'; end if;
 incoming:=rallora_private.roster_slot(other.id,p_other_slot);
 if nullif(outgoing->>'name','') is null or nullif(incoming->>'name','') is null then raise exception 'Choose two occupied player slots to swap'; end if;
 select id into incoming_uid from auth.users where lower(email)=incoming->>'email';
 if incoming_uid is null then raise exception 'Both players must claim their Rallora accounts before swapping'; end if;
 elsif p_action='add' then
 select * into pool from public.rallora_player_pools where id=p_pool_id and club_id=s.club_id and pool_type='standby' and status='available' for update;
 if not found then raise exception 'This standby player is no longer available'; end if;
 if not exists(with recursive cycles as(select s.id id,s.previous_season_id previous union all select x.id,x.previous_season_id from public.seasons x join cycles c on x.id=c.previous) select 1 from cycles where id=pool.season_id) then raise exception 'Choose standby from this competition'; end if;
 incoming_uid:=pool.user_id;
 -- The login identity is authoritative; stale registration emails cannot grant access.
 incoming:=jsonb_build_object('name',pool.player_name,'email',(select lower(email) from auth.users where id=pool.user_id),'rating',pool.playtomic_rating,'rating_source','manual');
 else
 if nullif(outgoing->>'name','') is null then raise exception 'This player slot is already empty'; end if;
 incoming:=jsonb_build_object('name',null,'email',null,'rating',null,'rating_source',null);
 end if;
 -- Check both identity and unclaimed email assignments, including the other slot
 -- in the source pairing. Only the two selected slots are excluded for a swap.
 if p_action in ('add','swap') and s.division_assignment_mode='combined_rating' and (incoming->>'rating') is null then raise exception 'This competition requires a rating for the incoming player'; end if;
 if incoming_uid=old_uid then raise exception 'Choose a different player'; end if;
 if exists(select 1 from public.teams x join public.divisions d on d.id=x.division_id
 cross join lateral (values(1,lower(x.player_one_email)),(2,lower(x.player_two_email))) v(slot,email)
 where d.season_id=s.id and coalesce(x.is_active,true) and v.email in(incoming->>'email',outgoing->>'email')
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
 elsif old_uid is not null then
 insert into public.rallora_player_pools(club_id,season_id,user_id,pool_type,player_name,email,playtomic_rating,status)
 values(s.club_id,s.id,old_uid,'standby',outgoing->>'name',outgoing->>'email',(outgoing->>'rating')::numeric,'available')
 on conflict(season_id,user_id,pool_type) do update set player_name=excluded.player_name,email=excluded.email,playtomic_rating=excluded.playtomic_rating,status='available',updated_at=now();
 end if;
 perform rallora_private.assign_roster_slot(t.id,p_slot,incoming);
 if incoming_uid is not null then
 with recursive cycles as(select s.id id,s.previous_season_id previous union all select x.id,x.previous_season_id from public.seasons x join cycles c on x.id=c.previous)
 update public.rallora_player_pools set status='matched',updated_at=now() where (user_id=incoming_uid or (p_action='swap' and user_id=old_uid)) and season_id in(select id from cycles) and status in('available','invited');
 end if;
 if p_action='add' then update public.rallora_player_pools set status='matched',updated_at=now() where id=pool.id; end if;
 select jsonb_agg(to_jsonb(x) order by x.id) into after_rows from public.teams x where id in(p_team_id,p_other_team_id);
 insert into public.rallora_player_movements(club_id,season_id,administrator_id,movement_type,source_team_id,destination_team_id,source_slot,destination_slot,affected_player_ids,before_rosters,after_rosters)
 values(s.club_id,s.id,auth.uid(),p_action,t.id,other.id,p_slot,case when p_action='swap' then p_other_slot end,array_remove(array[old_uid,incoming_uid],null),before_rows,after_rows) returning id into audit_id;
 return jsonb_build_object('audit_id',audit_id,'incomplete',p_action='standby');
end $$;
revoke all on function rallora_private.manage_players(text,uuid,integer,bigint,uuid,integer,bigint,uuid) from public,anon;
grant execute on function rallora_private.manage_players(text,uuid,integer,bigint,uuid,integer,bigint,uuid) to authenticated;
create function public.rallora_manage_players(p_action text,p_team_id uuid,p_slot integer,p_expected_version bigint,
 p_other_team_id uuid default null,p_other_slot integer default null,p_other_version bigint default null,p_pool_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select rallora_private.manage_players(p_action,p_team_id,p_slot,p_expected_version,p_other_team_id,p_other_slot,p_other_version,p_pool_id);
$$;
revoke all on function public.rallora_manage_players(text,uuid,integer,bigint,uuid,integer,bigint,uuid) from public,anon;
grant execute on function public.rallora_manage_players(text,uuid,integer,bigint,uuid,integer,bigint,uuid) to authenticated;
-- Retire both legacy entry points so old clients cannot bypass the audit trail.
revoke execute on function public.rallora_replace_from_pool(uuid,integer,uuid),rallora_private.replace_from_pool(uuid,integer,uuid) from authenticated;
commit;
