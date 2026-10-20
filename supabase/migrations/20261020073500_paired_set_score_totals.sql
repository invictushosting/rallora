-- Preserve scores recorded through the old mirrored-set entry examples.
begin;
create or replace function public.score_text_total(input_text text)
returns integer language sql immutable set search_path='pg_catalog','public' as $$
  select case
    when coalesce(input_text,'') ~ '^[[:space:]]*[0-9]+[[:space:]]*[-:–—][[:space:]]*[0-9]+([[:space:]]*,[[:space:]]*[0-9]+[[:space:]]*[-:–—][[:space:]]*[0-9]+)*[[:space:]]*$'
    then (select coalesce(sum((m)[1]::int),0)::int
      from regexp_matches(input_text,'([0-9]+)[[:space:]]*[-:–—][[:space:]]*[0-9]+','g') as m)
    else (select coalesce(sum((m)[1]::int),0)::int
      from regexp_matches(coalesce(input_text,''),'([0-9]+)','g') as m)
  end;
$$;

-- Rebuild only seasons whose official results used that representation.
-- No scores, winners, submissions or publication settings are rewritten.
do $$
declare v_season uuid;
begin
  for v_season in
    select distinct f.season_id from public.results r
    join public.fixtures f on f.id=r.fixture_id
    where lower(coalesce(r.status,'confirmed')) in ('confirmed','admin_override','approved','admin_approved')
      and (r.home_score ~ '^[[:space:]]*[0-9]+[[:space:]]*[-:–—][[:space:]]*[0-9]+([[:space:]]*,[[:space:]]*[0-9]+[[:space:]]*[-:–—][[:space:]]*[0-9]+)*[[:space:]]*$'
        or r.away_score ~ '^[[:space:]]*[0-9]+[[:space:]]*[-:–—][[:space:]]*[0-9]+([[:space:]]*,[[:space:]]*[0-9]+[[:space:]]*[-:–—][[:space:]]*[0-9]+)*[[:space:]]*$')
  loop
    perform public.recalculate_standings_for_season(v_season);
  end loop;
end $$;
commit;
