-- Deep privacy request role isolation tests, run only on disposable CI PostgreSQL.
-- This script never connects to a real Supabase project.
insert into auth.users(id,email,raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000904','player-two@example.test','{}');

-- Player A: cannot impersonate player B, inspect B's requests, edit status,
-- read confidential internal notes, or execute privileged RPC.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);
do $$
declare rejected boolean := false;
begin
 begin
   insert into public.rallora_privacy_requests(user_id,request_type,details)
   values ('00000000-0000-0000-0000-000000000904','erasure','forged request');
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'Player A impersonated player B'; end if;
 rejected := false;
 begin
   perform public.rallora_admin_update_privacy_request(
    (select id from public.rallora_privacy_requests limit 1),'completed',
    'Spoofed administrative decision by ordinary player');
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'Player A used admin update RPC'; end if;
 if has_column_privilege('authenticated','public.rallora_privacy_requests','internal_notes','SELECT')
 then raise exception 'Confidential internal notes readable by client role'; end if;
end $$;
reset role;

-- Player B submits own request. Player A must never see its row.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000904',false);
insert into public.rallora_privacy_requests(user_id,request_type,details)
values ('00000000-0000-0000-0000-000000000904','erasure','request from second synthetic user');
do $$
begin
 if (select count(*) from public.rallora_privacy_requests)<>1
 then raise exception 'Player B cannot view exactly their own request'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);
do $$
begin
 if (select count(*) from public.rallora_privacy_requests)<>1
 then raise exception 'Player A can see another player request'; end if;
end $$;
reset role;

-- Admin: closure without adequate written evidence must fail.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
do $$
declare target uuid; rejected boolean := false;
begin
 select id into target from public.rallora_admin_list_privacy_requests()
 where request_type='erasure' limit 1;
 if target is null then raise exception 'Admin cannot see second player request'; end if;
 begin
   perform public.rallora_admin_update_privacy_request(target,'completed','too short');
 exception when invalid_parameter_value then rejected := true; end;
 if not rejected then raise exception 'Closed request without documented verification'; end if;
 perform public.rallora_admin_update_privacy_request(
   target,'completed','Identity checked. Reviewed data scope, legal obligations and completion evidence.');
 rejected := false;
 begin
   perform public.rallora_admin_update_privacy_request(target,'in_review',
     'Attempted to reopen a completed request.');
 exception when invalid_parameter_value then rejected := true; end;
 if not rejected then raise exception 'Closed request was reopened without review'; end if;
end $$;
reset role;

do $$
begin
 if (select count(*) from rallora_private.privacy_request_events)<>2
 then raise exception 'Expected exactly two successful review events'; end if;
 if (select count(*) from public.rallora_privacy_requests where status='completed')<>1
 then raise exception 'Expected one closed request'; end if;
end $$;
\echo PASS: isolated user requests, no client notes, admin closure constraints, audit events
