-- Rallora: TRUE fix for rule points syncing into standings.
-- Safe to run more than once.
-- This version deliberately uses the most recently saved applicable club_rules row
-- so old default rows cannot override the organiser's latest saved points.

alter table if exists public.club_rules add column if not exists win_points int not null default 3;
alter table if exists public.club_rules add column if not exists draw_points int not null default 1;
alter table if exists public.club_rules add column if not exists loss_points int not null default 0;
alter table if exists public.club_rules add column if not exists forfeit_win_points int not null default 3;
alter table if exists public.club_rules add column if not exists forfeit_loss_points int not null default 0;
alter table if exists public.club_rules add column if not exists double_forfeit_points int not null default 0;
alter table if exists public.club_rules add column if not exists standings_tiebreaker text not null default 'Points, wins, score difference, score for, head-to-head, alphabetical';

-- Keep older seasons connected to the first active club where possible.
update public.seasons s
set club_id = c.id
from (
  select id from public.clubs where is_active = true order by created_at asc limit 1
) c
where s.club_id is null;

create or replace function public.score_text_total(input_text text)
returns int
language sql
immutable
as $$
  select coalesce(sum((match)[1]::int), 0)::int
  from regexp_matches(coalesce(input_text, ''), '([0-9]+)', 'g') as match;
$$;

create or replace function public.recalculate_standings_for_season(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = public
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
  if not public.is_admin() then
    raise exception 'Only admins can recalculate standings';
  end if;

  select club_id into v_club_id
  from public.seasons
  where id = p_season_id;

  if v_club_id is null then
    select id into v_club_id
    from public.clubs
    where is_active = true
    order by created_at asc
    limit 1;
  end if;

  -- TRUE FIX:
  -- Pick the most recently updated rule row that is relevant to this season/club.
  -- Previous versions preferred old exact/default rows too strongly, so a freshly saved
  -- Win Points value could be ignored and the calculation fell back to 3.
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
  where
    cr.season_id = p_season_id
    or (v_club_id is not null and cr.club_id = v_club_id)
    or cr.season_id is null
  order by
    cr.updated_at desc nulls last,
    cr.created_at desc nulls last
  limit 1;

  insert into public.standings (season_id, division_id, team_id, played, won, drawn, lost, score_diff, points)
  select p_season_id, d.id, t.id, 0, 0, 0, 0, 0, 0
  from public.divisions d
  join public.teams t on t.division_id = d.id
  where d.season_id = p_season_id
    and coalesce(t.is_active, true) = true
  on conflict (season_id, team_id) do nothing;

  update public.standings
  set played = 0,
      won = 0,
      drawn = 0,
      lost = 0,
      score_diff = 0,
      points = 0,
      updated_at = now()
  where season_id = p_season_id;

  with result_rows as (
    select
      f.season_id,
      f.division_id,
      f.home_team_id,
      f.away_team_id,
      lower(coalesce(f.status, '')) as fixture_status,
      r.winner_team_id,
      public.score_text_total(r.home_score) - public.score_text_total(r.away_score) as home_diff
    from public.results r
    join public.fixtures f on f.id = r.fixture_id
    where f.season_id = p_season_id
      and lower(coalesce(r.status, 'confirmed')) in ('confirmed', 'admin_override', 'approved', 'admin_approved')
  ), team_rows as (
    select
      season_id,
      division_id,
      home_team_id as team_id,
      1 as played,
      case when winner_team_id = home_team_id then 1 else 0 end as won,
      case when winner_team_id is null and fixture_status <> 'double_forfeit' then 1 else 0 end as drawn,
      case when fixture_status = 'double_forfeit' or winner_team_id = away_team_id then 1 else 0 end as lost,
      case when fixture_status in ('forfeit', 'double_forfeit') or winner_team_id is null then 0 else home_diff end as score_diff,
      case
        when fixture_status = 'double_forfeit' then v_double_forfeit_points
        when fixture_status = 'forfeit' and winner_team_id = home_team_id then v_forfeit_win_points
        when fixture_status = 'forfeit' and winner_team_id = away_team_id then v_forfeit_loss_points
        when winner_team_id = home_team_id then v_win_points
        when winner_team_id = away_team_id then v_loss_points
        else v_draw_points
      end as points
    from result_rows

    union all

    select
      season_id,
      division_id,
      away_team_id as team_id,
      1 as played,
      case when winner_team_id = away_team_id then 1 else 0 end as won,
      case when winner_team_id is null and fixture_status <> 'double_forfeit' then 1 else 0 end as drawn,
      case when fixture_status = 'double_forfeit' or winner_team_id = home_team_id then 1 else 0 end as lost,
      case when fixture_status in ('forfeit', 'double_forfeit') or winner_team_id is null then 0 else -home_diff end as score_diff,
      case
        when fixture_status = 'double_forfeit' then v_double_forfeit_points
        when fixture_status = 'forfeit' and winner_team_id = away_team_id then v_forfeit_win_points
        when fixture_status = 'forfeit' and winner_team_id = home_team_id then v_forfeit_loss_points
        when winner_team_id = away_team_id then v_win_points
        when winner_team_id = home_team_id then v_loss_points
        else v_draw_points
      end as points
    from result_rows
  ), aggregated as (
    select
      season_id,
      division_id,
      team_id,
      sum(played)::int as played,
      sum(won)::int as won,
      sum(drawn)::int as drawn,
      sum(lost)::int as lost,
      sum(score_diff)::int as score_diff,
      sum(points)::int as points
    from team_rows
    group by season_id, division_id, team_id
  )
  update public.standings s
  set played = a.played,
      won = a.won,
      drawn = a.drawn,
      lost = a.lost,
      score_diff = a.score_diff,
      points = a.points,
      division_id = a.division_id,
      updated_at = now()
  from aggregated a
  where s.season_id = a.season_id
    and s.team_id = a.team_id;
end;
$$;

grant execute on function public.score_text_total(text) to authenticated;
grant execute on function public.recalculate_standings_for_season(uuid) to authenticated;

notify pgrst, 'reload schema';
