-- Exact production migration is applied to a two-club synthetic database first.
set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$ declare n integer; begin
 select count(*) into n from public.announcements;
 if n <> 1 then raise exception 'anon announcement visibility mismatch: %',n; end if;
 select count(*) into n from public.sponsors;
 if n <> 2 then raise exception 'anon sponsor visibility mismatch: %',n; end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a01',false);
do $$
declare n integer; rejected boolean;
begin
 update public.sponsors set name='A sponsor updated'
 where id='20000000-0000-0000-0000-0000000000a1';
 get diagnostics n=row_count;
 if n <> 1 then raise exception 'A owner cannot update A sponsor'; end if;

 update public.sponsors set name='B attacked'
 where id='20000000-0000-0000-0000-0000000000b1';
 get diagnostics n=row_count;
 if n <> 0 then raise exception 'A owner updated B sponsor'; end if;

 rejected := false;
 begin
  update public.club_rules set season_id='00000000-0000-0000-0000-0000000001b2'
  where id='30000000-0000-0000-0000-0000000000a1';
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'club rule moved across tenants'; end if;

 rejected := false;
 begin
  update public.standings
  set team_id='00000000-0000-0000-0000-0000000003b1'
  where id='50000000-0000-0000-0000-0000000000a1';
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'standing accepted foreign team'; end if;

 rejected := false;
 begin
  update public.cup_qualifier_rules
  set division_id='00000000-0000-0000-0000-0000000002b2'
  where id='60000000-0000-0000-0000-0000000000a1';
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'cup rule accepted foreign division'; end if;

 rejected := false;
 begin
  update public.cup_manual_qualifiers
  set team_id='00000000-0000-0000-0000-0000000003b1'
  where id='70000000-0000-0000-0000-0000000000a1';
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'manual qualifier accepted foreign team'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',false);
do $$ declare n integer; begin
 update public.sponsors set name='Platform B edit'
 where id='20000000-0000-0000-0000-0000000000b1';
 get diagnostics n=row_count;
 if n <> 1 then raise exception 'platform admin cannot update B sponsor'; end if;
end $$;
reset role;
\echo PASS: adjacent club tables enforce tenant ownership and relational integrity
