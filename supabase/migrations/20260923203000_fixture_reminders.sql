-- Idempotent fixture-deadline reminder queue for pilot operations.
begin;
create table if not exists public.rallora_fixture_reminder_log(
 fixture_id uuid not null references public.fixtures(id) on delete cascade,
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 reminder_key text not null check(reminder_key in('due_3_days','due_today','overdue')),
 created_at timestamptz not null default now(),
 primary key(fixture_id,recipient_user_id,reminder_key)
);
alter table public.rallora_fixture_reminder_log enable row level security;
revoke all on public.rallora_fixture_reminder_log from public,anon,authenticated;

create or replace function public.rallora_generate_fixture_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer:=0;
begin
 with due as(
  select f.id fixture_id,s.club_id,c.slug,f.home_team_id,f.away_team_id,f.play_by,
   case when f.play_by=current_date+3 then 'due_3_days'
        when f.play_by=current_date then 'due_today'
        when f.play_by<current_date then 'overdue' end reminder_key
  from public.fixtures f join public.seasons s on s.id=f.season_id
  join public.clubs c on c.id=s.club_id
  where f.status not in('confirmed','cancelled') and f.play_by<=current_date+3
 ), recipients as(
  select distinct d.*,r.player_user_id
  from due d join public.rallora_team_roster_memberships r
   on r.team_id in(d.home_team_id,d.away_team_id)
  where d.reminder_key is not null and r.role='captain'
 ), claimed as(
  insert into public.rallora_fixture_reminder_log(fixture_id,recipient_user_id,reminder_key)
  select fixture_id,player_user_id,reminder_key from recipients
  on conflict do nothing returning fixture_id,recipient_user_id,reminder_key
 ), inserted as(
  insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
  select r.player_user_id,r.club_id,'fixture_'||r.reminder_key,
   case r.reminder_key when 'due_3_days' then 'Fixture due in 3 days' when 'due_today' then 'Fixture due today' else 'Fixture overdue' end,
   case r.reminder_key when 'due_3_days' then 'Your fixture is due in 3 days.'
    when 'due_today' then 'Your fixture is due today.'
    else 'Your fixture is overdue. Please submit or review the result.' end,
   '/clubs/'||r.slug||'/captain'
  from recipients r join claimed c on c.fixture_id=r.fixture_id and c.recipient_user_id=r.player_user_id and c.reminder_key=r.reminder_key
  returning 1
 )
 select count(*) into v_count from inserted;
 return v_count;
end;$$;
revoke all on function public.rallora_generate_fixture_reminders() from public,anon,authenticated;
commit;