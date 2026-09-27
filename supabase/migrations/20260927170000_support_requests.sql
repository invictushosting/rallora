create table if not exists public.rallora_support_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  requester_name text,
  requester_email text not null,
  category text not null check (category in ('bug','general_help','registration','billing','feature_request','other')),
  subject text not null,
  message text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'new' check (status in ('new','in_progress','waiting','resolved','closed')),
  assignee text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rallora_support_requests enable row level security;
create policy "platform admins manage support requests" on public.rallora_support_requests for all to authenticated
using (exists(select 1 from public.rallora_platform_admins a where a.user_id=auth.uid()))
with check (exists(select 1 from public.rallora_platform_admins a where a.user_id=auth.uid()));
create policy "users create support requests" on public.rallora_support_requests for insert to authenticated
with check (user_id=auth.uid());
create policy "users view own support requests" on public.rallora_support_requests for select to authenticated
using (user_id=auth.uid() or exists(select 1 from public.rallora_platform_admins a where a.user_id=auth.uid()));
