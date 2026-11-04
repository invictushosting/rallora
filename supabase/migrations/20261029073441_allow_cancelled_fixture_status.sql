-- Recovered from the production migration ledger; already applied.
alter table public.fixtures drop constraint fixtures_status_check; alter table public.fixtures add constraint fixtures_status_check check (status = any(array['open'::text,'submitted'::text,'confirmed'::text,'disputed'::text,'forfeit'::text,'double_forfeit'::text,'cancelled'::text]));
