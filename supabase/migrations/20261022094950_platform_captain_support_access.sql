-- Recovered from the production migration ledger; already applied.
begin;

-- Explicit read permission for the support view; normal captain policies remain.
create policy platform_support_submission_read on public.result_submissions
 for select to authenticated using ((select public.rallora_is_platform_admin()));

-- Platform operators act as themselves for an explicitly selected pairing.
-- Do not add fake roster memberships or change the caller's auth identity.
create function rallora_private.platform_submit_captain_result(
 p_fixture_id uuid,p_team_id uuid,p_home_score text,p_away_score text,
 p_winner_team_id uuid default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare f public.fixtures%rowtype;s public.seasons%rowtype;submission_id uuid;
begin
 if auth.uid() is null or not public.rallora_is_platform_admin() then raise exception 'Platform administrator access required'; end if;
 select * into f from public.fixtures where id=p_fixture_id for update;
 if not found then raise exception 'Fixture not found'; end if;
 if p_team_id is null or p_team_id not in(f.home_team_id,f.away_team_id) then raise exception 'Choose a pairing from this fixture'; end if;
 select * into s from public.seasons where id=f.season_id for share;
 if s.status<>'active' or f.status<>'open' or exists(select 1 from public.seasons where previous_season_id=s.id) then raise exception 'This fixture is locked'; end if;
 if nullif(trim(p_home_score),'') is null or nullif(trim(p_away_score),'') is null then raise exception 'Both scores are required'; end if;
 if length(trim(p_home_score))>100 or length(trim(p_away_score))>100 then raise exception 'Score is too long'; end if;
 if p_notes is not null and length(trim(p_notes))>1000 then raise exception 'Notes are too long'; end if;
 if p_winner_team_id is not null and p_winner_team_id not in(f.home_team_id,f.away_team_id) then raise exception 'Invalid winner'; end if;
 if exists(select 1 from public.results where fixture_id=f.id and status in('confirmed','admin_override')) then raise exception 'This fixture already has an official result'; end if;
 if exists(select 1 from public.result_submissions where fixture_id=f.id and status in('pending_opponent','confirmed_by_opponent','admin_approved','disputed')) then raise exception 'This fixture already has a result to review'; end if;
 insert into public.result_submissions(fixture_id,submitting_team_id,submitted_by_user_id,home_score,away_score,winner_team_id,notes,status,updated_at)
 values(f.id,p_team_id,auth.uid(),trim(p_home_score),trim(p_away_score),p_winner_team_id,nullif(trim(p_notes),''),'pending_opponent',now())
 on conflict(fixture_id,submitting_team_id) do update set submitted_by_user_id=auth.uid(),home_score=excluded.home_score,away_score=excluded.away_score,
 winner_team_id=excluded.winner_team_id,notes=excluded.notes,status='pending_opponent',dispute_note=null,opponent_confirmed_by_user_id=null,confirmed_at=null,updated_at=now()
 returning id into submission_id;
 update public.fixtures set status='submitted' where id=f.id;
 return submission_id;
end $$;
revoke all on function rallora_private.platform_submit_captain_result(uuid,uuid,text,text,uuid,text) from public,anon;
grant execute on function rallora_private.platform_submit_captain_result(uuid,uuid,text,text,uuid,text) to authenticated;

create function public.rallora_platform_submit_captain_result(
 p_fixture_id uuid,p_team_id uuid,p_home_score text,p_away_score text,
 p_winner_team_id uuid default null,p_notes text default null
) returns uuid language sql security invoker set search_path='' as $$
 select rallora_private.platform_submit_captain_result(p_fixture_id,p_team_id,p_home_score,p_away_score,p_winner_team_id,p_notes);
$$;
revoke all on function public.rallora_platform_submit_captain_result(uuid,uuid,text,text,uuid,text) from public,anon;
grant execute on function public.rallora_platform_submit_captain_result(uuid,uuid,text,text,uuid,text) to authenticated;
commit;

