begin;

create or replace function public.rallora_platform_create_club(
  p_name text,
  p_slug text,
  p_owner_email text,
  p_plan_code text default 'starter'
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_owner_id uuid;
  v_club_id uuid;
  v_email text:=lower(trim(p_owner_email));
  v_name text:=trim(p_name);
  v_slug text:=lower(trim(p_slug));
begin
  if not public.rallora_is_platform_admin() then
    raise exception 'Not authorised';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Club name must be between 2 and 120 characters';
  end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Invalid club web address';
  end if;
  if p_plan_code not in ('starter','league','pro') then
    raise exception 'Invalid plan';
  end if;
  if exists(select 1 from public.clubs where slug=v_slug) then
    raise exception 'That club web address is already in use';
  end if;

  select id into v_owner_id
  from auth.users
  where lower(email)=v_email
  order by created_at desc
  limit 1;

  if v_owner_id is null then
    raise exception 'No Rallora account exists for that owner email. Ask the owner to create an account first.';
  end if;

  insert into public.clubs(slug,name,short_name,contact_email,is_active)
  values(v_slug,v_name,left(v_name,24),v_email,true)
  returning id into v_club_id;

  insert into public.rallora_club_memberships(club_id,user_id,role,status)
  values(v_club_id,v_owner_id,'owner','active');

  insert into public.rallora_club_subscriptions(club_id,plan_code,status,trial_ends_at,updated_by)
  values(v_club_id,p_plan_code,'trialing',now()+interval '14 days',auth.uid());

  perform public.rallora_platform_set_plan(v_club_id,p_plan_code,'trialing');

  insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
  values(v_owner_id,v_club_id,'club_activated','Your Rallora club is ready',
    v_name||' has been created and its control centre is ready.',
    '/clubs/'||v_slug||'/admin');

  return v_club_id;
end;
$$;

revoke all on function public.rallora_platform_create_club(text,text,text,text) from public,anon;
grant execute on function public.rallora_platform_create_club(text,text,text,text) to authenticated;

commit;
