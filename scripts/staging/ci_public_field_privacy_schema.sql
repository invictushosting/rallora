-- CI-only fidelity for the legacy fixture court field present in production.
alter table public.fixtures add column if not exists court text;
