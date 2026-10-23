begin;
create temporary table round_window_check (like public.seasons including defaults including constraints) on commit drop;
insert into round_window_check (id,club_id,name,round_windows) values (gen_random_uuid(),gen_random_uuid(),'Schedule verification','[{"starts_on":"2026-11-02","ends_on":"2026-12-01"},{"starts_on":"2026-12-02","ends_on":"2027-01-01"},{"starts_on":"2027-01-02","ends_on":"2027-02-01"}]');
do $$
declare source_row public.seasons; next_row public.seasons;
begin
  select * into source_row from round_window_check limit 1;
  next_row:=jsonb_populate_record(null::public.seasons,to_jsonb(source_row)||jsonb_build_object('rolling_cycle_number',2));
  if jsonb_array_length(next_row.round_windows)<>3 or next_row.round_windows<>source_row.round_windows then raise exception 'Saved plan must carry into the next cycle'; end if;
  begin
    insert into round_window_check(id,club_id,name,round_windows) values (gen_random_uuid(),gen_random_uuid(),'Invalid plan','{}');
    raise exception 'Invalid plan was accepted';
  exception when check_violation then null;
  end;
end $$;
rollback;
