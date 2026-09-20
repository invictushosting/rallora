-- Assertions for synthetic CI fixture, executable on clean Postgres 17.
-- No network access to a Supabase or customer production database.
do $$
begin
  if has_function_privilege('anon', 'public.rallora_can_manage_club(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute management helper';
  end if;
  if not has_function_privilege('authenticated', 'public.rallora_can_manage_club(uuid)', 'EXECUTE') then
    raise exception 'FAIL: authenticated cannot execute management helper';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a01', false);
do $$
declare
  blocked boolean := false;
  n integer;
begin
  if not public.rallora_can_manage_club('00000000-0000-0000-0000-0000000000a1')
     or public.rallora_can_manage_club('00000000-0000-0000-0000-0000000000b2') then
    raise exception 'FAIL: Club A owner can access wrong club';
  end if;
  if not public.rallora_can_manage_season('00000000-0000-0000-0000-0000000001a1')
     or public.rallora_can_manage_season('00000000-0000-0000-0000-0000000001b2') then
    raise exception 'FAIL: season scope';
  end if;
  if not public.rallora_can_manage_division('00000000-0000-0000-0000-0000000002a1')
     or public.rallora_can_manage_division('00000000-0000-0000-0000-0000000002b2') then
    raise exception 'FAIL: division scope';
  end if;
  if not public.rallora_can_manage_team('00000000-0000-0000-0000-0000000003a1')
     or public.rallora_can_manage_team('00000000-0000-0000-0000-0000000003b1') then
    raise exception 'FAIL: team scope';
  end if;
  if not public.rallora_can_manage_fixture('00000000-0000-0000-0000-0000000004a1')
     or public.rallora_can_manage_fixture('00000000-0000-0000-0000-0000000004b2') then
    raise exception 'FAIL: fixture scope';
  end if;
  if public.rallora_can_manage_club('ffffffff-ffff-ffff-ffff-ffffffffffff') then
    raise exception 'FAIL: unknown club permitted';
  end if;
  update public.teams set name = 'A Team Updated'
  where id = '00000000-0000-0000-0000-0000000003a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: own club update blocked'; end if;
  update public.teams set name = 'Malicious B Edit'
  where id = '00000000-0000-0000-0000-0000000003b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: other club update allowed'; end if;
  begin
    update public.teams
      set division_id = '00000000-0000-0000-0000-0000000002b2'
      where id = '00000000-0000-0000-0000-0000000003a2';
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL: cross-club reparent allowed'; end if;
  blocked := false;
  begin
    insert into public.teams values (
      '00000000-0000-0000-0000-0000000003f1',
      '00000000-0000-0000-0000-0000000002b2', 'Unauthorized insert'
    );
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL: cross-club insert allowed'; end if;
end $$;

-- Club B owner must have mirrored but separate access.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000b01', false);
do $$
begin
  if public.rallora_can_manage_club('00000000-0000-0000-0000-0000000000a1')
     or not public.rallora_can_manage_club('00000000-0000-0000-0000-0000000000b2')
     or public.rallora_can_manage_fixture('00000000-0000-0000-0000-0000000004a1')
     or not public.rallora_can_manage_fixture('00000000-0000-0000-0000-0000000004b2') then
    raise exception 'FAIL: club B owner scope';
  end if;
end $$;

-- Suspended member and captain have no club-wide write rights.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a02', false);
do $$
begin
  if public.rallora_can_manage_club('00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FAIL: suspended member can manage club A';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000b02', false);
do $$
begin
  if public.rallora_can_manage_club('00000000-0000-0000-0000-0000000000b2') then
    raise exception 'FAIL: captain has club-wide management access';
  end if;
end $$;

-- Unregistered Auth user and no session have no club privileges.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a77', false);
do $$
begin
  if public.rallora_can_manage_club('00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FAIL: unrelated authenticated user granted access';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  if public.rallora_can_manage_club('00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FAIL: null Auth user granted access';
  end if;
end $$;

-- Platform admin has explicit oversight of both clubs.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000999', false);
do $$
begin
  if not public.rallora_is_platform_admin()
     or not public.rallora_can_manage_club('00000000-0000-0000-0000-0000000000a1')
     or not public.rallora_can_manage_club('00000000-0000-0000-0000-0000000000b2') then
    raise exception 'FAIL: platform operator lacks intended oversight';
  end if;
end $$;
reset role;
\echo PASS: synthetic club ownership and sample team RLS tests
