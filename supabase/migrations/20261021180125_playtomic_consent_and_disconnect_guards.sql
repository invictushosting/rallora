-- Recovered from the production migration ledger; already applied.
begin;
alter table public.rallora_club_integrations
 add column access_version text,
 add column consented_at timestamptz,
 add column consented_by uuid references auth.users(id) on delete set null;
create or replace function public.rallora_save_playtomic_integration(
  p_club_id uuid,
  p_client_id text,
  p_external_venue_id text,
  p_ciphertext text,
  p_iv text,
  p_auth_tag text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.rallora_can_manage_club(p_club_id) then raise exception 'Not authorised'; end if;
  if nullif(trim(p_client_id),'') is null or length(trim(p_client_id))>300 then raise exception 'Invalid client ID'; end if;
  if nullif(trim(p_external_venue_id),'') is null or length(trim(p_external_venue_id))>300 then raise exception 'Invalid venue ID'; end if;
  if nullif(trim(p_ciphertext),'') is null or nullif(trim(p_iv),'') is null or nullif(trim(p_auth_tag),'') is null then
    raise exception 'Encrypted credential payload is required';
  end if;

  insert into public.rallora_club_integrations(club_id,provider,status,client_id,external_venue_id,created_by,updated_by,updated_at,last_error)
  values(p_club_id,'playtomic','configured',trim(p_client_id),trim(p_external_venue_id),auth.uid(),auth.uid(),now(),null)
  on conflict(club_id,provider) do update
    set status='configured',client_id=excluded.client_id,external_venue_id=excluded.external_venue_id,
        updated_by=auth.uid(),updated_at=now(),last_error=null
  returning id into v_id;

  insert into public.rallora_integration_secrets(integration_id,ciphertext,iv,auth_tag,updated_at)
  values(v_id,p_ciphertext,p_iv,p_auth_tag,now())
  on conflict(integration_id) do update
    set ciphertext=excluded.ciphertext,iv=excluded.iv,auth_tag=excluded.auth_tag,updated_at=now();

  update public.rallora_club_integrations set access_version='2026-10-21',consented_at=now(),consented_by=auth.uid() where id=v_id;
  return v_id;
end $$;

-- Serialize new imports against disconnect; do not resurrect data after revocation.
create function public.rallora_guard_playtomic_import()
returns trigger language plpgsql security definer set search_path='' as $$
declare integration_id uuid;
begin
 select id into integration_id from public.rallora_club_integrations
 where club_id=new.club_id and provider='playtomic' and status='connected'
 and access_version='2026-10-21' for share;
 if integration_id is null then raise exception 'Playtomic connection is not authorised'; end if;
 if tg_table_name='rallora_playtomic_bookings' then
  if new.matched_fixture_id is null or new.matched_player_count<>4 or new.match_state<>'confirmed' then
   raise exception 'Only four-player fixture matches may be imported'; end if;
  if not exists(select 1 from public.fixtures f join public.seasons s on s.id=f.season_id
   where f.id=new.matched_fixture_id and s.club_id=new.club_id) then
   raise exception 'Fixture does not belong to this club'; end if;
 else
  if not exists(select 1 from public.rallora_club_memberships where club_id=new.club_id and user_id=new.user_id and status='active')
   and not exists(select 1 from public.rallora_team_roster_memberships where club_id=new.club_id and player_user_id=new.user_id) then
   raise exception 'Player does not belong to this club'; end if;
 end if;
 return new;
end $$;
revoke all on function public.rallora_guard_playtomic_import() from public,anon,authenticated;
create trigger guard_playtomic_booking_import before insert or update on public.rallora_playtomic_bookings
 for each row execute function public.rallora_guard_playtomic_import();
create trigger guard_playtomic_player_import before insert or update on public.rallora_playtomic_player_links
 for each row execute function public.rallora_guard_playtomic_import();

create or replace function public.rallora_disconnect_playtomic_integration(p_club_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.rallora_can_manage_club(p_club_id) then raise exception 'Not authorised'; end if;
 select id into v_id from public.rallora_club_integrations where club_id=p_club_id and provider='playtomic' for update;
 if v_id is null then return; end if;
 delete from public.rallora_integration_secrets where integration_id=v_id;
 delete from public.rallora_playtomic_bookings where club_id=p_club_id;
 delete from public.rallora_playtomic_player_links where club_id=p_club_id;
 update public.rallora_club_integrations set status='disabled',client_id=null,external_venue_id=null,
 last_error=null,last_sync_at=null,last_verified_at=null,access_version=null,consented_at=null,consented_by=null,
 updated_by=auth.uid(),updated_at=now() where id=v_id;
end $$;
revoke all on function public.rallora_disconnect_playtomic_integration(uuid) from public,anon;
grant execute on function public.rallora_disconnect_playtomic_integration(uuid) to authenticated;
-- Imported booking metadata is kept for 30 days after the booking ends.
select cron.schedule('rallora-playtomic-retention','20 3 * * *',$job$
 delete from public.rallora_playtomic_bookings where ends_at < now()-interval '30 days';
 delete from public.rallora_playtomic_player_links l where not exists
  (select 1 from public.rallora_team_roster_memberships r where r.club_id=l.club_id and r.player_user_id=l.user_id)
  and not exists(select 1 from public.rallora_club_memberships m where m.club_id=l.club_id and m.user_id=l.user_id and m.status='active');
$job$);
commit;

