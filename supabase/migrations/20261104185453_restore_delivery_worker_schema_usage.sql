-- Restore the existing delivery worker contract revoked by the support update.
-- app/api/internal/deliveries uses the anon database role and a separate secret
-- worker token. Both callable implementations check the token before queue access.
-- This is only schema lookup permission: it adds no function/table/CREATE grants.
-- Anonymous users still cannot execute fixture-chat or support-admin functions.
grant usage on schema rallora_private to anon;
