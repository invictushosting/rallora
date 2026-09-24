begin;

alter table public.rallora_club_integrations
  add column if not exists external_venue_id text;

create table if not exists public.rallora_playtomic_player_links (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  playtomic_player_id text not null,
  padel_rating numeric,
  playtomic_name text,
  playtomic_email text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(club_id,user_id),
  unique(club_id,playtomic_player_id),
  check (padel_rating is null or (padel_rating >= 0 and padel_rating <= 10))
);

alter table public.rallora_playtomic_player_links enable row level security;

revoke all on public.rallora_playtomic_player_links from public,anon;
grant select on public.rallora_playtomic_player_links to authenticated;

drop policy if exists "playtomic_player_link_read" on public.rallora_playtomic_player_links;
create policy "playtomic_player_link_read"
on public.rallora_playtomic_player_links
for select to authenticated
using (auth.uid() = user_id or public.rallora_can_manage_club(club_id));

drop function if exists public.rallora_save_playtomic_integration(uuid,text,text,text,text);
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

  return v_id;
end $$;

revoke all on function public.rallora_save_playtomic_integration(uuid,text,text,text,text,text)
from public,anon;
grant execute on function public.rallora_save_playtomic_integration(uuid,text,text,text,text,text)
to authenticated;

create or replace function public.rallora_disconnect_playtomic_integration(p_club_id uuid)
returns void language plpgsql security definer set search_path='' as $
declare v_id uuid;
begin
  if not public.rallora_can_manage_club(p_club_id) then raise exception 'Not authorised'; end if;
  select id into v_id from public.rallora_club_integrations where club_id=p_club_id and provider='playtomic' for update;
  if v_id is null then return; end if;
  delete from public.rallora_integration_secrets where integration_id=v_id;
  update public.rallora_club_integrations
    set status='disabled',client_id=null,external_venue_id=null,last_error=null,updated_by=auth.uid(),updated_at=now()
    where id=v_id;
end $;

revoke all on function public.rallora_disconnect_playtomic_integration(uuid) from public,anon;
grant execute on function public.rallora_disconnect_playtomic_integration(uuid) to authenticated;

commit;
