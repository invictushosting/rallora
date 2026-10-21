-- Scope checks run in the same synthetic two-club database as the tenant policies.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a01',true);
do $$ declare rejected boolean; n integer; sponsor_id uuid:=gen_random_uuid(); begin
 insert into public.sponsors(id,club_id,name,is_active,scope_type,scope_id)
 values(sponsor_id,'00000000-0000-0000-0000-0000000000a1','Scoped test',true,'league','00000000-0000-0000-0000-0000000001a1');
 rejected:=false;
 begin update public.sponsors set scope_id='00000000-0000-0000-0000-0000000001b2' where id=sponsor_id;
 exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Sponsor accepted another clubs league'; end if;
 rejected:=false;
 begin update public.sponsors set scope_type='event',scope_id=gen_random_uuid() where id=sponsor_id;
 exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Sponsor accepted missing event'; end if;
 rejected:=false;
 begin update public.sponsors set scope_type='division',scope_id='00000000-0000-0000-0000-0000000002b2' where id=sponsor_id;
 exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Sponsor accepted another clubs division'; end if;
 update public.sponsors set scope_type='club',scope_id=null,is_main=true where id=sponsor_id;
 rejected:=false;
 begin insert into public.sponsors(id,club_id,name,is_active,is_main) values(gen_random_uuid(),'00000000-0000-0000-0000-0000000000a1','Duplicate main',true,true);
 exception when unique_violation then rejected:=true; end;
 if not rejected then raise exception 'Duplicate active main sponsor accepted'; end if;
 update public.sponsors set name='Other club attacked' where club_id='00000000-0000-0000-0000-0000000000b2';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Sponsor write crossed club boundary'; end if;
end $$;
rollback;
