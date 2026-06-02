-- GSM Padel League Hub admin auth + write policies
-- 1) Create an Auth user first in Supabase: Authentication > Users > Add user
-- 2) Replace the email below, then run this whole file in SQL Editor.

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users
for select
to authenticated
using (id = auth.uid() or public.is_admin());

-- Replace this email with your Supabase Auth admin user email before running.
insert into public.admin_users (id, email, role)
select id, email, 'owner'
from auth.users
where email = 'gsm@test.com'
on conflict (id) do update set email = excluded.email, role = excluded.role;

-- Admin write policies for league tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'seasons',
    'divisions',
    'players',
    'team_players',
    'teams',
    'fixtures',
    'results',
    'announcements',
    'sponsors',
    'standings'
  ]
  loop
    execute format('drop policy if exists "Admins can insert %I" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Admins can update %I" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Admins can delete %I" on public.%I', table_name, table_name);

    execute format('create policy "Admins can insert %I" on public.%I for insert to authenticated with check (public.is_admin())', table_name, table_name);
    execute format('create policy "Admins can update %I" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
    execute format('create policy "Admins can delete %I" on public.%I for delete to authenticated using (public.is_admin())', table_name, table_name);
  end loop;
end $$;

notify pgrst, 'reload schema';
