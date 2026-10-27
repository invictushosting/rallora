-- Disposable PostgreSQL only: rights request enqueue, role restrictions, retries.
do $$
begin
 if (select count(*) from rallora_private.privacy_notification_outbox)<>2 then
  raise exception 'Each synthetic privacy request must create exactly one notification'; end if;
 if has_table_privilege('anon','rallora_private.privacy_notification_outbox','SELECT') or
    has_table_privilege('authenticated','rallora_private.privacy_notification_outbox','SELECT')
 then raise exception 'Privacy outbox exposed to application roles'; end if;
end $$;
set role anon;
do $$
declare refused boolean:=false;
begin
 begin
  perform public.rallora_claim_privacy_notifications(repeat('b',64));
 exception when insufficient_privilege then refused:=true; end;
 if not refused then raise exception 'Invalid delivery worker token accepted'; end if;
end $$;
reset role;
-- Correct delivery token must obtain the two synthetic notifications.
set role anon;
create temp table privacy_ci_claimed(batch jsonb);
insert into privacy_ci_claimed select public.rallora_claim_privacy_notifications(repeat('a',64));
do $$
begin
 if (select jsonb_array_length(batch) from privacy_ci_claimed)<>2 then
  raise exception 'Expected two privacy notifications for delivery'; end if;
 if (select batch::text from privacy_ci_claimed) ~ 'synthetic GDPR request|request from second synthetic user|@example.test'
 then raise exception 'Sensitive data included in privacy delivery payload'; end if;
end $$;
select public.rallora_finish_privacy_notification(repeat('a',64),
 (batch->0->>'id')::uuid,'test-provider-id',null) from privacy_ci_claimed;
select public.rallora_finish_privacy_notification(repeat('a',64),
 (batch->1->>'id')::uuid,null,'Temporary synthetic failure') from privacy_ci_claimed;
reset role;
do $$
begin
 if (select count(*) from rallora_private.privacy_notification_outbox where status='accepted')<>1
 or (select count(*) from rallora_private.privacy_notification_outbox where status='queued' and attempts=1)<>1
 then raise exception 'Notification acknowledgement or retry state incorrect'; end if;
end $$;
\echo PASS: transactional outbox, scope, payload minimisation, failure retry
