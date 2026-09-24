-- Prevent duplicate active registration states for the same player/team.
begin;
create unique index if not exists rallora_registration_one_active_team_idx
on public.rallora_team_registration_requests(team_id,player_user_id)
where status in ('pending','approved');
commit;