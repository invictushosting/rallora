-- Run last in tenant-safety's disposable synthetic PostgreSQL.
-- These tests exercise the actual migrated helper under impersonated JWT claims.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a01',false);
do $$
declare foreign_access boolean; own_access boolean;
begin
  select public.rallora_can_manage_fixture('00000000-0000-0000-0000-0000000004b2') into foreign_access;
  if foreign_access is distinct from false then raise exception 'Club A owner can manage club B fixture'; end if;
  select public.rallora_can_manage_fixture('00000000-0000-0000-0000-0000000004a1') into own_access;
  if own_access is distinct from true then raise exception 'Club A owner lost own fixture access'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a02',false);
do $$
begin
 if public.rallora_can_manage_fixture('00000000-0000-0000-0000-0000000004a1')
 then raise exception 'Suspended club A user can manage fixture'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000b02',false);
do $$
begin
 if public.rallora_can_manage_fixture('00000000-0000-0000-0000-0000000004b2')
 then raise exception 'Club B captain unexpectedly has organiser fixture override rights'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',false);
do $$
begin
 if not public.rallora_can_manage_fixture('00000000-0000-0000-0000-0000000004a1')
 or not public.rallora_can_manage_fixture('00000000-0000-0000-0000-0000000004b2')
 then raise exception 'Platform admin unable to manage both clubs'; end if;
end $$;
reset role;
\echo PASS: role-aware fixture admin helper respects own/foreign/suspended/platform boundaries
