-- Check dependency and anonymous role using synthetic data.
do $$
begin
 if has_function_privilege('anon','public.rallora_club_feature_enabled(uuid,text)','execute')
 then raise exception 'Anon still has general feature RPC'; end if;
 if not has_function_privilege('anon','public.rallora_public_club_events_enabled(uuid)','execute')
 then raise exception 'Anon cannot call public-event predicate'; end if;
end; $$;
set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$
begin
 if (select count(*) from public.rallora_club_events)<>1 then
 raise exception 'Anon must see exactly one enabled/published event'; end if;
end; $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
do $$
begin
 if (select count(*) from public.rallora_club_events)<>3 then
 raise exception 'Platform admin must retain access to all published events'; end if;
end; $$;
reset role;
