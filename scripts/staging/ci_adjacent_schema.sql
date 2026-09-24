-- Minimal synthetic schema for the production adjacent-table migration.
create table public.announcements (id uuid primary key, club_id uuid, title text, body text, is_published boolean not null);
create table public.sponsors (id uuid primary key, club_id uuid, name text, is_active boolean not null);
create table public.club_rules (id uuid primary key, club_id uuid not null, season_id uuid, win_points integer, draw_points integer, loss_points integer, forfeit_win_points integer, forfeit_loss_points integer, double_forfeit_points integer, updated_at timestamptz not null default now());
create table public.club_setup_profiles (id uuid primary key, club_id uuid not null, season_id uuid);
create table public.standings (id uuid primary key default gen_random_uuid(), season_id uuid not null, division_id uuid not null, team_id uuid not null, played integer not null default 0, won integer not null default 0, drawn integer not null default 0, lost integer not null default 0, score_diff integer not null default 0, points integer not null default 0, updated_at timestamptz not null default now(), unique(season_id,team_id));
create table public.cup_qualifier_rules (id uuid primary key, season_id uuid not null, division_id uuid not null, is_active boolean not null);
create table public.cup_manual_qualifiers (id uuid primary key, season_id uuid not null, team_id uuid not null, is_active boolean not null);

insert into public.announcements values
 ('10000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','A news','A',true),
 ('10000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','B draft','B',false);
insert into public.sponsors values
 ('20000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','A sponsor',true),
 ('20000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','B sponsor',true);
insert into public.club_rules values
 ('30000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000001a1'),
 ('30000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000001b2');
insert into public.club_setup_profiles values
 ('40000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000001a1'),
 ('40000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000001b2');
insert into public.standings(id,season_id,division_id,team_id,points) values
 ('50000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000001a1','00000000-0000-0000-0000-0000000002a1','00000000-0000-0000-0000-0000000003a1',3),
 ('50000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000001b2','00000000-0000-0000-0000-0000000002b2','00000000-0000-0000-0000-0000000003b1',3);
insert into public.cup_qualifier_rules values
 ('60000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000001a1','00000000-0000-0000-0000-0000000002a1',true),
 ('60000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000001b2','00000000-0000-0000-0000-0000000002b2',true);
insert into public.cup_manual_qualifiers values
 ('70000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000001a1','00000000-0000-0000-0000-0000000003a1',true),
 ('70000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000001b2','00000000-0000-0000-0000-0000000003b1',true);

grant select on public.announcements,public.sponsors,public.club_rules,public.club_setup_profiles,
 public.standings,public.cup_qualifier_rules,public.cup_manual_qualifiers to anon,authenticated;
grant insert,update,delete on public.announcements,public.sponsors,public.club_rules,public.club_setup_profiles,
 public.standings,public.cup_qualifier_rules,public.cup_manual_qualifiers to authenticated;
