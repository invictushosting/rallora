-- Full tenant-safety database: verify the real worker RPCs as their actual role.
begin;
set local role anon;
do $$
declare rejected boolean;
begin
 if not has_schema_privilege('anon','rallora_private','USAGE') then
  raise exception 'Delivery worker cannot resolve private implementation';
 end if;
 if has_schema_privilege('anon','rallora_private','CREATE') then
  raise exception 'Worker role can create private objects';
 end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='rallora_private' and has_function_privilege('anon',p.oid,'EXECUTE')
  and p.proname not in('claim_deliveries','finish_delivery')) then
  raise exception 'Anonymous role can execute a non-worker private function';
 end if;
 rejected:=false;
 begin
  perform public.rallora_claim_deliveries('invalid-worker-token');
 exception when raise_exception then
  if sqlerrm='Not authorised' then rejected:=true; else raise; end if;
 end;
 if not rejected then raise exception 'Worker claim accepted invalid token'; end if;
 rejected:=false;
 begin
  perform public.rallora_finish_delivery('invalid-worker-token',gen_random_uuid(),null,null);
 exception when raise_exception then
  if sqlerrm='Not authorised' then rejected:=true; else raise; end if;
 end;
 if not rejected then raise exception 'Worker acknowledgement accepted invalid token'; end if;
 if has_function_privilege('anon','public.rallora_fixture_conversation(uuid)','EXECUTE') then
  raise exception 'Anonymous fixture chat RPC exposed';
 end if;
end $$;
rollback;
