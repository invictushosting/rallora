begin;
create table if not exists public.rallora_pilot_enquiries (
 id uuid primary key default gen_random_uuid(),
 club_name text not null check (char_length(trim(club_name)) between 2 and 200),
 contact_name text not null check (char_length(trim(contact_name)) between 2 and 200),
 contact_email text not null check (char_length(trim(contact_email)) between 3 and 320),
 contact_phone text,
 club_location text not null check (char_length(trim(club_location)) between 2 and 200),
 court_count integer check (court_count is null or court_count between 1 and 100),
 enquiry_type text not null default 'pilot' check (enquiry_type in ('pilot','information')),
 message text check (message is null or char_length(message)<=1500),
 status text not null default 'new' check (status in ('new','contacted','qualified','closed')),
 created_at timestamptz not null default now()
);
alter table public.rallora_pilot_enquiries enable row level security;
drop policy if exists "public can submit pilot enquiries" on public.rallora_pilot_enquiries;
create policy "public can submit pilot enquiries" on public.rallora_pilot_enquiries for insert to anon,authenticated with check (status='new');
grant insert on public.rallora_pilot_enquiries to anon,authenticated;
revoke select,update,delete on public.rallora_pilot_enquiries from anon,authenticated;
commit;
