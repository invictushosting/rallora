begin;

create table public.rallora_round_date_changes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  before_schedule jsonb not null,
  after_schedule jsonb not null,
  fixtures_updated integer not null,
  created_at timestamptz not null default now()
);
alter table public.rallora_round_date_changes enable row level security;
revoke all on public.rallora_round_date_changes from public, anon, authenticated;
grant select on public.rallora_round_date_changes to authenticated;
create policy "round_date_changes_manager_read" on public.rallora_round_date_changes
  for select to authenticated using (public.rallora_can_manage_club(club_id));

-- Privileged implementation follows the existing private-function/public-invoker pattern.
create function rallora_private.update_round_dates(
  p_season_id uuid, p_expected_ends_on date, p_expected_windows jsonb,
  p_ends_on date, p_future_windows jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.seasons%rowtype;
  plan jsonb;
  updated_plan jsonb := '[]'::jsonb;
  item jsonb;
  current_index integer := -1;
  i integer;
  a date;
  b date;
  previous_end date;
  updated_count integer;
  zone text;
begin
  if auth.uid() is null then raise exception 'Sign in to edit round dates'; end if;
  select * into s from public.seasons where id = p_season_id for update;
  if not found or not public.rallora_can_manage_club(s.club_id) then raise exception 'Not authorised'; end if;
  if s.status not in ('draft', 'active') or exists(select 1 from public.seasons where previous_season_id = s.id) then
    raise exception 'This round is complete or its next round has already been prepared. Its schedule is locked';
  end if;
  if s.fixture_schedule_mode <> 'date_window' then raise exception 'Use the individual fixture tools for weekly schedules'; end if;
  if not exists(select 1 from public.fixtures where season_id = s.id) then raise exception 'Set dates in competition setup before generating fixtures'; end if;
  if s.ends_on is distinct from p_expected_ends_on or s.round_windows is distinct from p_expected_windows then
    raise exception 'The schedule has changed. Refresh the page and review the dates again';
  end if;
  if p_ends_on is null or not isfinite(p_ends_on) or s.starts_on is null or p_ends_on < s.starts_on
    or (s.competition_ends_on is not null and p_ends_on > s.competition_ends_on) then
    raise exception 'Choose a deadline within the competition dates';
  end if;
  if p_future_windows is null or jsonb_typeof(p_future_windows) <> 'array' or jsonb_array_length(p_future_windows) > 119 then
    raise exception 'Choose a valid future round schedule';
  end if;

  plan := s.round_windows;
  if jsonb_array_length(plan) > 0 then
    for i in 0..jsonb_array_length(plan)-1 loop
      if plan->i->>'starts_on' = s.starts_on::text and plan->i->>'ends_on' = s.ends_on::text then current_index := i; exit; end if;
    end loop;
    if current_index < 0 or jsonb_array_length(p_future_windows) <> jsonb_array_length(plan)-current_index-1 then
      raise exception 'The saved schedule does not match this round. Ask Rallora support to check it';
    end if;
    for i in 0..current_index loop
      updated_plan := updated_plan || jsonb_build_array(case when i = current_index
        then jsonb_build_object('starts_on', s.starts_on, 'ends_on', p_ends_on) else plan->i end);
    end loop;
    updated_plan := updated_plan || p_future_windows;
    -- Validate the complete plan, including fixed past rounds and overall finish.
    for item in select value from jsonb_array_elements(updated_plan) loop
      if jsonb_typeof(item) <> 'object' or coalesce(item->>'starts_on', '') !~ '^\d{4}-\d{2}-\d{2}$'
        or coalesce(item->>'ends_on', '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Choose valid round dates'; end if;
      a := (item->>'starts_on')::date; b := (item->>'ends_on')::date;
      if b < a or (previous_end is not null and a <= previous_end) then
        raise exception 'Each round must end on or after its start and start after the previous round ends';
      end if;
      previous_end := b;
    end loop;
    if previous_end <> coalesce(s.competition_ends_on, (plan->-1->>'ends_on')::date) then
      raise exception 'The final round must end on the competition finish date';
    end if;
  elsif jsonb_array_length(p_future_windows) > 0 then
    raise exception 'This competition has no saved round plan. Set the next dates when preparing that round';
  end if;

  -- Serialize with booking/result writes; reject shortening that strands a booking or proposal.
  perform id from public.fixtures where season_id = s.id order by id for update;
  select coalesce((select timezone from public.rallora_communication_settings where club_id = s.club_id), 'Europe/London') into zone;
  if exists(select 1 from public.fixtures f where f.season_id = s.id and f.status in ('open','submitted','disputed')
    and (f.available_from > p_ends_on or (f.booking_ends_at at time zone zone)::date > p_ends_on))
    or exists(select 1 from public.rallora_fixture_arrangements a join public.fixtures f on f.id = a.fixture_id
      where f.season_id = s.id and f.status in ('open','submitted','disputed') and (a.ends_at at time zone zone)::date > p_ends_on)
    or exists(select 1 from public.rallora_playtomic_bookings b join public.fixtures f on f.id = b.matched_fixture_id
      where f.season_id = s.id and f.status in ('open','submitted','disputed') and b.match_state = 'confirmed'
      and b.matched_player_count = 4 and b.booking_status not in ('CANCELED','CANCELLED') and (b.ends_at at time zone zone)::date > p_ends_on)
    or exists(select 1 from public.rallora_fixture_messages m join public.fixtures f on f.id = m.fixture_id
      where f.season_id = s.id and f.status in ('open','submitted','disputed') and m.proposal_status in ('pending','accepted')
      and (m.ends_at at time zone zone)::date > p_ends_on) then
    raise exception 'A fixture opens, has a recorded booking or has a proposed match time after this deadline. Review those matches first';
  end if;

  -- Coordinate with the delivery worker and retire unsent reminders carrying old dates.
  -- Retain their history while freeing the original deduplication key for a later check.
  perform pg_advisory_xact_lock(734821);
  update public.rallora_delivery_queue q set status = 'cancelled',
    event_key = q.event_key || ':rescheduled:' || q.id::text,
    last_error = 'Round deadline changed; reminder checks will use the updated deadline'
    from public.fixtures f where f.id = q.fixture_id and f.season_id = s.id
      and f.status in ('open','submitted','disputed') and f.play_by is distinct from p_ends_on
      and q.status = 'queued' and q.category in ('booking','upcoming','missing_result','confirmation','overdue');
  update public.fixtures set play_by = p_ends_on
    where season_id = s.id and status in ('open','submitted','disputed') and play_by is distinct from p_ends_on;
  get diagnostics updated_count = row_count;
  update public.seasons set ends_on = p_ends_on, round_windows = updated_plan where id = s.id;
  insert into public.rallora_round_date_changes(club_id, season_id, changed_by, before_schedule, after_schedule, fixtures_updated)
    values(s.club_id, s.id, auth.uid(), jsonb_build_object('ends_on', s.ends_on, 'round_windows', s.round_windows),
      jsonb_build_object('ends_on', p_ends_on, 'round_windows', updated_plan), updated_count);
  return jsonb_build_object('fixtures_updated', updated_count);
end $$;
revoke all on function rallora_private.update_round_dates(uuid,date,jsonb,date,jsonb) from public, anon;
grant execute on function rallora_private.update_round_dates(uuid,date,jsonb,date,jsonb) to authenticated;

create function public.rallora_update_round_dates(
  p_season_id uuid, p_expected_ends_on date, p_expected_windows jsonb, p_ends_on date, p_future_windows jsonb
) returns jsonb language sql security invoker set search_path = '' as $$
  select rallora_private.update_round_dates(p_season_id, p_expected_ends_on, p_expected_windows, p_ends_on, p_future_windows);
$$;
revoke all on function public.rallora_update_round_dates(uuid,date,jsonb,date,jsonb) from public, anon;
grant execute on function public.rallora_update_round_dates(uuid,date,jsonb,date,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
