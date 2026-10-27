-- Draft administrator privacy-request workflow, follows intake migration.
-- This is a controlled privileged RPC interface; verify grants and auth tests before applying.
begin;
create table if not exists rallora_private.privacy_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.rallora_privacy_requests(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  previous_status text not null,
  next_status text not null,
  event_at timestamptz not null default transaction_timestamp()
);
alter table rallora_private.privacy_request_events enable row level security;
revoke all on rallora_private.privacy_request_events from public,anon,authenticated;
create index if not exists privacy_request_events_request_id on rallora_private.privacy_request_events(request_id,event_at);

create or replace function public.rallora_admin_list_privacy_requests()
returns table(id uuid,user_id uuid,request_type text,details text,status text,internal_notes text,created_at timestamptz,updated_at timestamptz,closed_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not exists(
    select 1 from public.rallora_platform_admins a where a.user_id=auth.uid()
  ) then raise exception 'Not authorised' using errcode='42501'; end if;
  return query select p.id,p.user_id,p.request_type,p.details,p.status,p.internal_notes,p.created_at,p.updated_at,p.closed_at
    from public.rallora_privacy_requests p
    order by case when p.status in ('completed','declined') then 1 else 0 end,
      case when p.status in ('completed','declined') then null else p.created_at end asc nulls last,
      p.created_at desc limit 200;
end;
$$;
revoke all on function public.rallora_admin_list_privacy_requests() from public,anon;
grant execute on function public.rallora_admin_list_privacy_requests() to authenticated;

create or replace function public.rallora_admin_update_privacy_request(
  p_request_id uuid,p_status text,p_notes text)
returns void
language plpgsql security definer set search_path=''
as $$
declare old_status text;
begin
  if auth.uid() is null or not exists(
    select 1 from public.rallora_platform_admins a where a.user_id=auth.uid()
  ) then raise exception 'Not authorised' using errcode='42501'; end if;
  if p_status not in ('received','identity_check','in_review','completed','declined') then
    raise exception 'Invalid status' using errcode='22023'; end if;
  if p_notes is not null and char_length(p_notes)>4000 then
    raise exception 'Notes too long' using errcode='22023'; end if;
  if p_status in ('completed','declined') and char_length(trim(coalesce(p_notes,''))) < 20 then
    raise exception 'Document the decision and verification steps in internal notes before closing' using errcode='22023'; end if;
  select status into old_status from public.rallora_privacy_requests where id=p_request_id for update;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;
  if old_status in ('completed','declined') and old_status <> p_status then
    raise exception 'Closed requests cannot be reopened without a separate review' using errcode='22023'; end if;
  update public.rallora_privacy_requests
    set status=p_status,internal_notes=p_notes,updated_at=transaction_timestamp(),
      closed_at=case when p_status in ('completed','declined') then transaction_timestamp() else null end
    where id=p_request_id;
  insert into rallora_private.privacy_request_events(request_id,actor_user_id,previous_status,next_status)
    values (p_request_id,auth.uid(),old_status,p_status);
end;
$$;
revoke all on function public.rallora_admin_update_privacy_request(uuid,text,text) from public,anon;
grant execute on function public.rallora_admin_update_privacy_request(uuid,text,text) to authenticated;
commit;
