-- Rallora player account terms acknowledgement ledger (proposed; NOT applied to production).
-- Captures the declaration supplied on initial Supabase Auth sign-up using a DB-generated
-- timestamp; unlike raw_user_meta_data, application users cannot edit or delete the ledger.
-- This does NOT prove that a human read the document, and metadata itself is untrusted
-- input. Publish a final, approved version before enabling any legal enforcement.
begin;

create schema if not exists rallora_private;
revoke all on schema rallora_private from public, anon, authenticated;
grant usage on schema rallora_private to postgres, service_role;

create table if not exists rallora_private.player_terms_acceptance_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default transaction_timestamp(),
  evidence_source text not null default 'auth_signup_metadata',
  constraint player_terms_version_check check (terms_version ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  constraint player_terms_source_check check (evidence_source in ('auth_signup_metadata'))
);
create unique index if not exists player_terms_acceptance_once_per_version
  on rallora_private.player_terms_acceptance_events (user_id, terms_version, evidence_source);
alter table rallora_private.player_terms_acceptance_events enable row level security;
revoke all on rallora_private.player_terms_acceptance_events from public, anon, authenticated;
grant select on rallora_private.player_terms_acceptance_events to service_role;

create or replace function rallora_private.capture_player_terms_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only the expected, published version may be recorded. Avoid falsely
  -- recording an acceptance when there was no explicit opt-in declaration.
  if new.raw_user_meta_data ->> 'terms_accepted' = 'true'
     and new.raw_user_meta_data ->> 'terms_version' = 'draft-2026-10-27' then
    insert into rallora_private.player_terms_acceptance_events
      (user_id, terms_version)
    values (new.id, 'draft-2026-10-27')
    on conflict (user_id, terms_version, evidence_source) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function rallora_private.capture_player_terms_signup() from public, anon, authenticated;
drop trigger if exists rallora_capture_player_terms_signup on auth.users;
create trigger rallora_capture_player_terms_signup
after insert on auth.users
for each row execute function rallora_private.capture_player_terms_signup();

comment on table rallora_private.player_terms_acceptance_events is
  'Append-only-from-app, DB-timestamped account signup declarations, not marketing consent. Existing users and future version renewals need distinct explicit recording process.';
commit;
