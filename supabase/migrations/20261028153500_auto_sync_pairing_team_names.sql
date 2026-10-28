begin;

-- Keep the stored team label aligned with current player slots whenever a
-- roster name changes (swap, standby assignment, removal or direct admin edit).
-- A manual team label is left alone until a player actually changes.
create function rallora_private.sync_pairing_team_name() returns trigger
language plpgsql set search_path = '' as $fn$
declare
  first_name text := nullif(btrim(new.player_one_name), '');
  second_name text := nullif(btrim(new.player_two_name), '');
  current_label text;
begin
  if new.player_one_name is not distinct from old.player_one_name
     and new.player_two_name is not distinct from old.player_two_name then
    return new;
  end if;

  current_label := case
    when first_name is null and second_name is null then
      'Players to be confirmed (' || left(new.id::text, 8) || ')'
    else coalesce(first_name, 'Player to be confirmed') ||
         ' / ' || coalesce(second_name, 'Player to be confirmed')
  end;

  -- teams has a unique (division_id, name) key. An old custom label in
  -- another row must not prevent a valid player movement.
  if exists (
    select 1 from public.teams t
    where t.division_id = new.division_id and t.id <> new.id
      and t.name = current_label
  ) then
    current_label := current_label || ' (' || left(new.id::text, 8) || ')';
  end if;

  new.name := current_label;
  return new;
end $fn$;
revoke all on function rallora_private.sync_pairing_team_name()
  from public, anon, authenticated;
create trigger sync_pairing_team_name
  before update of player_one_name, player_two_name on public.teams
  for each row
  when (old.player_one_name is distinct from new.player_one_name
        or old.player_two_name is distinct from new.player_two_name)
  execute function rallora_private.sync_pairing_team_name();

-- Approved application summaries are also shown in admin and invitation
-- workflows. Keep their stored names in step with the actual team label.
-- This remains internal to writes already authorised on teams.
create function rallora_private.sync_application_pairing_name() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  update public.rallora_team_applications a
  set team_name = new.name, updated_at = now()
  where a.created_team_id = new.id
    and a.status = 'approved'
    and a.team_name is distinct from new.name;
  return new;
end $fn$;
revoke all on function rallora_private.sync_application_pairing_name()
  from public, anon, authenticated;
create trigger sync_application_pairing_name
  after update on public.teams
  for each row when (old.name is distinct from new.name)
  execute function rallora_private.sync_application_pairing_name();

commit;
