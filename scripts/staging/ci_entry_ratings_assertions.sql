-- Synthetic, rolled-back checks: permissions, decimal corrections and approved team consistency.
begin;
do $test$
declare
  c uuid := '00000000-0000-0000-0000-0000000000a1';
  s uuid := gen_random_uuid(); d uuid := gen_random_uuid(); u uuid := gen_random_uuid();
  a uuid; t uuid; v timestamptz; denied boolean; who text; rating numeric;
begin
  insert into auth.users(id,email) values(u,'rating-test@example.invalid');
  insert into public.seasons(id,club_id,name,status,starts_on,ends_on)
    values(s,c,'Synthetic ratings','draft','2026-11-01','2026-11-30');
  insert into public.divisions(id,season_id,name,sort_order) values(d,s,'Ratings box',1);
  insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,captain_playtomic_rating,partner_playtomic_rating)
    values(c,s,u,'Alpha / Beta','Alpha','Beta',8,7) returning id,updated_at into a,v;

  foreach who in array array['','00000000-0000-0000-0000-000000000b01','00000000-0000-0000-0000-000000000a02',u::text] loop
    perform set_config('request.jwt.claim.sub',who,true);
    denied:=false;
    begin perform public.rallora_admin_update_entry_ratings(a,0.8,0.8,v);
    exception when raise_exception then denied:=true; end;
    if not denied then raise exception 'Unprivileged caller edited ratings'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a01',true);
  foreach rating in array array[-0.1,7.1,0.801,'NaN'::numeric] loop
    denied:=false;
    begin perform public.rallora_admin_update_entry_ratings(a,rating,0.8,v);
    exception when raise_exception then denied:=true; end;
    if not denied then raise exception 'Invalid rating accepted'; end if;
  end loop;
  denied:=false;
  begin perform public.rallora_admin_update_entry_ratings(a,0.8,0.8,v-interval '1 second');
  exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'Stale edit accepted'; end if;
  perform public.rallora_admin_update_entry_ratings(a,0.8,0.8,v);
  if not exists(select 1 from public.rallora_team_applications where id=a and status='pending'
    and captain_playtomic_rating=0.8 and partner_playtomic_rating=0.8 and organiser_note like '%Ratings corrected%') then
    raise exception 'Pending decimal correction or audit failed';
  end if;
  select updated_at into v from public.rallora_team_applications where id=a;
  insert into public.teams(division_id,name,player_one_name,player_two_name)
    values(d,'Alpha / Beta','Alpha','Beta') returning id into t;
  update public.rallora_team_applications set created_team_id=t,status='approved',division_id=d where id=a;
  insert into public.rallora_team_member_invites(team_application_id,club_id,season_id,division_id,team_id,invited_name,invited_email,playtomic_rating)
    values(a,c,s,d,t,'Beta','rating-beta@example.invalid',0.8);
  perform public.rallora_admin_update_entry_ratings(a,0,0.85,v);
  if not exists(select 1 from public.teams where id=t and division_id=d and player_one_rating=0
    and player_two_rating=0.85 and player_one_rating_source='manual' and player_two_rating_source='manual')
    or not exists(select 1 from public.rallora_team_member_invites where team_application_id=a and playtomic_rating=0.85) then
    raise exception 'Approved team and invite ratings did not agree';
  end if;
  update public.rallora_team_applications set status='declined' where id=a;
  denied:=false;
  begin perform public.rallora_admin_update_entry_ratings(a,0.8,0.8,v);
  exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'Closed application edited'; end if;
  if has_function_privilege('anon','public.rallora_admin_update_entry_ratings(uuid,numeric,numeric,timestamptz)','execute') then
    raise exception 'Anonymous execution granted';
  end if;
end $test$;
rollback;
