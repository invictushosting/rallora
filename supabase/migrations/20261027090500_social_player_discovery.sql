begin;
-- Separate consent: account and club registrations never imply discovery permission.
create table public.rallora_player_discovery (
 user_id uuid primary key references auth.users(id) on delete cascade,
 is_visible boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.rallora_player_discovery enable row level security;
revoke all on public.rallora_player_discovery from public,anon,authenticated;
grant select,insert,update on public.rallora_player_discovery to authenticated;
create policy discovery_self_read on public.rallora_player_discovery
 for select to authenticated using(user_id=(select auth.uid()));
create policy discovery_self_insert on public.rallora_player_discovery
 for insert to authenticated with check(user_id=(select auth.uid()));
create policy discovery_self_update on public.rallora_player_discovery
 for update to authenticated using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()));

create table public.rallora_partner_requests (
 id uuid primary key default gen_random_uuid(),
 from_user uuid not null references auth.users(id) on delete cascade,
 to_user uuid not null references auth.users(id) on delete cascade,
 message text check (message is null or char_length(message) <= 280),
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(from_user<>to_user),
 unique(from_user,to_user)
);
create index rallora_partner_requests_recipient_idx on public.rallora_partner_requests(to_user,created_at desc);
alter table public.rallora_partner_requests enable row level security;
revoke all on public.rallora_partner_requests from public,anon,authenticated;
grant select on public.rallora_partner_requests to authenticated;
create policy partner_requests_participants_read on public.rallora_partner_requests
 for select to authenticated using(from_user=(select auth.uid()) or to_user=(select auth.uid()));

-- Only opt-in players can search, and only opt-in, open-to-partner players appear.
-- Never return phone/email or any unconsented private profile fields.
create function public.rallora_find_partners(p_limit integer default 30)
returns table(user_id uuid,display_name text,playing_level text,home_town text,partner_preference text,shared_clubs integer,match_score integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(
   select 1 from public.rallora_player_discovery d where d.user_id=auth.uid() and d.is_visible
 ) then raise exception 'Enable player discovery before browsing'; end if;
 return query
 select p.user_id,p.display_name,p.playing_level,p.home_town,p.partner_preference,
   (select count(*)::integer from unnest(p.preferred_club_ids) club_id
       where club_id=any(me.preferred_club_ids)) as shared_clubs,
   (case when p.playing_level=me.playing_level and p.playing_level is not null then 30 else 0 end
    + case when p.home_town is not null and me.home_town is not null and lower(p.home_town)=lower(me.home_town) then 20 else 0 end
    + 15 * (select count(*)::integer from unnest(p.preferred_club_ids) club_id
       where club_id=any(me.preferred_club_ids))) as match_score
 from public.rallora_player_profiles p
 join public.rallora_player_discovery d on d.user_id=p.user_id and d.is_visible
 cross join public.rallora_player_profiles me
 where me.user_id=auth.uid() and p.user_id<>auth.uid()
   and p.partner_preference in ('looking','open')
 order by match_score desc,p.display_name,p.user_id
 limit least(greatest(coalesce(p_limit,30),1),40);
end $$;

-- Send request without giving either party their contact details.
create function public.rallora_request_partner(p_to uuid,p_message text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or p_to is null or p_to=auth.uid() then raise exception 'Invalid recipient'; end if;
 if not exists(select 1 from public.rallora_player_discovery where user_id=auth.uid() and is_visible)
    or not exists(select 1 from public.rallora_player_discovery d
      join public.rallora_player_profiles p on p.user_id=d.user_id
      where d.user_id=p_to and d.is_visible and p.partner_preference in ('looking','open'))
 then raise exception 'Both players must opt in to partner discovery'; end if;
 if char_length(coalesce(p_message,''))>280 then raise exception 'Message too long'; end if;
 if exists(select 1 from public.rallora_partner_requests
   where from_user=auth.uid() and created_at>now()-interval '24 hours')
   and (select count(*) from public.rallora_partner_requests
   where from_user=auth.uid() and created_at>now()-interval '24 hours')>=5
 then raise exception 'Daily partner request limit reached'; end if;
 insert into public.rallora_partner_requests(from_user,to_user,message)
 values(auth.uid(),p_to,nullif(trim(p_message),''))
 on conflict(from_user,to_user) do update set
   message=excluded.message,status='pending',updated_at=now()
   where public.rallora_partner_requests.status in ('cancelled','declined')
 returning id into v_id;
 if v_id is null then raise exception 'Request already exists'; end if;
 return v_id;
end $$;

create function public.rallora_answer_partner_request(p_request_id uuid,p_decision text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_decision not in ('accepted','declined','cancelled') then raise exception 'Invalid decision'; end if;
 if p_decision='cancelled' then
   update public.rallora_partner_requests set status='cancelled',updated_at=now()
   where id=p_request_id and from_user=auth.uid() and status='pending';
 else
   update public.rallora_partner_requests set status=p_decision,updated_at=now()
   where id=p_request_id and to_user=auth.uid() and status='pending';
 end if;
 if not found then raise exception 'Request not available'; end if;
end $$;
revoke all on function public.rallora_find_partners(integer),
 public.rallora_request_partner(uuid,text),
 public.rallora_answer_partner_request(uuid,text) from public,anon;
grant execute on function public.rallora_find_partners(integer),
 public.rallora_request_partner(uuid,text),
 public.rallora_answer_partner_request(uuid,text) to authenticated;
commit;