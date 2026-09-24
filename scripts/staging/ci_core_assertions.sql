-- CI-only smoke and security regression checks for scripts/staging/002_core_tenant_rls.sql.
-- Exercise actual PostgreSQL row-level policy evaluation, NOT a mocked permission function.
-- Fixture has two independent fictional clubs with no production data.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare
 n integer;
begin
 select count(*) into n from public.seasons;
 if n <> 2 then raise exception 'anon sees draft season or lost published season: %',n; end if;
 select count(*) into n from public.fixtures;
 if n <> 1 then raise exception 'anon sees unreleased fixture: %',n; end if;
 select count(*) into n from public.results;
 if n <> 1 then raise exception 'anon sees unreleased result: %',n; end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a01',false);
do $$
declare
 n integer;
 rejected boolean;
begin
 -- Published B rows remain public. Draft B season does NOT.
 select count(*) into n from public.seasons where status='draft';
 if n <> 0 then raise exception 'Club A user sees B draft season'; end if;

 -- Own-club draft can be created and read; wrong-club draft cannot.
 insert into public.seasons values (
  '00000000-0000-0000-0000-0000000001a3',
  '00000000-0000-0000-0000-0000000000a1','A draft','draft'
 );
 select count(*) into n from public.seasons
   where id='00000000-0000-0000-0000-0000000001a3';
 if n <> 1 then raise exception 'Owner cannot see own draft'; end if;
 rejected := false;
 begin
  insert into public.seasons values (
   '00000000-0000-0000-0000-0000000001b4',
   '00000000-0000-0000-0000-0000000000b2','B injected draft','draft'
  );
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'Club A created B season'; end if;

 -- A team can be updated in A, not moved to the foreign B division.
 update public.teams set name='Legitimate A edit'
   where id='00000000-0000-0000-0000-0000000003a1';
 get diagnostics n = row_count;
 if n <> 1 then raise exception 'Own team update failed'; end if;
 rejected := false;
 begin
  update public.teams
   set division_id='00000000-0000-0000-0000-0000000002b2'
   where id='00000000-0000-0000-0000-0000000003a1';
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'Cross-club team reassignment accepted'; end if;

 -- Fixture B in unreleased status must not be editable by A.
 update public.fixtures set status='confirmed'
  where id='00000000-0000-0000-0000-0000000004b2';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'A updated a B fixture'; end if;

 -- Cannot forge A fixture with a B team.
 rejected := false;
 begin
  insert into public.fixtures(id,season_id,division_id,home_team_id,away_team_id,available_from,status) values (
   '00000000-0000-0000-0000-0000000004a3',
   '00000000-0000-0000-0000-0000000001a1',
   '00000000-0000-0000-0000-0000000002a1',
   '00000000-0000-0000-0000-0000000003a1',
   '00000000-0000-0000-0000-0000000003b1',null,'open'
  );
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'A/B mixed fixture accepted'; end if;

 -- Cannot forge results for fixture in club B, even if published.
 rejected := false;
 begin
  insert into public.results(id,fixture_id,winner_team_id,status) values (
   '00000000-0000-0000-0000-0000000006a2',
   '00000000-0000-0000-0000-0000000004b2',
   '00000000-0000-0000-0000-0000000003b1','confirmed'
  );
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'A forged B result'; end if;

 -- Cannot claim another team's victory on a fixture in own club.
 rejected := false;
 begin
  insert into public.results(id,fixture_id,winner_team_id,status) values (
   '00000000-0000-0000-0000-0000000006a3',
   '00000000-0000-0000-0000-0000000004a1',
   '00000000-0000-0000-0000-0000000003b1','confirmed'
  );
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'Out-of-fixture winner accepted'; end if;
end $$;

-- Suspended membership has no right to mutate published rows.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a02',false);
do $$
declare n integer;
begin
 update public.teams set name='Suspended edit'
 where id='00000000-0000-0000-0000-0000000003a1';
 get diagnostics n=row_count;
 if n <> 0 then raise exception 'Suspended user updated a team'; end if;
end $$;

-- Platform operator can manage both tenants with explicit privilege.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',false);
do $$
declare n integer;
begin
 update public.teams set name='Platform edit'
 where id='00000000-0000-0000-0000-0000000003b1';
 get diagnostics n=row_count;
 if n <> 1 then raise exception 'Platform user cannot manage B team'; end if;
end $$;
reset role;
\echo PASS: staging-only core tenant RLS migration enforces unpublished reads and cross-tenant writes
