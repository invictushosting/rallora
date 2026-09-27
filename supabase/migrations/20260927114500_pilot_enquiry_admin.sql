begin;
drop policy if exists "platform admins can read pilot enquiries" on public.rallora_pilot_enquiries;
create policy "platform admins can read pilot enquiries" on public.rallora_pilot_enquiries for select to authenticated using (exists(select 1 from public.rallora_platform_admins a where a.user_id=auth.uid()));
drop policy if exists "platform admins can update pilot enquiries" on public.rallora_pilot_enquiries;
create policy "platform admins can update pilot enquiries" on public.rallora_pilot_enquiries for update to authenticated using (exists(select 1 from public.rallora_platform_admins a where a.user_id=auth.uid())) with check (exists(select 1 from public.rallora_platform_admins a where a.user_id=auth.uid()));
grant select,update on public.rallora_pilot_enquiries to authenticated;
commit;
