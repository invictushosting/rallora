create or replace function public.rallora_review_team_application(p_application_id uuid,p_decision text,p_division_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.rallora_team_applications%rowtype; v_team uuid; v_request uuid; v_invite uuid; v_slug text; v_season uuid; v_club uuid;
begin
 select season_id,club_id into v_season,v_club from public.rallora_team_applications where id=p_application_id;
 if v_season is null then raise exception 'Application not found'; end if;
 if auth.uid() is null or not public.rallora_can_manage_club(v_club) then raise exception 'Not authorised'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_season::text,0));
 if p_decision not in ('approved','declined') then raise exception 'Invalid decision'; end if;
 select * into a from public.rallora_team_applications where id=p_application_id for update;
 if not found then raise exception 'Application not found'; end if;
 if not public.rallora_can_manage_club(a.club_id) then raise exception 'Not authorised'; end if;
 if a.status<>'pending' then raise exception 'Application already reviewed'; end if;

 if p_decision='approved' then
   if p_division_id is null or not exists(select 1 from public.divisions d where d.id=p_division_id and d.season_id=a.season_id) then
     raise exception 'Choose a valid division for this season';
   end if;
   if nullif(trim(a.partner_email),'') is null then
     raise exception 'Partner email is required before approving this team';
   end if;

   insert into public.teams(division_id,name,player_one_name,player_two_name,player_one_rating,player_two_rating,is_active)
   values(p_division_id,trim(a.team_name),trim(a.captain_name),trim(a.partner_name),a.captain_playtomic_rating,a.partner_playtomic_rating,true)
   returning id into v_team;

   insert into public.rallora_team_registration_requests(
     club_id,season_id,division_id,team_id,player_user_id,player_name,player_phone,status,reviewed_by,reviewed_at)
   values(a.club_id,a.season_id,p_division_id,v_team,a.requested_by,a.captain_name,a.captain_phone,'approved',auth.uid(),now())
   returning id into v_request;

   insert into public.rallora_team_roster_memberships(
     registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by)
   values(v_request,a.club_id,a.season_id,p_division_id,v_team,a.requested_by,'captain',auth.uid())
   on conflict(team_id,player_user_id) do update set role='captain';

   update public.rallora_player_profiles
   set playtomic_rating=a.captain_playtomic_rating,updated_at=now()
   where user_id=a.requested_by;

   insert into public.rallora_team_member_invites(
     team_application_id,club_id,season_id,division_id,team_id,invited_name,invited_email,playtomic_rating)
   values(a.id,a.club_id,a.season_id,p_division_id,v_team,trim(a.partner_name),lower(trim(a.partner_email)),a.partner_playtomic_rating)
   returning id into v_invite;

   select c.slug into v_slug from public.clubs c where c.id=a.club_id;
   insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
   values(a.requested_by,a.club_id,'team_approved','Your team has been approved',
     trim(a.team_name)||' is live. Your captain access is ready.',
     '/clubs/'||v_slug||'/captain');
 end if;

 update public.rallora_team_applications
 set status=p_decision,
     division_id=case when p_decision='approved' then p_division_id else division_id end,
     reviewed_by=auth.uid(),reviewed_at=now(),created_team_id=v_team,partner_invite_id=v_invite,updated_at=now()
 where id=a.id;
 return v_team;
end $$;
