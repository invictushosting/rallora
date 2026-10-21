begin;
alter table public.sponsors
  add column scope_type text not null default 'club' check (scope_type in ('club','league','division','event')),
  add column scope_id uuid,
  add column is_main boolean not null default false,
  add constraint sponsor_scope_target check ((scope_type='club' and scope_id is null) or (scope_type<>'club' and scope_id is not null)),
  add constraint sponsor_main_is_club check (not is_main or scope_type='club');
alter table public.clubs add column sponsor_enquiries_enabled boolean not null default true;
create unique index sponsors_one_active_main_per_club on public.sponsors(club_id) where is_main and is_active;
-- Validate every target using the caller's existing club permissions/RLS.
create function public.rallora_validate_sponsor_scope() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.scope_type='league' and not exists(select 1 from public.seasons where id=new.scope_id and club_id=new.club_id) then
    raise exception 'Choose a league belonging to this club.';
  elsif new.scope_type='division' and not exists(select 1 from public.divisions d join public.seasons s on s.id=d.season_id where d.id=new.scope_id and s.club_id=new.club_id) then
    raise exception 'Choose a division belonging to this club.';
  elsif new.scope_type='event' and not exists(select 1 from public.rallora_club_events where id=new.scope_id and club_id=new.club_id) then
    raise exception 'Choose an event belonging to this club.';
  end if;
  return new;
end $$;
create trigger sponsor_scope_belongs_to_club before insert or update on public.sponsors
for each row execute function public.rallora_validate_sponsor_scope();
revoke all on function public.rallora_validate_sponsor_scope() from public;
-- Existing tenant-scoped sponsor/club RLS continues to govern all reads and writes.
notify pgrst,'reload schema';
commit;
