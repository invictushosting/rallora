-- Synthetic signup acceptance regressions. CI PostgreSQL only; NEVER production.
-- A signup event is recorded only for explicit, exact-version metadata on INSERT.
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000905','missing-ack@example.test','{}'),
('00000000-0000-0000-0000-000000000906','false-ack@example.test','{"terms_accepted":false,"terms_version":"draft-2026-10-27"}'),
('00000000-0000-0000-0000-000000000907','wrong-version@example.test','{"terms_accepted":true,"terms_version":"unknown"}'),
('00000000-0000-0000-0000-000000000908','explicit-ack@example.test','{"terms_accepted":true,"terms_version":"draft-2026-10-27"}');

do $$
declare events integer;
begin
 select count(*) into events from rallora_private.player_terms_acceptance_events
 where user_id in (
 '00000000-0000-0000-0000-000000000905',
 '00000000-0000-0000-0000-000000000906',
 '00000000-0000-0000-0000-000000000907'
 );
 if events<>0 then raise exception 'Signup ledger contains missing/false/wrong-version declarations'; end if;

 select count(*) into events from rallora_private.player_terms_acceptance_events
 where user_id='00000000-0000-0000-0000-000000000908'
 and terms_version='draft-2026-10-27';
 if events<>1 then raise exception 'Explicit signup acceptance was not recorded exactly once'; end if;
end $$;

-- Metadata can change after registration; changes must not backfill assent evidence.
update auth.users set raw_user_meta_data='{"terms_accepted":true,"terms_version":"draft-2026-10-27"}'
 where id='00000000-0000-0000-0000-000000000905';

do $$
begin
 if exists(select 1 from rallora_private.player_terms_acceptance_events
 where user_id='00000000-0000-0000-0000-000000000905') then
  raise exception 'Post-signup user metadata update fabricated acceptance event';
 end if;
end $$;

-- The timestamp must originate from DB, not supplied browser time.
do $$
declare accepted timestamptz;
begin
 select accepted_at into accepted from rallora_private.player_terms_acceptance_events
 where user_id='00000000-0000-0000-0000-000000000908';
 if accepted is null or accepted > transaction_timestamp()+interval '5 seconds' or
 accepted < transaction_timestamp()-interval '5 minutes'
 then raise exception 'DB-generated timestamp missing/outside synthetic test window'; end if;
end $$;
\echo PASS: exact-version, opt-in-only, insert-only signup ledger behaviour
