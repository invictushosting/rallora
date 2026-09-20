-- Disposable two-club prize-pot synthetic tests, not a payment processor.
begin;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';
insert into public.rallora_league_entry_rules (
 id,club_id,season_id,created_by,currency,entry_unit,fee_pence,
 pot_mode,prize_share_percent,winner_percent,runner_up_percent
) values (
 '00000000-0000-0000-0000-0000000009a1',
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-000000000a01',
 'GBP','team',2500,'entry_percentage',80,60,30
);

do $$
begin
 if (select count(*) from public.rallora_league_entry_rules)<>1 then
   raise exception 'A owner could not see A prize plan';
 end if;
 if has_table_privilege('authenticated',
    'public.rallora_league_payment_events','INSERT')
    or has_table_privilege('authenticated',
    'public.rallora_league_paid_registrations','INSERT')
    or has_table_privilege('authenticated',
    'public.rallora_league_prize_awards','INSERT') then
    raise exception 'Browser could invent entry receipts or prize payouts';
 end if;
end $$;

-- A owner cannot link B season to their own club or publish terms directly.
do $$
begin
 insert into public.rallora_league_entry_rules (
  club_id,season_id,created_by,fee_pence
 ) values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000001b2',
  '00000000-0000-0000-0000-000000000a01',2000
 );
 raise exception 'Cross-club financial season was accepted';
exception when foreign_key_violation then null;
end $$;

do $$
begin
 update public.rallora_league_entry_rules set status='published'
 where id='00000000-0000-0000-0000-0000000009a1';
 raise exception 'Browser published unapproved entry/payment terms';
exception when insufficient_privilege then null;
end $$;

do $$
begin
 update public.rallora_league_entry_rules
 set club_id='00000000-0000-0000-0000-0000000000b2'
 where id='00000000-0000-0000-0000-0000000009a1';
 raise exception 'Browser reassigned entry terms to another club';
exception when insufficient_privilege then null;
end $$;

do $$
begin
 insert into public.rallora_league_entry_rules (
  club_id,season_id,created_by,winner_percent,runner_up_percent
 ) values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000001a1',
  '00000000-0000-0000-0000-000000000a01',80,40
 );
 raise exception 'Invalid prize split was accepted';
exception when check_violation then null;
end $$;

-- Another A organiser sees terms but cannot change somebody else's draft.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a03';
do $$
declare affected integer;
begin
 if (select count(*) from public.rallora_league_entry_rules)<>1 then
   raise exception 'A admin should see A season terms';
 end if;
 update public.rallora_league_entry_rules set fee_pence=1000
 where id='00000000-0000-0000-0000-0000000009a1';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Other admin edited A owner draft'; end if;
 delete from public.rallora_league_entry_rules
 where id='00000000-0000-0000-0000-0000000009a1';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Other admin deleted A owner draft'; end if;
end $$;

-- Suspended A member cannot access draft financial terms.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';
do $$
begin
 if (select count(*) from public.rallora_league_entry_rules)<>0 then
   raise exception 'Suspended user saw A financial terms';
 end if;
end $$;

-- Club B owner cannot see A plan.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';
do $$
begin
 if (select count(*) from public.rallora_league_entry_rules)<>0 then
   raise exception 'B owner saw A paid entry configuration';
 end if;
end $$;
insert into public.rallora_league_entry_rules (
  id,club_id,season_id,created_by,pot_mode,fee_pence
) values (
 '00000000-0000-0000-0000-0000000009b2',
 '00000000-0000-0000-0000-0000000000b2',
 '00000000-0000-0000-0000-0000000001b2',
 '00000000-0000-0000-0000-000000000b01',
 'no_prize',0
);

reset role;
-- Simulated trusted backend only, still inside an ephemeral rollback.
insert into public.rallora_league_paid_registrations (
  id,club_id,season_id,rules_id,team_id,entry_unit,currency,fee_snapshot_pence
) values (
 '00000000-0000-0000-0000-0000000008a2',
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000009a1',
 '00000000-0000-0000-0000-0000000003a1',
 'team','GBP',2500
);
do $$
begin
 insert into public.rallora_league_paid_registrations (
  club_id,season_id,rules_id,team_id,entry_unit,currency,fee_snapshot_pence
 ) values (
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000009a1',
 '00000000-0000-0000-0000-0000000003b1',
 'team','GBP',2500
 );
 raise exception 'B team entered A paid competition';
exception when check_violation then null;
end $$;
insert into public.rallora_league_payment_events (
 club_id,season_id,registration_id,event_type,amount_pence,currency,
 provider,provider_event_id
) values (
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000008a2',
 'captured',2500,'GBP','ci_mock','fake_event_0001'
);
do $$
begin
 insert into public.rallora_league_payment_events (
 club_id,season_id,registration_id,event_type,amount_pence,currency,
 provider,provider_event_id
 ) values (
 '00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000008a2',
 'captured',2500,'GBP','ci_mock','fake_event_0001'
 );
 raise exception 'Duplicate payment webhook accepted';
exception when unique_violation then null;
end $$;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';
do $$
begin
 if (select count(*) from public.rallora_league_paid_registrations)<>0
    or (select count(*) from public.rallora_league_payment_events)<>0 then
   raise exception 'B owner saw A registration or financial events';
 end if;
end $$;

rollback;

-- No anonymous browser can inspect unpublished budget plans or receipts.
do $$
begin
 if has_table_privilege('anon','public.rallora_league_entry_rules','SELECT')
  or has_table_privilege('anon','public.rallora_league_payment_events','SELECT')
  or has_table_privilege('anon','public.rallora_league_prize_awards','SELECT') then
    raise exception 'Anonymous leaked financial planning or receipts';
 end if;
end $$;
