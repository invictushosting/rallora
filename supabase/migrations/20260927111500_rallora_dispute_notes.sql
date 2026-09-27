-- Capture dispute context without overwriting the originally submitted result.
begin;
create or replace function public.rallora_dispute_captain_result(p_submission_id uuid,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare v_submission public.result_submissions%rowtype;v_opponent uuid;
begin
 if nullif(trim(p_note),'') is null then raise exception 'Please explain why the result is disputed'; end if;
 if length(trim(p_note))>1000 then raise exception 'Dispute information is too long'; end if;
 select rs.* into v_submission from public.result_submissions rs where rs.id=p_submission_id and rs.status='pending_opponent' for update;
 if not found then raise exception 'Submission is not awaiting review'; end if;
 select case when f.home_team_id=v_submission.submitting_team_id then f.away_team_id else f.home_team_id end into v_opponent from public.fixtures f where f.id=v_submission.fixture_id for update;
 if v_opponent is null then raise exception 'Fixture not found'; end if;
 if not public.is_captain_for_team(v_opponent) and not public.rallora_can_manage_fixture(v_submission.fixture_id) then raise exception 'Only the opposing captain or a club organiser can dispute this result'; end if;
 update public.result_submissions set status='disputed',notes=trim(p_note),opponent_confirmed_by_user_id=null,confirmed_at=null,updated_at=now() where id=p_submission_id;
 update public.fixtures set status='disputed' where id=v_submission.fixture_id;
end;$$;
revoke all on function public.rallora_dispute_captain_result(uuid,text) from public,anon;
grant execute on function public.rallora_dispute_captain_result(uuid,text) to authenticated;
commit;
