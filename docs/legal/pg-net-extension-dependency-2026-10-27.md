# pg_net extension dependency review — 27 October 2026

Read-only review of the production Supabase database.

## Verified dependency
The private-schema routine `rallora_private.communication_tick()` calls `net.http_post` to deliver queued Rallora communications through the application's internal deliveries endpoint. The routine reads the outbound bearer token from `rallora_private.delivery_worker_config`; no secret value was fetched in this audit.

## Security implications
- Supabase's `extension_in_public` adviser warns that `pg_net` is installed in `public`.
- Moving or dropping `pg_net` without updating the dependent job could disrupt scheduled fixture reminders and club communications.
- A migration should first enumerate callers, extension-owned objects, grants, scheduler jobs, and verify the target schema and supported relocation method.
- After the change, test the actual scheduled `communication_tick` workflow, outbound delivery, retry behaviour, and authentication. Verify `rallora_private.delivery_worker_config` remains unreadable by web clients.
- Avoid logging or exposing the configured bearer token in tests, CI logs or documentation.

## Status
No extension modification was attempted. Keep the warning open pending a staged migration and communications regression test.
