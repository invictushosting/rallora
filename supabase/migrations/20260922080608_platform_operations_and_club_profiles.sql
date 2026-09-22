-- Rallora launch operations: rich club profiles, plan lifecycle, feature control
-- and an authenticated in-app notification inbox.
begin;

alter table public.clubs
  add column if not exists venue_name text,
  add column if not exists address_line_1 text,
  add column if not exists town text,
  add column if not exists postcode text,
  add column if not exists player_registration_terms text;

create table if not exists public.rallora_club_subscriptions (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  plan_code text not null default 'starter' check (plan_code in ('starter','league','pro')),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','paused','cancelled')),
  trial_ends_at timestamptz,
  payment_provider text,
  provider_customer_id text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.rallora_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rallora_notifications_recipient_idx
  on public.rallora_notifications(recipient_user_id,created_at desc);

alter table public.rallora_club_subscriptions enable row level security;
alter table public.rallora_notifications enable row level security;
revoke all on public.rallora_club_subscriptions,public.rallora_notifications from public,anon;
grant select on public.rallora_club_subscriptions to authenticated;
grant select on public.rallora_notifications to authenticated;

create policy "club_subscription_manager_read" on public.rallora_club_subscriptions
  for select to authenticated using(public.rallora_can_manage_club(club_id));
create policy "notification_owner_read" on public.rallora_notifications
  for select to authenticated using(recipient_user_id=(select auth.uid()));

create or replace function public.rallora_mark_notification_read(p_notification_id uuid)
returns void language sql security definer set search_path='' as $$
  update public.rallora_notifications set read_at=coalesce(read_at,now())
  where id=p_notification_id and recipient_user_id=auth.uid();
$$;
revoke all on function public.rallora_mark_notification_read(uuid) from public,anon;
grant execute on function public.rallora_mark_notification_read(uuid) to authenticated;

create or replace function public.rallora_platform_set_club_status(p_club_id uuid,p_is_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.rallora_is_platform_admin() then raise exception 'Not authorised'; end if;
  update public.clubs set is_active=p_is_active,updated_at=now() where id=p_club_id;
  if not found then raise exception 'Club not found'; end if;
end; $$;

create or replace function public.rallora_platform_decline_application(p_application_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.rallora_is_platform_admin() then raise exception 'Not authorised'; end if;
  update public.rallora_club_applications set status='declined',reviewed_by=auth.uid(),reviewed_at=now()
    where id=p_application_id and status='pending';
  if not found then raise exception 'Application is not pending'; end if;
end; $$;

create or replace function public.rallora_platform_set_plan(p_club_id uuid,p_plan_code text,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_features text[];
begin
  if not public.rallora_is_platform_admin() then raise exception 'Not authorised'; end if;
  if p_plan_code not in ('starter','league','pro') then raise exception 'Invalid plan'; end if;
  if p_status not in ('trialing','active','past_due','paused','cancelled') then raise exception 'Invalid subscription status'; end if;
  insert into public.rallora_club_subscriptions(club_id,plan_code,status,trial_ends_at,updated_by)
    values(p_club_id,p_plan_code,p_status,case when p_status='trialing' then now()+interval '14 days' end,auth.uid())
    on conflict(club_id) do update set plan_code=excluded.plan_code,status=excluded.status,
      trial_ends_at=case when excluded.status='trialing' then coalesce(public.rallora_club_subscriptions.trial_ends_at,excluded.trial_ends_at) else public.rallora_club_subscriptions.trial_ends_at end,
      updated_by=auth.uid(),updated_at=now();
  v_features:=case p_plan_code when 'pro' then array['core_league','player_registration','captain_results','social_studio','sponsors','reminders']
    when 'league' then array['core_league','player_registration','captain_results','social_studio']
    else array['core_league','player_registration'] end;
  insert into public.rallora_club_feature_entitlements(club_id,feature_key,is_enabled,enabled_by,updated_at)
    select p_club_id,key,true,auth.uid(),now() from unnest(v_features) key
    on conflict(club_id,feature_key) do update set is_enabled=true,enabled_by=auth.uid(),updated_at=now();
  update public.rallora_club_feature_entitlements set is_enabled=false,enabled_by=auth.uid(),updated_at=now()
    where club_id=p_club_id and not(feature_key=any(v_features));
end; $$;

create or replace function public.rallora_platform_set_feature(p_club_id uuid,p_feature_key text,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.rallora_is_platform_admin() then raise exception 'Not authorised'; end if;
  if p_feature_key not in ('core_league','player_registration','captain_results','social_studio','sponsors','reminders') then raise exception 'Invalid feature'; end if;
  insert into public.rallora_club_feature_entitlements(club_id,feature_key,is_enabled,enabled_by,updated_at)
    values(p_club_id,p_feature_key,p_enabled,auth.uid(),now())
    on conflict(club_id,feature_key) do update set is_enabled=excluded.is_enabled,enabled_by=auth.uid(),updated_at=now();
end; $$;

create or replace function public.rallora_notify_registration_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.player_user_id is not null and new.status is distinct from old.status then
    insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
    values(new.player_user_id,new.club_id,'registration_'||new.status,
      case new.status when 'approved' then 'Registration approved' when 'declined' then 'Registration declined' else 'Registration updated' end,
      case new.status when 'approved' then 'Your club registration has been approved.' when 'declined' then 'Your club registration was not approved.' else 'Your club registration status has changed.' end,
      '/clubs/'||(select c.slug from public.clubs c where c.id=new.club_id));
  end if;
  return new;
end; $$;
drop trigger if exists rallora_registration_notification on public.rallora_team_registration_requests;
create trigger rallora_registration_notification after update of status on public.rallora_team_registration_requests
  for each row execute function public.rallora_notify_registration_change();

revoke all on function public.rallora_platform_set_club_status(uuid,boolean),
  public.rallora_platform_decline_application(uuid),public.rallora_platform_set_plan(uuid,text,text),
  public.rallora_platform_set_feature(uuid,text,boolean),public.rallora_notify_registration_change() from public,anon;
grant execute on function public.rallora_platform_set_club_status(uuid,boolean),
  public.rallora_platform_decline_application(uuid),public.rallora_platform_set_plan(uuid,text,text),
  public.rallora_platform_set_feature(uuid,text,boolean) to authenticated;

create or replace function public.rallora_approve_club_application(p_application_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare application public.rallora_club_applications%rowtype; new_club_id uuid;
begin
 if not public.rallora_is_platform_admin() then raise exception 'Not authorised'; end if;
 select * into application from public.rallora_club_applications where id=p_application_id and status='pending' for update;
 if not found then raise exception 'Application is not pending'; end if;
 insert into public.clubs(slug,name,short_name,contact_email,is_active)
 values(application.requested_slug,application.club_name,left(application.club_name,24),application.contact_email,true) returning id into new_club_id;
 insert into public.rallora_club_memberships(club_id,user_id,role,status)
 values(new_club_id,application.applicant_user_id,'owner','active');
 insert into public.rallora_club_subscriptions(club_id,plan_code,status,trial_ends_at,updated_by)
 values(new_club_id,application.plan_code,'trialing',now()+interval '14 days',auth.uid());
 perform public.rallora_platform_set_plan(new_club_id,application.plan_code,'trialing');
 update public.rallora_club_applications set status='activated',reviewed_by=auth.uid(),reviewed_at=now() where id=application.id;
 insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
 values(application.applicant_user_id,new_club_id,'club_activated','Your Rallora club is ready',
   application.club_name||' has been approved and its control centre is ready.',
   '/clubs/'||application.requested_slug||'/admin');
 return new_club_id;
end; $$;
revoke all on function public.rallora_approve_club_application(uuid) from public,anon;
grant execute on function public.rallora_approve_club_application(uuid) to authenticated;

create or replace function public.rallora_notify_result_submission()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_slug text; v_opponent uuid;
begin
  select s.club_id,c.slug,case when f.home_team_id=new.submitting_team_id then f.away_team_id else f.home_team_id end
    into v_club,v_slug,v_opponent from public.fixtures f join public.seasons s on s.id=f.season_id
    join public.clubs c on c.id=s.club_id where f.id=new.fixture_id;
  if tg_op='INSERT' or new.status is distinct from old.status then
    if new.status='pending_opponent' then
      insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
      select r.player_user_id,v_club,'result_review','Result awaiting confirmation',
        'The opposing captain has submitted a result for your fixture.','/clubs/'||v_slug||'/captain'
      from public.rallora_team_roster_memberships r where r.team_id=v_opponent and r.role='captain';
    elsif new.status in ('confirmed_by_opponent','disputed') and new.submitted_by_user_id is not null then
      insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
      values(new.submitted_by_user_id,v_club,'result_'||new.status,
        case when new.status='confirmed_by_opponent' then 'Result confirmed' else 'Result disputed' end,
        case when new.status='confirmed_by_opponent' then 'The opposing team confirmed your submitted result.' else 'The opposing team disputed your submitted result.' end,
        '/clubs/'||v_slug||'/captain');
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists rallora_result_submission_notification on public.result_submissions;
create trigger rallora_result_submission_notification after insert or update of status on public.result_submissions
  for each row execute function public.rallora_notify_result_submission();
revoke all on function public.rallora_notify_result_submission() from public,anon,authenticated;

-- Trigger-only standings refresh. This deliberately has no API execute grant.
create or replace function public.rallora_refresh_confirmed_standings()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_fixture_id uuid:=coalesce(new.fixture_id,old.fixture_id); v_season uuid;
  v_win int:=3;v_draw int:=1;v_loss int:=0;v_fw int:=3;v_fl int:=0;v_df int:=0;
begin
  select f.season_id into v_season from public.fixtures f where f.id=v_fixture_id;
  select coalesce(cr.win_points,3),coalesce(cr.draw_points,1),coalesce(cr.loss_points,0),
    coalesce(cr.forfeit_win_points,3),coalesce(cr.forfeit_loss_points,0),coalesce(cr.double_forfeit_points,0)
    into v_win,v_draw,v_loss,v_fw,v_fl,v_df from public.club_rules cr
    where cr.season_id=v_season order by cr.updated_at desc limit 1;
  insert into public.standings(season_id,division_id,team_id,played,won,drawn,lost,score_diff,points)
    select v_season,d.id,t.id,0,0,0,0,0,0 from public.divisions d join public.teams t on t.division_id=d.id
    where d.season_id=v_season and coalesce(t.is_active,true)
    on conflict(season_id,team_id) do nothing;
  update public.standings set played=0,won=0,drawn=0,lost=0,score_diff=0,points=0,updated_at=now() where season_id=v_season;
  with rr as(
    select f.season_id,f.division_id,f.home_team_id,f.away_team_id,coalesce(f.status,'') fixture_status,r.winner_team_id,
      public.score_text_total(r.home_score)-public.score_text_total(r.away_score) home_diff
    from public.results r join public.fixtures f on f.id=r.fixture_id
    where f.season_id=v_season and coalesce(r.status,'confirmed') in('confirmed','admin_override')
  ),tr as(
    select season_id,division_id,home_team_id team_id,1 played,
      (winner_team_id=home_team_id)::int won,
      (winner_team_id is null and fixture_status<>'double_forfeit')::int drawn,
      (fixture_status='double_forfeit' or winner_team_id=away_team_id)::int lost,
      case when fixture_status in('forfeit','double_forfeit') or winner_team_id is null then 0 else home_diff end score_diff,
      case when fixture_status='double_forfeit' then v_df when fixture_status='forfeit' and winner_team_id=home_team_id then v_fw
        when fixture_status='forfeit' then v_fl when winner_team_id=home_team_id then v_win when winner_team_id=away_team_id then v_loss else v_draw end points from rr
    union all
    select season_id,division_id,away_team_id,1,
      (winner_team_id=away_team_id)::int,
      (winner_team_id is null and fixture_status<>'double_forfeit')::int,
      (fixture_status='double_forfeit' or winner_team_id=home_team_id)::int,
      case when fixture_status in('forfeit','double_forfeit') or winner_team_id is null then 0 else -home_diff end,
      case when fixture_status='double_forfeit' then v_df when fixture_status='forfeit' and winner_team_id=away_team_id then v_fw
        when fixture_status='forfeit' then v_fl when winner_team_id=away_team_id then v_win when winner_team_id=home_team_id then v_loss else v_draw end from rr
  ),a as(select season_id,division_id,team_id,sum(played)::int played,sum(won)::int won,sum(drawn)::int drawn,
    sum(lost)::int lost,sum(score_diff)::int score_diff,sum(points)::int points from tr group by season_id,division_id,team_id)
  update public.standings s set played=a.played,won=a.won,drawn=a.drawn,lost=a.lost,score_diff=a.score_diff,
    points=a.points,division_id=a.division_id,updated_at=now() from a where s.season_id=a.season_id and s.team_id=a.team_id;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists rallora_results_refresh_standings on public.results;
create trigger rallora_results_refresh_standings after insert or update or delete on public.results
  for each row execute function public.rallora_refresh_confirmed_standings();
revoke all on function public.rallora_refresh_confirmed_standings() from public,anon,authenticated;

commit;
