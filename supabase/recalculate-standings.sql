-- GSM Padel League Hub: safe standings recalculation helper
-- Run this once in Supabase SQL Editor before using result edit/delete controls.

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
begin
  if not public.is_admin() then
    raise exception 'Only admins can recalculate standings';
  end if;

  insert into public.standings (season_id, division_id, team_id, played, won, drawn, lost, score_diff, points)
  select p_season_id, d.id, t.id, 0, 0, 0, 0, 0, 0
  from public.divisions d
  join public.teams t on t.division_id = d.id
  where d.season_id = p_season_id
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
      f.status as fixture_status,
      r.winner_team_id,
      public.score_text_total(r.home_score) - public.score_text_total(r.away_score) as home_diff
    from public.results r
    join public.fixtures f on f.id = r.fixture_id
    where f.season_id = p_season_id
  ), team_rows as (
    select
      season_id,
      division_id,
      home_team_id as team_id,
      1 as played,
      case when winner_team_id = home_team_id then 1 else 0 end as won,
      0 as drawn,
      case when fixture_status = 'double_forfeit' or winner_team_id = away_team_id then 1 else 0 end as lost,
      case when fixture_status in ('forfeit', 'double_forfeit') or winner_team_id is null then 0 else home_diff end as score_diff,
      case when winner_team_id = home_team_id then 3 else 0 end as points
    from result_rows

    union all

    select
      season_id,
      division_id,
      away_team_id as team_id,
      1 as played,
      case when winner_team_id = away_team_id then 1 else 0 end as won,
      0 as drawn,
      case when fixture_status = 'double_forfeit' or winner_team_id = home_team_id then 1 else 0 end as lost,
      case when fixture_status in ('forfeit', 'double_forfeit') or winner_team_id is null then 0 else -home_diff end as score_diff,
      case when winner_team_id = away_team_id then 3 else 0 end as points
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

grant execute on function public.recalculate_standings_for_season(uuid) to authenticated;
grant execute on function public.score_text_total(text) to authenticated;
