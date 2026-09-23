begin;
create or replace function public.rallora_list_club_staff(p_club_id uuid)
returns table(user_id uuid,email text,role text,status text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.rallora_can_manage_club(p_club_id) then raise exception 'Not authorised'; end if;
  return query select m.user_id,u.email::text,m.role,m.status from public.rallora_club_memberships m
    join auth.users u on u.id=m.user_id where m.club_id=p_club_id order by m.role,u.email;
end; $$;

create or replace function public.rallora_set_club_staff(p_club_id uuid,p_email text,p_role text,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid;v_actor_role text;v_target_role text;v_active_owners int;
begin
  if p_role not in ('owner','admin','organiser') or p_status not in ('active','suspended') then raise exception 'Invalid role or status'; end if;
  if not public.rallora_is_platform_admin() then
    select m.role into v_actor_role from public.rallora_club_memberships m where m.club_id=p_club_id and m.user_id=auth.uid() and m.status='active';
    if v_actor_role not in ('owner','admin') then raise exception 'Only a club owner or admin can manage staff'; end if;
    if p_role='owner' and v_actor_role<>'owner' then raise exception 'Only an owner can assign owners'; end if;
  end if;
  select u.id into v_user from auth.users u where lower(u.email)=lower(trim(p_email));
  if v_user is null then raise exception 'No Rallora account exists for this email'; end if;
  select m.role into v_target_role from public.rallora_club_memberships m where m.club_id=p_club_id and m.user_id=v_user;
  if v_target_role='owner' and p_status='suspended' then
    select count(*) into v_active_owners from public.rallora_club_memberships m where m.club_id=p_club_id and m.role='owner' and m.status='active';
    if v_active_owners<=1 then raise exception 'A club must keep at least one active owner'; end if;
  end if;
  insert into public.rallora_club_memberships(club_id,user_id,role,status)
    values(p_club_id,v_user,p_role,p_status)
    on conflict(club_id,user_id) do update set role=excluded.role,status=excluded.status;
end; $$;
revoke all on function public.rallora_list_club_staff(uuid),public.rallora_set_club_staff(uuid,text,text,text) from public,anon;
grant execute on function public.rallora_list_club_staff(uuid),public.rallora_set_club_staff(uuid,text,text,text) to authenticated;
commit;
