-- Recovered from the production migration ledger; already applied.
alter table public.clubs add column if not exists booking_url text;
