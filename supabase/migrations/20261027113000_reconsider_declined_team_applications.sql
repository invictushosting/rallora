-- Club-admin-only reversal of rejected team applications.
-- Safe to run again: CREATE OR REPLACE keeps the function idempotent.
create or replace function public.rallora_reconsider_team_application(p_application_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_app public.rallora_team_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authorised'; end if;
  select * into v_app from public.rallora_team_applications where id=p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if not public.rallora_can_manage_club(v_app.club_id) then raise exception 'Not authorised'; end if;
  if v_app.status <> 'declined' then raise exception 'Only declined applications can be reconsidered'; end if;
  if v_app.created_team_id is not null then raise exception 'Application already has a team'; end if;
  update public.rallora_team_applications
  set status='pending', reviewed_by=null, reviewed_at=null,
      organiser_note=left(concat_ws(E'\n',nullif(organiser_note,''),
        'Reopened by club admin on ' || to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI') || ' UTC'),1000),
      updated_at=now()
  where id=p_application_id;
  return true;
end
$fn$;
revoke all on function public.rallora_reconsider_team_application(uuid) from public, anon;
grant execute on function public.rallora_reconsider_team_application(uuid) to authenticated;
