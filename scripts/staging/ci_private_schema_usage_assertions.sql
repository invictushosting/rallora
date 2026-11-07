-- Run after support workspace and the schema USAGE restoration.
-- The support schema test originally missed the existing invoker RPC callers.
begin;
do $$
begin
 if not has_schema_privilege('authenticated','rallora_private','USAGE') then
  raise exception 'Authenticated invoker RPCs cannot resolve private functions';
 end if;
 if has_schema_privilege('authenticated','rallora_private','CREATE') then
  raise exception 'Authenticated users can create private objects';
 end if;
 if has_schema_privilege('anon','rallora_private','USAGE') then
  raise exception 'Anonymous schema access was introduced';
 end if;
 if has_function_privilege('authenticated','rallora_private.audit_support_ticket()','EXECUTE') then
  raise exception 'Support audit trigger is directly executable';
 end if;
end $$;

-- Exercise schema lookup through an invoker wrapper under the real client role.
-- The private implementation still enforces its own caller checks.
create function rallora_private.ci_schema_usage_probe() returns boolean
language sql security definer set search_path='' as $$
 select auth.uid() is not null;
$$;
revoke all on function rallora_private.ci_schema_usage_probe() from public,anon;
grant execute on function rallora_private.ci_schema_usage_probe() to authenticated;
create function public.ci_schema_usage_probe() returns boolean
language sql security invoker set search_path='' as $$
 select rallora_private.ci_schema_usage_probe();
$$;
revoke all on function public.ci_schema_usage_probe() from public,anon;
grant execute on function public.ci_schema_usage_probe() to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$
begin
 if not public.ci_schema_usage_probe() then
  raise exception 'Authenticated invoker wrapper failed';
 end if;
end $$;
rollback;
