alter table public.rallora_pilot_enquiries
  add column if not exists source text not null default 'website',
  add column if not exists assignee text,
  add column if not exists internal_notes text,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists lost_reason text,
  add column if not exists linked_club_id uuid references public.clubs(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.rallora_pilot_enquiries drop constraint if exists rallora_pilot_enquiries_status_check;
alter table public.rallora_pilot_enquiries
  add constraint rallora_pilot_enquiries_status_check
  check (status in ('new','contacted','meeting','nurture','qualified','won','lost','closed'));

create table if not exists public.rallora_enquiry_activities (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.rallora_pilot_enquiries(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  activity_type text not null check (activity_type in ('note','status_change','contact','meeting','follow_up','won','lost')),
  detail text,
  created_at timestamptz not null default now()
);
alter table public.rallora_enquiry_activities enable row level security;
drop policy if exists "platform admins manage enquiry activities" on public.rallora_enquiry_activities;
create policy "platform admins manage enquiry activities" on public.rallora_enquiry_activities for all to authenticated
using (exists(select 1 from public.rallora_platform_admins a where a.user_id=auth.uid()))
with check (exists(select 1 from public.rallora_platform_admins a where a.user_id=auth.uid()));
grant select,insert,update,delete on public.rallora_enquiry_activities to authenticated;