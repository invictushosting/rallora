begin;
alter table public.rallora_player_profiles add column if not exists playtomic_email text
  check (playtomic_email is null or (length(playtomic_email) between 3 and 254 and playtomic_email !~ '\s' and playtomic_email ~ '^[^@]+@[^@]+\.[^@]+$'));
alter table public.rallora_team_applications add column if not exists partner_playtomic_email text
  check (partner_playtomic_email is null or (length(partner_playtomic_email) between 3 and 254 and partner_playtomic_email !~ '\s' and partner_playtomic_email ~ '^[^@]+@[^@]+\.[^@]+$'));
-- Preserve the Playtomic identifier before any support-assisted account email correction.
update public.rallora_player_profiles p set playtomic_email=lower(u.email)
from auth.users u where u.id=p.user_id and p.playtomic_email is null;
update public.rallora_team_applications set partner_playtomic_email=lower(partner_email)
where partner_playtomic_email is null and partner_email is not null;
create or replace function public.rallora_claim_team_invite(p_invite_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.rallora_team_member_invites%rowtype; v_request uuid; v_email text;
begin
 if auth.uid() is null then raise exception 'Sign in to claim this team place'; end if;
 v_email:=lower(coalesce(auth.jwt()->>'email',''));
 if v_email='' then raise exception 'Your account does not have an email address'; end if;

 select * into i from public.rallora_team_member_invites where id=p_invite_id for update;
 if not found then raise exception 'Invite not found'; end if;
 if i.status<>'pending' then raise exception 'This invite has already been used'; end if;
 if lower(i.invited_email)<>v_email then raise exception 'Sign in with the email address that was invited'; end if;

 insert into public.rallora_player_profiles(user_id,display_name,playtomic_rating,playtomic_email,updated_at)
 values(auth.uid(),i.invited_name,i.playtomic_rating,(select coalesce(a.partner_playtomic_email,a.partner_email) from public.rallora_team_applications a where a.id=i.team_application_id),now())
 on conflict(user_id) do update set
   display_name=excluded.display_name,
   playtomic_email=coalesce(nullif(public.rallora_player_profiles.playtomic_email,v_email),excluded.playtomic_email,v_email),
   playtomic_rating=coalesce(excluded.playtomic_rating,public.rallora_player_profiles.playtomic_rating),
   updated_at=now();

 insert into public.rallora_team_registration_requests(
   club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_at)
 values(i.club_id,i.season_id,i.division_id,i.team_id,auth.uid(),i.invited_name,'approved',now())
 returning id into v_request;

 insert into public.rallora_team_roster_memberships(
   registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role)
 values(v_request,i.club_id,i.season_id,i.division_id,i.team_id,auth.uid(),'player')
 on conflict(team_id,player_user_id) do nothing;

 update public.rallora_team_member_invites
 set status='claimed',claimed_by=auth.uid(),claimed_at=now()
 where id=i.id;

 return i.team_id;
end $$;


revoke all on function public.rallora_claim_team_invite(uuid) from public,anon;
grant execute on function public.rallora_claim_team_invite(uuid) to authenticated;
commit;
