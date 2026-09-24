-- Team-led registration: a captain registers a new team for organiser approval.
begin;

create table public.rallora_team_applications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  team_name text not null check (char_length(trim(team_name)) between 2 and 120),
  captain_name text not null check (char_length(trim(captain_name)) between 2 and 120),
  captain_phone text check (captain_phone is null or char_length(trim(captain_phone)) <= 40),
  captain_playtomic_rating numeric(4,2) check (captain_playtomic_rating is null or captain_playtomic_rating between 0 and 10),
  partner_name text not null check (char_length(trim(partner_name)) between 2 and 120),
  partner_email text check (partner_email is null or char_length(trim(partner_email)) <= 254),
  partner_playtomic_rating numeric(4,2) check (partner_playtomic_rating is null or partner_playtomic_rating between 0 and 10),
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn')),
  organiser_note text check (organiser_note is null or char_length(organiser_note) <= 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index rallora_team_application_one_pending_idx on public.rallora_team_applications(season_id,requested_by) where status='pending';
alter table public.rallora_team_applications enable row level security;
revoke all on public.rallora_team_applications from public,anon;
grant select,insert,update on public.rallora_team_applications to authenticated;
create policy "team_application_owner_read" on public.rallora_team_applications for select to authenticated using(requested_by=auth.uid());
create policy "team_application_manager_read" on public.rallora_team_applications for select to authenticated using(public.rallora_can_manage_club(club_id));
create policy "team_application_owner_insert" on public.rallora_team_applications for insert to authenticated with check(
 requested_by=auth.uid() and status='pending' and reviewed_by is null and reviewed_at is null
 and exists(select 1 from public.divisions d join public.seasons s on s.id=d.season_id join public.clubs c on c.id=s.club_id where d.id=division_id and s.id=season_id and c.id=club_id and s.status='active' and c.is_active)
);
create policy "team_application_owner_withdraw" on public.rallora_team_applications for update to authenticated
 using(requested_by=auth.uid() and status='pending')
 with check(requested_by=auth.uid() and status='withdrawn' and reviewed_by is null and reviewed_at is null);

create or replace function public.rallora_review_team_application(p_application_id uuid,p_decision text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.rallora_team_applications%rowtype; v_team uuid; v_request uuid;
begin
 if p_decision not in ('approved','declined') then raise exception 'Invalid decision'; end if;
 select * into a from public.rallora_team_applications where id=p_application_id for update;
 if not found then raise exception 'Application not found'; end if;
 if not public.rallora_can_manage_club(a.club_id) then raise exception 'Not authorised'; end if;
 if a.status<>'pending' then raise exception 'Application already reviewed'; end if;
 if p_decision='approved' then
   insert into public.teams(division_id,name,player_one_name,player_two_name,is_active)
   values(a.division_id,trim(a.team_name),trim(a.captain_name),trim(a.partner_name),true) returning id into v_team;
   insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,player_phone,status,reviewed_by,reviewed_at)
   values(a.club_id,a.season_id,a.division_id,v_team,a.requested_by,a.captain_name,a.captain_phone,'approved',auth.uid(),now()) returning id into v_request;
   insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by)
   values(v_request,a.club_id,a.season_id,a.division_id,v_team,a.requested_by,'captain',auth.uid())
   on conflict(team_id,player_user_id) do update set role='captain';
 end if;
 update public.rallora_team_applications set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),created_team_id=v_team,updated_at=now() where id=a.id;
 return v_team;
end $$;
revoke all on function public.rallora_review_team_application(uuid,text) from public,anon;
grant execute on function public.rallora_review_team_application(uuid,text) to authenticated;
commit;