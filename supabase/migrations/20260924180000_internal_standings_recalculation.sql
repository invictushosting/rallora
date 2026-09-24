-- Make standings recalculation an internal-only primitive so captain confirmation can safely invoke it.
begin;

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
  where cr.season_id = p_season_id
     or cr.club_id = v_club_id
     or cr.season_id is null
  order by cr.updated_at desc nulls last, cr.created_at desc nulls last
  limit 1;

  insert into public.standings(season_id,division_id,team_id,played,won,drawn,lost,score_diff,points)
  select p_season_id,d.id,t.id,0,0,0,0,0,0
  from public.divisions d
  join public.teams t on t.division_id=d.id
  where d.season_id=p_season_id and coalesce(t.is_active,true)
  on conflict(season_id,team_id) do nothing;

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

commit;