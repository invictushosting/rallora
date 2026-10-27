-- Assertions run on ephemeral CI PostgreSQL after applying all three privacy migrations.
do $$
declare
  actor uuid := '00000000-0000-0000-0000-000000000903';
  accepted_count integer;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
   (actor,'acceptance-test@example.test','{"terms_accepted":true,"terms_version":"draft-2026-10-27"}')
   on conflict(id) do update set raw_user_meta_data=excluded.raw_user_meta_data;
  select count(*) into accepted_count from rallora_private.player_terms_acceptance_events
    where user_id=actor and terms_version='draft-2026-10-27';
  if accepted_count<>1 then raise exception 'Terms signup trigger did not create one event'; end if;
  if has_table_privilege('authenticated','rallora_private.player_terms_acceptance_events','INSERT')
    or has_table_privilege('authenticated','rallora_private.player_terms_acceptance_events','UPDATE')
    or has_table_privilege('authenticated','rallora_private.player_terms_acceptance_events','DELETE')
  then raise exception 'Terms ledger should not be client writable'; end if;
  if has_table_privilege('authenticated','public.rallora_privacy_requests','UPDATE')
    or has_table_privilege('authenticated','public.rallora_privacy_requests','DELETE')
  then raise exception 'Rights request intake should not be client mutable'; end if;
  if has_function_privilege('anon','public.rallora_admin_list_privacy_requests()','EXECUTE')
    or has_function_privilege('anon','public.rallora_admin_update_privacy_request(uuid,text,text)','EXECUTE')
  then raise exception 'Anonymous admin RPC execution unexpectedly allowed'; end if;
end;
$$;

-- Real authenticated role, JWT claim and RLS — no platform admin grants.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);
insert into public.rallora_privacy_requests(user_id,request_type,details)
 values ('00000000-0000-0000-0000-000000000902','access','synthetic GDPR request');
do $$
begin
  if (select count(*) from public.rallora_privacy_requests)<>1
  then raise exception 'Player cannot view their own privacy request'; end if;
  begin
    perform * from public.rallora_admin_list_privacy_requests();
    raise exception 'SECURITY FAILURE: non-admin called platform RPC';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
-- Admin updates, audit and closure notes run as authenticated with platform-admin claim.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
select public.rallora_admin_update_privacy_request(id,'in_review','Identity checks and controller scope are being assessed.')
 from public.rallora_admin_list_privacy_requests() where request_type='access';
reset role;
do $$
begin
 if (select count(*) from rallora_private.privacy_request_events)<>1
 then raise exception 'Expected one immutable server-side privacy review audit event'; end if;
end;
$$;
