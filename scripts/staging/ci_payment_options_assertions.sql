-- Synthetic club A / B payment-option tests. No merchant processing.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

insert into public.rallora_league_entry_rules (
 id,club_id,season_id,created_by,fee_pence
) values (
 '00000000-0000-0000-0000-0000000009a1',
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-000000000a01',2500
);
insert into public.rallora_league_collection_options (
 id,club_id,season_id,rules_id,method,created_by
) values (
 '00000000-0000-0000-0000-0000000007a1',
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000009a1',
 'bank_transfer',
 '00000000-0000-0000-0000-000000000a01'
);
insert into public.rallora_league_non_cash_prizes (
 id,club_id,season_id,rules_id,title,description,prize_place,created_by
) values (
 '00000000-0000-0000-0000-0000000008a1',
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000009a1',
 'Padel racket','Sponsor-provided test item','winner',
 '00000000-0000-0000-0000-000000000a01'
);

do $$
begin
 if (select count(*) from public.rallora_league_collection_options)<>1
  or (select count(*) from public.rallora_league_non_cash_prizes)<>1 then
  raise exception 'A owner could not access A collection/prize drafts';
 end if;
end $$;

-- No client can mark a merchant option approved or physical prize delivered.
do $$
begin
 update public.rallora_league_collection_options set status='approved'
 where id='00000000-0000-0000-0000-0000000007a1';
 raise exception 'Client approved their own payment method';
exception when insufficient_privilege then null;
end $$;
do $$
begin
 update public.rallora_league_non_cash_prizes set status='delivered'
 where id='00000000-0000-0000-0000-0000000008a1';
 raise exception 'Client marked prize delivered';
exception when insufficient_privilege then null;
end $$;

-- An external provider option can be planned, not activated.
insert into public.rallora_league_collection_options (
  club_id,season_id,rules_id,method,created_by
) values (
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000009a1',
 'stripe_connect','00000000-0000-0000-0000-000000000a01'
);

do $$
begin
 insert into public.rallora_league_collection_options (
  club_id,season_id,rules_id,method,created_by
 ) values (
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001b2',
 '00000000-0000-0000-0000-0000000009a1',
 'paypal','00000000-0000-0000-0000-000000000a01'
 );
 raise exception 'A rules attached to B season';
exception when foreign_key_violation then null;
end $$;

-- Same club, separate organiser; may read, not mutate A author's drafts.
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000a03';
do $$
declare n integer;
begin
 if (select count(*) from public.rallora_league_collection_options)<>2 then
   raise exception 'A admin cannot read payment method drafts';
 end if;
 update public.rallora_league_collection_options set method='cash_at_club'
   where id='00000000-0000-0000-0000-0000000007a1';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'A admin edited another author payment method'; end if;
 delete from public.rallora_league_non_cash_prizes
   where id='00000000-0000-0000-0000-0000000008a1';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'A admin deleted another author prize'; end if;
end $$;

set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000a02';
do $$
begin
 if (select count(*) from public.rallora_league_collection_options)<>0
   or (select count(*) from public.rallora_league_non_cash_prizes)<>0 then
    raise exception 'Suspended A member saw collection/prize drafts';
 end if;
end $$;

set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000b01';
do $$
begin
 if (select count(*) from public.rallora_league_collection_options)<>0
   or (select count(*) from public.rallora_league_non_cash_prizes)<>0 then
    raise exception 'B owner leaked A collection/prize drafts';
 end if;
end $$;

rollback;

do $$
begin
 if has_table_privilege('anon','public.rallora_league_collection_options','SELECT')
    or has_table_privilege('anon','public.rallora_league_non_cash_prizes','SELECT') then
    raise exception 'Anonymous read financial setup drafts';
 end if;
end $$;
