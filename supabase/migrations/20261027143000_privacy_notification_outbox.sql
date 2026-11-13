-- Draft transactional privacy notification outbox: applied ONLY after intake migration.
-- Uses existing delivery_worker_config token and existing scheduled /api/internal/deliveries.
-- No sensitive request body, user ID, type or email is sent in notification.
begin;
create table rallora_private.privacy_notification_outbox (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.rallora_privacy_requests(id) on delete restrict,
 status text not null default 'queued' check(status in ('queued','sending','accepted','failed')),
 attempts integer not null default 0 check(attempts>=0),
 available_at timestamptz not null default now(),
 locked_until timestamptz,
 accepted_at timestamptz,
 provider_id text,
 last_error text,
 created_at timestamptz not null default now()
);
create index privacy_notification_due_idx on rallora_private.privacy_notification_outbox(status,available_at,created_at);
alter table rallora_private.privacy_notification_outbox enable row level security;
revoke all on rallora_private.privacy_notification_outbox from public,anon,authenticated;
-- Trigger runs in the same transaction as the user's rights-request insert.
create function rallora_private.enqueue_privacy_notification()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into rallora_private.privacy_notification_outbox(request_id)
 values(new.id) on conflict(request_id) do nothing;
 return new;
end $$;
revoke all on function rallora_private.enqueue_privacy_notification() from public,anon,authenticated;
create trigger privacy_notification_enqueue after insert on public.rallora_privacy_requests
for each row execute function rallora_private.enqueue_privacy_notification();

-- RPC is token-guarded, even for callers with anon database credentials.
-- The JSON contains opaque request ID only and no private request details.
create function public.rallora_claim_privacy_notifications(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q rallora_private.privacy_notification_outbox%rowtype; payload jsonb:='[]'::jsonb;
begin
 if p_token is null or length(p_token)<>64 or not exists(
  select 1 from rallora_private.delivery_worker_config c where c.token=p_token
 ) then raise exception 'Not authorised' using errcode='42501'; end if;
 for q in select * from rallora_private.privacy_notification_outbox
 where (status='queued' and available_at<=now())
    or (status='sending' and locked_until<now())
 order by created_at for update skip locked limit 5 loop
  if q.attempts>=6 then
   update rallora_private.privacy_notification_outbox
   set status='failed',last_error='Retry limit reached; manual review required',locked_until=null
   where id=q.id;
  else
   update rallora_private.privacy_notification_outbox
   set status='sending', attempts=attempts+1, locked_until=now()+interval '6 minutes'
   where id=q.id;
   payload:=payload||jsonb_build_array(jsonb_build_object('id',q.id,'caseId',q.request_id));
  end if;
 end loop;
 return payload;
end $$;
revoke all on function public.rallora_claim_privacy_notifications(text) from public,authenticated;
grant execute on function public.rallora_claim_privacy_notifications(text) to anon;

create function public.rallora_finish_privacy_notification(
 p_token text,p_id uuid,p_provider_id text,p_error text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_token is null or length(p_token)<>64 or not exists(
  select 1 from rallora_private.delivery_worker_config c where c.token=p_token
 ) then raise exception 'Not authorised' using errcode='42501'; end if;
 update rallora_private.privacy_notification_outbox
 set status=case when p_provider_id is not null then 'accepted'
  when attempts>=6 then 'failed' else 'queued' end,
 provider_id=left(p_provider_id,200),last_error=left(p_error,300),
 accepted_at=case when p_provider_id is not null then now() else null end,
 available_at=now()+make_interval(mins=>least(120,power(2,attempts)::integer)),
 locked_until=null
 where id=p_id and status='sending';
end $$;
revoke all on function public.rallora_finish_privacy_notification(text,uuid,text,text) from public,authenticated;
grant execute on function public.rallora_finish_privacy_notification(text,uuid,text,text) to anon;
commit;
