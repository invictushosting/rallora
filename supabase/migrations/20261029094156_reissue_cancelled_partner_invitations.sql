-- Keep cancelled links as history while allowing one current invitation per entry.
begin;
alter table public.rallora_team_member_invites
 drop constraint rallora_team_member_invites_team_application_id_key;
create unique index rallora_team_member_invites_current_application
 on public.rallora_team_member_invites(team_application_id) where status <> 'cancelled';
commit;
