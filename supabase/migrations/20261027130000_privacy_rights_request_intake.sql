-- Draft GDPR rights request intake; deploy only after testing and operational review.
-- Requests require authenticated accounts; non-account holders may contact support@rallora.app.
create table if not exists public.rallora_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  request_type text not null check (request_type in ('access','rectification','erasure','portability','restriction','objection','other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'received' check (status in ('received','identity_check','in_review','completed','declined')),
  internal_notes text,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  closed_at timestamptz
);
create index if not exists rallora_privacy_requests_user_time
  on public.rallora_privacy_requests(user_id,created_at desc);
alter table public.rallora_privacy_requests enable row level security;
revoke all on public.rallora_privacy_requests from anon;
revoke all on public.rallora_privacy_requests from authenticated;
grant select (id,user_id,request_type,details,status,created_at,updated_at,closed_at)
  on public.rallora_privacy_requests to authenticated;
grant insert (user_id,request_type,details)
  on public.rallora_privacy_requests to authenticated;

create policy "privacy requestor reads own requests"
  on public.rallora_privacy_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy "privacy requestor creates own request"
  on public.rallora_privacy_requests for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Platform administrators process requests via approved, separately secured
-- back-office access. No browser-admin SELECT of private internal notes.
comment on table public.rallora_privacy_requests is
  'Rights-request intake only. Requests do not automatically delete accounts; verify identity, scope and retention exceptions first.';
