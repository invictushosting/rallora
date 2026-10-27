begin;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
do $$
declare a uuid:='11111111-1111-1111-1111-111111111111';
b uuid:='22222222-2222-2222-2222-222222222222';
c uuid:='00000000-0000-0000-0000-000000000a01';
request_id uuid;
rejected boolean;
begin
 insert into auth.users(id,email) values(c,'discovery-hidden@example.invalid') on conflict do nothing;
 insert into public.rallora_player_profiles(user_id,display_name,playing_level,home_town,partner_preference)
 values(a,'Find me','intermediate','London','looking'),(b,'Other player','intermediate','London','open'),(c,'Hidden player','intermediate','London','looking')
 on conflict(user_id) do update set playing_level=excluded.playing_level,home_town=excluded.home_town,partner_preference=excluded.partner_preference;
 insert into public.rallora_player_discovery(user_id,is_visible) values(a,false),(b,true),(c,false);
 rejected:=false;
 begin perform * from public.rallora_find_partners(20); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Non-opted-in search allowed'; end if;
 update public.rallora_player_discovery set is_visible=true where user_id=a;
 if (select count(*) from public.rallora_find_partners(20))<>1 then raise exception 'Hidden profile leaked or visible candidate missing'; end if;
 if not exists(select 1 from public.rallora_find_partners(20) f where f.user_id=b and f.match_score>=50) then
  raise exception 'Partner match score missing'; end if;
 request_id:=public.rallora_request_partner(b,'Would you like to play?');
 if not exists(select 1 from public.rallora_partner_requests where id=request_id and status='pending') then raise exception 'Request missing'; end if;
 rejected:=false;
 begin perform public.rallora_request_partner(c); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Unconsented recipient accepted'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.rallora_answer_partner_request(request_id,'accepted');
 if not exists(select 1 from public.rallora_partner_requests where id=request_id and status='accepted') then raise exception 'Acceptance failed'; end if;
 perform set_config('request.jwt.claim.sub',c::text,true);
 rejected:=false;
 begin perform public.rallora_answer_partner_request(request_id,'declined'); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Nonparticipant could answer request'; end if;
 if has_function_privilege('anon','public.rallora_find_partners(integer)','execute') or
 has_function_privilege('anon','public.rallora_request_partner(uuid,text)','execute') then
 raise exception 'Anonymous partner search or requests enabled'; end if;
end $$;
rollback;
