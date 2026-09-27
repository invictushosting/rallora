create table if not exists public.rallora_platform_notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('pilot_enquiry','support_request','club_application')),
  notification_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_type, notification_id)
);
alter table public.rallora_platform_notification_reads enable row level security;
create policy "platform admins manage own notification reads"
on public.rallora_platform_notification_reads for all to authenticated
using (user_id=auth.uid() and exists(select 1 from public.rallora_platform_admins a where a.user_id=auth.uid()))
with check (user_id=auth.uid() and exists(select 1 from public.rallora_platform_admins a where a.user_id=auth.uid()));
grant select,insert,delete on public.rallora_platform_notification_reads to authenticated;