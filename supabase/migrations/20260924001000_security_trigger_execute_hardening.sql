-- Remove API execute access from trigger-only SECURITY DEFINER functions.
begin;
revoke all on function public.rallora_notify_registration_change() from public,anon,authenticated;
-- Feature entitlement lookup is intentionally public for public club feature presentation.
-- It returns only a boolean entitlement state and does not mutate data.
commit;