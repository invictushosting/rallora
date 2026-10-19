begin;

-- Enforce readiness on direct writes as well as the organiser RPC. Existing
-- active rows are not revalidated by this migration or unrelated edits.
create function rallora_private.guard_competition_activation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status is distinct from 'active' then return new; end if;
  if tg_op='UPDATE' and old.status='active' and old.club_id=new.club_id then return new; end if;
  -- A club lock serialises competing activations, without blocking FK key-share reads.
  perform id from public.clubs where id=new.club_id for no key update;
  if exists(select 1 from public.seasons where previous_season_id=new.id) then
    raise exception 'This cycle has a successor and cannot be reactivated';
  end if;
  if new.registration_published then raise exception 'Close registration before activating the competition'; end if;
  perform id from public.divisions where season_id=new.id order by id for update;
  perform t.id from public.teams t join public.divisions d on d.id=t.division_id
    where d.season_id=new.id order by t.id for share of t;
  perform id from public.fixtures where season_id=new.id order by id for share;
  if not exists(select 1 from public.divisions where season_id=new.id) then
    raise exception 'Create divisions before activating the competition';
  end if;
  if exists(select 1 from public.divisions d left join public.teams t
    on t.division_id=d.id and coalesce(t.is_active,true) where d.season_id=new.id
    group by d.id having count(t.id)<2) then
    raise exception 'Assign at least two active pairings to every division before activating';
  end if;
  if exists(select 1 from public.teams t join public.divisions d on d.id=t.division_id
    where d.season_id=new.id and coalesce(t.is_active,true) and not exists(
      select 1 from public.fixtures f
      join public.teams h on h.id=f.home_team_id and h.division_id=d.id and coalesce(h.is_active,true)
      join public.teams a on a.id=f.away_team_id and a.division_id=d.id and coalesce(a.is_active,true)
      where f.season_id=new.id and f.division_id=d.id and f.status<>'cancelled'
        and f.home_team_id<>f.away_team_id and t.id in(f.home_team_id,f.away_team_id)
  )) then raise exception 'Create a non-cancelled fixture for every active pairing before activating'; end if;
  if exists(select 1 from public.seasons where club_id=new.club_id and status='active' and id<>new.id) then
    raise exception 'Another competition is active. Use the competition activation control to complete it and launch this one';
  end if;
  return new;
end $$;
revoke all on function rallora_private.guard_competition_activation() from public,anon,authenticated;
create trigger enforce_competition_activation before insert or update of status,club_id
  on public.seasons for each row execute function rallora_private.guard_competition_activation();

create or replace function public.rallora_set_season_status(p_season_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_season public.seasons%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to manage this competition'; end if;
  if p_status is null or p_status not in ('draft','active','completed') then raise exception 'Invalid season status'; end if;
  select * into v_season from public.seasons where id=p_season_id for update;
  if not found then raise exception 'Season not found'; end if;
  if not public.rallora_can_manage_club(v_season.club_id) then raise exception 'Not authorised'; end if;
  if v_season.status=p_status then return; end if;
  if p_status='active' then
    perform id from public.clubs where id=v_season.club_id for no key update;
    update public.seasons set status='completed' where club_id=v_season.club_id and status='active' and id<>p_season_id;
  end if;
  -- The trigger validates this transition. Any failure rolls back completion
  -- of the previous active competition in the same statement/transaction.
  update public.seasons set status=p_status where id=p_season_id;
end $$;
revoke all on function public.rallora_set_season_status(uuid,text) from public,anon;
grant execute on function public.rallora_set_season_status(uuid,text) to authenticated;

commit;
