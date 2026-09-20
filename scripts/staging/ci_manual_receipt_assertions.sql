-- Fake, disposable manual bank/cash receipt tests only.
begin;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000a01';
insert into public.rallora_league_entry_rules (
  id,club_id,season_id,created_by,fee_pence
) values (
 '00000000-0000-0000-0000-0000000009a1',
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-000000000a01',2500
);
insert into public.rallora_league_collection_options (
 id,club_id,season_id,rules_id,created_by,method
) values (
 '00000000-0000-0000-0000-0000000007a1',
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000009a1',
 '00000000-0000-0000-0000-000000000a01','bank_transfer'
);
reset role;
insert into public.rallora_league_paid_registrations (
 id,club_id,season_id,rules_id,team_id,
 entry_unit,currency,fee_snapshot_pence
) values (
 '00000000-0000-0000-0000-0000000008a2',
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000009a1',
 '00000000-0000-0000-0000-0000000003a1',
 'team','GBP',2500
);

-- Even the trusted backend cannot verify an unapproved payment method.
do $$
begin
 insert into public.rallora_league_manual_receipt_events (
   club_id,season_id,registration_id,option_id,
   kind,amount_pence,currency,receipt_fingerprint,verified_by
 ) values (
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000008a2',
 '00000000-0000-0000-0000-0000000007a1',
 'captured',2500,'GBP',repeat('a',64),
 '00000000-0000-0000-0000-000000000a01'
 );
 raise exception 'Receipt created before method approval';
exception when check_violation then null;
end $$;

update public.rallora_league_collection_options set status='approved'
where id='00000000-0000-0000-0000-0000000007a1';

insert into public.rallora_league_manual_receipt_events (
 id,club_id,season_id,registration_id,option_id,
 kind,amount_pence,currency,receipt_fingerprint,verified_by
) values (
 '00000000-0000-0000-0000-0000000006a2',
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000008a2',
 '00000000-0000-0000-0000-0000000007a1',
 'captured',2500,'GBP',repeat('a',64),
 '00000000-0000-0000-0000-000000000a01'
);

-- A replayed bank receipt cannot be counted twice.
do $$
begin
 insert into public.rallora_league_manual_receipt_events (
   club_id,season_id,registration_id,option_id,
   kind,amount_pence,currency,receipt_fingerprint,verified_by
 ) values (
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000008a2',
 '00000000-0000-0000-0000-0000000007a1',
 'captured',2500,'GBP',repeat('a',64),
 '00000000-0000-0000-0000-000000000a01'
 );
 raise exception 'Duplicate manual receipt accepted';
exception when unique_violation then null;
end $$;

do $$
begin
 insert into public.rallora_league_manual_receipt_events (
   club_id,season_id,registration_id,option_id,
   kind,amount_pence,currency,receipt_fingerprint,verified_by
 ) values (
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000008a2',
 '00000000-0000-0000-0000-0000000007a1',
 'captured',2500,'GBP',repeat('c',64),
 '00000000-0000-0000-0000-000000000b01'
 );
 raise exception 'Other club owner verified A receipt';
exception when check_violation then null;
end $$;

do $$
begin
 insert into public.rallora_league_manual_receipt_events (
   club_id,season_id,registration_id,option_id,
   kind,amount_pence,currency,receipt_fingerprint,verified_by
 ) values (
 '00000000-0000-0000-0000-0000000000b2',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000008a2',
 '00000000-0000-0000-0000-0000000007a1',
 'captured',2500,'GBP',repeat('d',64),
 '00000000-0000-0000-0000-000000000a01'
 );
 raise exception 'Other club claimed A receipt';
exception when foreign_key_violation then null;
end $$;

-- An append-only reversal must reference a matching original receipt.
insert into public.rallora_league_manual_receipt_events (
 id,club_id,season_id,registration_id,option_id,
 kind,related_event_id,amount_pence,currency,receipt_fingerprint,verified_by
) values (
 '00000000-0000-0000-0000-0000000006a3',
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000008a2',
 '00000000-0000-0000-0000-0000000007a1',
 'reversed','00000000-0000-0000-0000-0000000006a2',
 2500,'GBP',repeat('b',64),
 '00000000-0000-0000-0000-000000000a01'
);

do $$
begin
 update public.rallora_league_manual_receipt_events
 set amount_pence=0 where id='00000000-0000-0000-0000-0000000006a2';
 raise exception 'Receipt audit entry overwritten';
exception when check_violation then null;
end $$;
do $$
begin
 delete from public.rallora_league_manual_receipt_events
 where id='00000000-0000-0000-0000-0000000006a2';
 raise exception 'Receipt audit entry deleted';
exception when check_violation then null;
end $$;

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000a01';
do $$
begin
 if has_table_privilege('authenticated',
   'public.rallora_league_manual_receipt_events','INSERT') then
   raise exception 'Browser may forge bank receipt';
 end if;
 if (select count(*) from public.rallora_league_manual_receipt_events)<>2 then
   raise exception 'Club owner cannot inspect own audit';
 end if;
end $$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000a02';
do $$
begin
 if (select count(*) from public.rallora_league_manual_receipt_events)<>0 then
   raise exception 'Suspended user can inspect club financial audit';
 end if;
end $$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000b01';
do $$
begin
 if (select count(*) from public.rallora_league_manual_receipt_events)<>0 then
   raise exception 'Club B can inspect club A manual receipts';
 end if;
end $$;
rollback;
