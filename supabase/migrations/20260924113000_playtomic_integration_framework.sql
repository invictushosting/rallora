-- Secure, club-scoped external integration framework for Playtomic.
begin;

create table if not exists public.rallora_club_integrations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  provider text not null check (provider in ('playtomic')),
  status text not null default 'configured' check (status in ('configured','connected','error','disabled')),
  client_id text,
  last_verified_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(club_id,provider)
);

create table if not exists public.rallora_integration_secrets (
  integration_id uuid primary key references public.rallora_club_integrations(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  updated_at timestamptz not null default now()
);

alter table public.rallora_club_integrations enable row level security;
alter table public.rallora_integration_secrets enable row level security;

revoke all on public.rallora_club_integrations,public.rallora_integration_secrets from public,anon;
grant select on public.rallora_club_integrations to authenticated;

create policy "integration_manager_read"
on public.rallora_club_integrations
for select to authenticated
using (public.rallora_can_manage_club(club_id));

create or replace function public.rallora_save_playtomic_integration(
  p_club_id uuid,
  p_client_id text,
  p_ciphertext text,
  p_iv text,
  p_auth_tag text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.rallora_can_manage_club(p_club_id) then raise exception 'Not authorised'; end if;
  if nullif(trim(p_client_id),'') is null or length(trim(p_client_id))>300 then raise exception 'Invalid client ID'; end if;
  if nullif(trim(p_ciphertext),'') is null or nullif(trim(p_iv),'') is null or nullif(trim(p_auth_tag),'') is null then
    raise exception 'Encrypted credential payload is required';
  end if;

  insert into public.rallora_club_integrations(club_id,provider,status,client_id,created_by,updated_by,updated_at,last_error)
  values(p_club_id,'playtomic','configured',trim(p_client_id),auth.uid(),auth.uid(),now(),null)
  on conflict(club_id,provider) do update
    set status='configured',client_id=excluded.client_id,updated_by=auth.uid(),updated_at=now(),last_error=null
  returning id into v_id;

  insert into public.rallora_integration_secrets(integration_id,ciphertext,iv,auth_tag,updated_at)
  values(v_id,p_ciphertext,p_iv,p_auth_tag,now())
  on conflict(integration_id) do update
    set ciphertext=excluded.ciphertext,iv=excluded.iv,auth_tag=excluded.auth_tag,updated_at=now();

  return v_id;
end $$;

create or replace function public.rallora_set_playtomic_integration_state(
  p_club_id uuid,
  p_status text,
  p_error text default null,
  p_verified boolean default false
) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.rallora_can_manage_club(p_club_id) then raise exception 'Not authorised'; end if;
  if p_status not in ('configured','connected','error','disabled') then raise exception 'Invalid status'; end if;
  update public.rallora_club_integrations
  set status=p_status,
      last_error=case when p_status='error' then left(coalesce(p_error,'Connection failed'),500) else null end,
      last_verified_at=case when p_verified then now() else last_verified_at end,
      updated_by=auth.uid(),updated_at=now()
  where club_id=p_club_id and provider='playtomic';
  if not found then raise exception 'Integration not found'; end if;
end $$;

revoke all on function public.rallora_save_playtomic_integration(uuid,text,text,text,text),
  public.rallora_set_playtomic_integration_state(uuid,text,text,boolean)
from public,anon;
grant execute on function public.rallora_save_playtomic_integration(uuid,text,text,text,text),
  public.rallora_set_playtomic_integration_state(uuid,text,text,boolean)
to authenticated;

commit;