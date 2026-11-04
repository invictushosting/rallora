-- The support workspace migration revoked schema USAGE from authenticated.
-- Existing SECURITY INVOKER RPC wrappers and fixture message RLS policies
-- need this to resolve their explicitly granted private functions.
-- This restores the original authenticated grant; it adds no table privileges,
-- function EXECUTE privileges, schema CREATE privilege or anonymous access.
grant usage on schema rallora_private to authenticated;
