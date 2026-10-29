-- Recovered from the production migration ledger; already applied.
begin;
-- RLS does not constrain TRUNCATE. Grant only the SELECT access used by browsers.
revoke all on public.rallora_club_integrations, public.rallora_integration_secrets,
 public.rallora_playtomic_bookings, public.rallora_playtomic_player_links from public, anon, authenticated;
grant select on public.rallora_club_integrations, public.rallora_playtomic_bookings,
 public.rallora_playtomic_player_links to authenticated;
grant all on public.rallora_club_integrations, public.rallora_integration_secrets,
 public.rallora_playtomic_bookings, public.rallora_playtomic_player_links to service_role;

-- Atomic, persistent throttling works across serverless instances.
create table public.rallora_integration_request_limits (
 scope text primary key check (length(scope) between 1 and 200),
 next_allowed_at timestamptz not null,
 updated_at timestamptz not null default now()
);
alter table public.rallora_integration_request_limits enable row level security;
revoke all on public.rallora_integration_request_limits from public, anon, authenticated;
grant all on public.rallora_integration_request_limits to service_role;
create function public.rallora_claim_integration_request(p_scope text,p_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare claimed text;
begin
 if p_seconds not between 1 and 86400 or p_scope is null or length(p_scope) not between 1 and 200 then
  raise exception 'Invalid request limit';
 end if;
 delete from public.rallora_integration_request_limits where updated_at < now()-interval '30 days';
 insert into public.rallora_integration_request_limits(scope,next_allowed_at)
 values(p_scope,now()+make_interval(secs=>p_seconds))
 on conflict(scope) do update set next_allowed_at=excluded.next_allowed_at,updated_at=now()
 where public.rallora_integration_request_limits.next_allowed_at <= now()
 returning scope into claimed;
 return claimed is not null;
end $$;
revoke all on function public.rallora_claim_integration_request(text,integer) from public,anon,authenticated;
grant execute on function public.rallora_claim_integration_request(text,integer) to service_role;
commit;

