-- Synthetic privacy database fixture only. Never connect this script to production.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
grant usage on schema auth to authenticated;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table public.rallora_platform_admins (user_id uuid primary key references auth.users(id));
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000901','admin@example.test','{}'),
 ('00000000-0000-0000-0000-000000000902','player@example.test','{}');
insert into public.rallora_platform_admins(user_id)
 values ('00000000-0000-0000-0000-000000000901');

-- CI-only worker configuration. No production token or email credentials.
create schema if not exists rallora_private;
create table rallora_private.delivery_worker_config(singleton boolean primary key default true,token text);
insert into rallora_private.delivery_worker_config(singleton,token)
values (true,repeat('a',64));
