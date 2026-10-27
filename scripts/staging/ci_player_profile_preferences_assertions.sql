begin;
-- Synthetic regression checks. Rolled back after every run.
do $$
declare
  v_user uuid:='11111111-1111-1111-1111-111111111111';
  v_club uuid:='00000000-0000-0000-0000-0000000000a1';
  rejected boolean;
begin
  insert into public.rallora_player_profiles(user_id,display_name,playing_level,home_town,preferred_club_ids,partner_preference)
  values(v_user,'Standalone player','intermediate','Manchester',array[v_club],'looking')
  on conflict(user_id) do update set display_name=excluded.display_name,playing_level=excluded.playing_level,
    home_town=excluded.home_town,preferred_club_ids=excluded.preferred_club_ids,partner_preference=excluded.partner_preference;
  if not exists(select 1 from public.rallora_player_profiles where user_id=v_user and playing_level='intermediate'
    and home_town='Manchester' and v_club=any(preferred_club_ids) and partner_preference='looking') then
    raise exception 'Player preferences did not persist';
  end if;
  rejected:=false;
  begin
    update public.rallora_player_profiles set playing_level='elite' where user_id=v_user;
  exception when check_violation then rejected:=true; end;
  if not rejected then raise exception 'Unknown playing level accepted'; end if;
  rejected:=false;
  begin
    update public.rallora_player_profiles set partner_preference='publish_publicly' where user_id=v_user;
  exception when check_violation then rejected:=true; end;
  if not rejected then raise exception 'Unknown partner preference accepted'; end if;
  rejected:=false;
  begin
    update public.rallora_player_profiles set preferred_club_ids=array_fill(v_club,array[11]) where user_id=v_user;
  exception when check_violation then rejected:=true; end;
  if not rejected then raise exception 'More than ten clubs accepted'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='rallora_player_profiles'
    and policyname='player_profile_self') then raise exception 'Owner-only profile policy missing'; end if;
  if has_table_privilege('anon','public.rallora_player_profiles','SELECT') then
    raise exception 'Anonymous access to player profiles'; end if;
end $$;
rollback;