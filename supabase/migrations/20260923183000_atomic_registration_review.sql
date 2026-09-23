-- Make registration review atomic and safe to retry.
begin;
create or replace function public.rallora_review_registration(p_request_id uuid,p_decision text)
returns void language plpgsql security definer set search_path='' as $$
declare v_request public.rallora_team_registration_requests%rowtype;
begin
 if p_decision not in ('approved','declined') then raise exception 'Invalid decision'; end if;
 select * into v_request from public.rallora_team_registration_requests where id=p_request_id for update;
 if not found then raise exception 'Registration request not found'; end if;
 if not public.rallora_can_manage_club(v_request.club_id) then raise exception 'Not authorised'; end if;
 if v_request.status<>'pending' then raise exception 'Registration request has already been reviewed'; end if;
 update public.rallora_team_registration_requests
 set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
 where id=p_request_id;
end;$$;
revoke all on function public.rallora_review_registration(uuid,text) from public,anon;
grant execute on function public.rallora_review_registration(uuid,text) to authenticated;
commit;