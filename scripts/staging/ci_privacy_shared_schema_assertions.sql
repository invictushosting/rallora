-- CI only: applying privacy migrations must preserve existing shared-schema callers.
do $$ begin
 if not has_schema_privilege('anon','rallora_private','usage')
 or not has_schema_privilege('authenticated','rallora_private','usage') then
  raise exception 'Privacy migration revoked existing chat/worker schema access';
 end if;
 if has_schema_privilege('anon','rallora_private','create')
 or has_schema_privilege('authenticated','rallora_private','create') then
  raise exception 'Browser roles must not create shared-schema objects';
 end if;
 if has_table_privilege('anon','rallora_private.player_terms_acceptance_events','select')
 or has_table_privilege('authenticated','rallora_private.player_terms_acceptance_events','select') then
  raise exception 'Preserved schema access exposed private acceptance records';
 end if;
end $$;
set role anon;
select rallora_private.ci_existing_access_probe();
reset role;
set role authenticated;
select rallora_private.ci_existing_access_probe();
reset role;
