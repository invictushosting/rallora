-- Team placement is canonical; standings must follow it even before any result exists.
-- Existing recalculation and generation skipped conflicts, retaining old box links.
begin;

-- Repair links only. Preserve standings IDs, points, fixtures and all match history.
update public.standings st
set division_id=t.division_id,updated_at=now()
from public.teams t join public.divisions d on d.id=t.division_id
where st.team_id=t.id and st.season_id=d.season_id
  and st.division_id is distinct from t.division_id;

-- Enforce alignment for every write path, including direct authorised admin moves.
-- Cascading placement updates change only the division link, never score totals.
alter table public.teams add constraint teams_id_division_key unique(id,division_id);
alter table public.divisions add constraint divisions_id_season_key unique(id,season_id);
alter table public.standings
  add constraint standings_team_division_fkey foreign key(team_id,division_id)
    references public.teams(id,division_id) on update cascade on delete cascade,
  add constraint standings_division_season_fkey foreign key(division_id,season_id)
    references public.divisions(id,season_id) on delete cascade;

create or replace function public.recalculate_standings_for_season(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_win_points int := 3;
  v_draw_points int := 1;
  v_loss_points int := 0;
  v_forfeit_win_points int := 3;
  v_forfeit_loss_points int := 0;
  v_double_forfeit_points int := 0;
begin
  select club_id into v_club_id
  from public.seasons
  where id = p_season_id;

  if v_club_id is null then
    raise exception 'Season not found';
  end if;

  select
    coalesce(cr.win_points, 3),
    coalesce(cr.draw_points, 1),
    coalesce(cr.loss_points, 0),
    coalesce(cr.forfeit_win_points, 3),
    coalesce(cr.forfeit_loss_points, 0),
    coalesce(cr.double_forfeit_points, 0)
  into
    v_win_points,
    v_draw_points,
    v_loss_points,
    v_forfeit_win_points,
    v_forfeit_loss_points,
    v_double_forfeit_points
  from public.club_rules cr
  where cr.club_id = v_club_id
    and (cr.season_id = p_season_id or cr.season_id is null)
  order by (cr.season_id = p_season_id) desc nulls last,
    cr.updated_at desc nulls last, cr.created_at desc nulls last, cr.id
  limit 1;

  -- SELECT INTO clears initialized values when no rules row exists.
  v_win_points := coalesce(v_win_points, 3);
  v_draw_points := coalesce(v_draw_points, 1);
  v_loss_points := coalesce(v_loss_points, 0);
  v_forfeit_win_points := coalesce(v_forfeit_win_points, 3);
  v_forfeit_loss_points := coalesce(v_forfeit_loss_points, 0);
  v_double_forfeit_points := coalesce(v_double_forfeit_points, 0);

  insert into public.standings(season_id,division_id,team_id,played,won,drawn,lost,score_diff,points)
  select p_season_id,d.id,t.id,0,0,0,0,0,0
  from public.divisions d
  join public.teams t on t.division_id=d.id
  where d.season_id=p_season_id and coalesce(t.is_active,true)
  on conflict(season_id,team_id) do update
  set division_id=excluded.division_id;

  update public.standings
  set played=0,won=0,drawn=0,lost=0,score_diff=0,points=0,updated_at=now()
  where season_id=p_season_id;

  with result_rows as (
    select f.season_id,f.division_id,f.home_team_id,f.away_team_id,
      lower(coalesce(f.status,'')) fixture_status,r.winner_team_id,
      public.score_text_total(r.home_score)-public.score_text_total(r.away_score) home_diff
    from public.results r
    join public.fixtures f on f.id=r.fixture_id
    where f.season_id=p_season_id
      and lower(coalesce(r.status,'confirmed')) in ('confirmed','admin_override','approved','admin_approved')
  ), team_rows as (
    select season_id,division_id,home_team_id team_id,1 played,
      case when winner_team_id=home_team_id then 1 else 0 end won,
      case when winner_team_id is null and fixture_status<>'double_forfeit' then 1 else 0 end drawn,
      case when fixture_status='double_forfeit' or winner_team_id=away_team_id then 1 else 0 end lost,
      case when fixture_status in ('forfeit','double_forfeit') or winner_team_id is null then 0 else home_diff end score_diff,
      case
        when fixture_status='double_forfeit' then v_double_forfeit_points
        when fixture_status='forfeit' and winner_team_id=home_team_id then v_forfeit_win_points
        when fixture_status='forfeit' and winner_team_id=away_team_id then v_forfeit_loss_points
        when winner_team_id=home_team_id then v_win_points
        when winner_team_id=away_team_id then v_loss_points
        else v_draw_points end points
    from result_rows
    union all
    select season_id,division_id,away_team_id,1,
      case when winner_team_id=away_team_id then 1 else 0 end,
      case when winner_team_id is null and fixture_status<>'double_forfeit' then 1 else 0 end,
      case when fixture_status='double_forfeit' or winner_team_id=home_team_id then 1 else 0 end,
      case when fixture_status in ('forfeit','double_forfeit') or winner_team_id is null then 0 else -home_diff end,
      case
        when fixture_status='double_forfeit' then v_double_forfeit_points
        when fixture_status='forfeit' and winner_team_id=away_team_id then v_forfeit_win_points
        when fixture_status='forfeit' and winner_team_id=home_team_id then v_forfeit_loss_points
        when winner_team_id=away_team_id then v_win_points
        when winner_team_id=home_team_id then v_loss_points
        else v_draw_points end
    from result_rows
  ), aggregated as (
    select season_id,division_id,team_id,sum(played)::int played,sum(won)::int won,
      sum(drawn)::int drawn,sum(lost)::int lost,sum(score_diff)::int score_diff,sum(points)::int points
    from team_rows
    group by season_id,division_id,team_id
  )
  update public.standings s
  set played=a.played,won=a.won,drawn=a.drawn,lost=a.lost,score_diff=a.score_diff,
    points=a.points,division_id=a.division_id,updated_at=now()
  from aggregated a
  where s.season_id=a.season_id and s.team_id=a.team_id;
end;
$$;

revoke all on function public.recalculate_standings_for_season(uuid) from public,anon,authenticated;


create or replace function rallora_private.generate_round_robin(p_season_id uuid,p_starts_on date,p_ends_on date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  s public.seasons%rowtype; d record; ids uuid[]; initial_ids uuid[];
  n integer; rounds integer; legs integer; leg integer; r integer; j integer;
  h uuid; a uuid; swap_id uuid; round_number integer; publish_on date; due_on date;
  generated integer:=0; division_count integer:=0; expected bigint:=0;
begin
  if auth.uid() is null then raise exception 'Sign in to generate fixtures'; end if;
  select * into s from public.seasons where id=p_season_id for update;
  if not found or not public.rallora_can_manage_club(s.club_id) then raise exception 'Not authorised'; end if;
  if s.status not in ('draft','active') then raise exception 'Completed cycles cannot receive new fixtures'; end if;
  if s.registration_published then raise exception 'Close registration before generating fixtures'; end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on<p_starts_on then raise exception 'Choose a valid fixture window'; end if;
  if exists(select 1 from public.fixtures where season_id=s.id) then
    raise exception 'This cycle already has fixtures. Existing matches have not been changed';
  end if;
  -- Serialise generation and hold the current division/team structure until commit.
  perform id from public.divisions where season_id=s.id order by sort_order,id for update;
  perform t.id from public.teams t join public.divisions div on div.id=t.division_id
    where div.season_id=s.id order by t.id for share of t;
  legs:=case when s.cycle_match_mode='double_round_robin' then 2 else 1 end;
  for d in select div.id,div.name,count(t.id)::integer team_count from public.divisions div
    left join public.teams t on t.division_id=div.id and coalesce(t.is_active,true)
    where div.season_id=s.id group by div.id,div.name,div.sort_order order by div.sort_order,div.id
  loop
    if d.team_count<2 then raise exception 'Division % needs at least two active teams',d.name; end if;
    if d.team_count>100 then raise exception 'Division % exceeds 100 teams',d.name; end if;
    expected:=expected+d.team_count::bigint*(d.team_count-1)/2*legs;
    division_count:=division_count+1;
  end loop;
  if division_count=0 then raise exception 'Create divisions and assign teams first'; end if;
  if expected>10000 then raise exception 'This generation exceeds 10,000 fixtures; split the competition into smaller seasons'; end if;
  for d in select id,name from public.divisions where season_id=s.id order by sort_order,id loop
    select array_agg(t.id order by t.id) into initial_ids from public.teams t
      where t.division_id=d.id and coalesce(t.is_active,true);
    if cardinality(initial_ids)%2=1 then initial_ids:=array_append(initial_ids,null::uuid); end if;
    n:=cardinality(initial_ids); rounds:=n-1;
    if s.fixture_schedule_mode='weekly' and p_ends_on<p_starts_on+(rounds*legs*7-1) then
      raise exception 'Weekly rounds in % need at least % days',d.name,rounds*legs*7;
    end if;
    for leg in 1..legs loop
      ids:=initial_ids;
      for r in 1..rounds loop
        round_number:=(leg-1)*rounds+r;
        publish_on:=case when s.fixture_schedule_mode='weekly' then p_starts_on+(round_number-1)*7 else p_starts_on end;
        due_on:=case when s.fixture_schedule_mode='weekly' then p_starts_on+round_number*7-1 else p_ends_on end;
        for j in 1..n/2 loop
          h:=ids[j]; a:=ids[n+1-j];
          if h is null or a is null then continue; end if; -- An odd division has a bye, never a dummy match.
          if (r+j)%2=0 then swap_id:=h;h:=a;a:=swap_id; end if;
          if leg=2 then swap_id:=h;h:=a;a:=swap_id; end if;
          insert into public.fixtures(season_id,division_id,week_number,home_team_id,away_team_id,
            available_from,play_by,status,fixture_group_type,fixture_group_name,fixtures_per_team)
          values(s.id,d.id,round_number,h,a,publish_on,due_on,'open',
            case when s.fixture_schedule_mode='weekly' then 'weekly' else 'custom' end,
            'Round '||round_number,(cardinality(initial_ids)-1-case when array_position(initial_ids,null::uuid) is not null then 1 else 0 end)*legs);
          generated:=generated+1;
        end loop;
        -- Circle rotation: the first team is fixed; the final team rotates to position two.
        ids:=array[ids[1],ids[n]]||ids[2:n-1];
      end loop;
    end loop;
  end loop;
  insert into public.standings(season_id,division_id,team_id,played,won,drawn,lost,score_diff,points)
    select s.id,div_data.id,t.id,0,0,0,0,0,0 from public.divisions div_data join public.teams t on t.division_id=div_data.id
    where div_data.season_id=s.id and coalesce(t.is_active,true) on conflict(season_id,team_id) do update
    set division_id=excluded.division_id;
  update public.seasons set starts_on=p_starts_on,ends_on=p_ends_on where id=s.id;
  return jsonb_build_object('season_id',s.id,'fixture_count',generated,'division_count',division_count);
end $$;
revoke all on function rallora_private.generate_round_robin(uuid,date,date) from public,anon;
grant execute on function rallora_private.generate_round_robin(uuid,date,date) to authenticated;

commit;
