-- Only the production fields needed by the reminder tests, in an isolated CI database.
alter table public.clubs add column if not exists email_sender_name text,add column if not exists logo_url text,add column if not exists primary_color text,add column if not exists contact_email text;
create table if not exists public.rallora_playtomic_bookings(id uuid primary key default gen_random_uuid(),matched_fixture_id uuid,match_state text,matched_player_count integer,booking_status text,starts_at timestamptz,ends_at timestamptz,last_synced_at timestamptz default now());

alter table public.fixtures add column if not exists arrangement_status text default 'not_arranged',add column if not exists booking_starts_at timestamptz,add column if not exists booking_ends_at timestamptz,add column if not exists booking_court text,add column if not exists booking_type text,add column if not exists booking_matched_players integer;
