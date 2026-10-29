-- Recovered from the production migration ledger; already applied.
begin;
-- Older clients must not silently record acknowledgement on behalf of the club.
drop function public.rallora_save_playtomic_integration(uuid,text,text,text,text,text);
create or replace function public.rallora_save_playtomic_integration(
  p_club_id uuid,
  p_client_id text,
  p_external_venue_id text,
  p_ciphertext text,
  p_iv text,
  p_auth_tag text,
  p_access_version text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if p_access_version is distinct from '2026-10-21' then raise exception 'Data access acknowledgement required'; end if;
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

revoke all on function public.rallora_save_playtomic_integration(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.rallora_save_playtomic_integration(uuid,text,text,text,text,text,text) to authenticated;
commit;

