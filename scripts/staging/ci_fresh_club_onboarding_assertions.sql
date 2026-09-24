-- Fresh-club pilot onboarding assertions. Disposable CI database only.
begin;

do $$
declare
  v_applicant constant uuid := '33333333-3333-3333-3333-333333333333';
  v_admin constant uuid := '00000000-0000-0000-0000-000000000999';
  v_application uuid;
  v_club uuid;
  v_season uuid := '33333333-3333-3333-3333-333333330001';
  v_division uuid := '33333333-3333-3333-3333-333333330002';
begin
  insert into auth.users(id,email) values(v_applicant,'fresh-owner@example.test');

  insert into public.rallora_club_applications(
    applicant_user_id,club_name,requested_slug,contact_email,plan_code,status
  ) values(
    v_applicant,'Fresh Pilot Club','fresh-pilot-club','fresh-owner@example.test','league','pending'
  ) returning id into v_application;

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000999","email":"platform@example.test"}',true);
  select public.rallora_approve_club_application(v_application) into v_club;

  if v_club is null then raise exception 'Club approval did not return a club'; end if;
  if not exists(select 1 from public.clubs where id=v_club and slug='fresh-pilot-club' and is_active) then
    raise exception 'Approved club was not activated';
  end if;
  if not exists(select 1 from public.rallora_club_memberships where club_id=v_club and user_id=v_applicant and role='owner' and status='active') then
    raise exception 'Applicant did not become active club owner';
  end if;
  if not exists(select 1 from public.rallora_club_subscriptions where club_id=v_club and plan_code='league' and status='trialing') then
    raise exception 'Requested plan was not provisioned';
  end if;
  if not exists(select 1 from public.rallora_club_feature_entitlements where club_id=v_club and feature_key='core_league' and is_enabled) then
    raise exception 'Core league entitlement missing';
  end if;
  if not exists(select 1 from public.rallora_notifications where recipient_user_id=v_applicant and club_id=v_club and notification_type='club_activated') then
    raise exception 'Club owner activation notification missing';
  end if;
  if (select status from public.rallora_club_applications where id=v_application) <> 'activated' then
    raise exception 'Application not marked activated';
  end if;

  -- Switch to the new owner and prove a blank club can be configured through tenant RLS.
  perform set_config('request.jwt.claim.sub',v_applicant::text,true);
  perform set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","email":"fresh-owner@example.test"}',true);
  execute 'set local role authenticated';

  insert into public.seasons(id,club_id,name,status)
  values(v_season,v_club,'Pilot League','draft');

  insert into public.divisions(id,season_id,name,sort_order)
  values(v_division,v_season,'Premier Division',1);

  update public.seasons set status='active' where id=v_season;

  if not exists(select 1 from public.seasons where id=v_season and club_id=v_club and status='active') then
    raise exception 'Owner could not create and activate first season';
  end if;
  if not exists(select 1 from public.divisions where id=v_division and season_id=v_season) then
    raise exception 'Owner could not create first division';
  end if;

  execute 'reset role';
end $$;

rollback;
