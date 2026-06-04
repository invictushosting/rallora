-- Rallora Rules Page + Admin Rules Editor support
-- Safe to run more than once.

create table if not exists public.club_rules (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  rule_preset text not null default 'standard',
  score_format text,
  fixture_rules text,
  deadline_rules text,
  forfeit_rules text,
  result_submission_rules text,
  captain_confirmation_rules text,
  league_cup_rules text,
  custom_rules text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(club_id, season_id)
);

alter table public.club_rules enable row level security;

drop policy if exists "Public can read active club rules" on public.club_rules;
create policy "Public can read active club rules"
on public.club_rules
for select
using (
  exists (
    select 1
    from public.clubs c
    where c.id = club_rules.club_id
      and c.is_active = true
  )
);

drop policy if exists "Admins can manage club rules" on public.club_rules;
create policy "Admins can manage club rules"
on public.club_rules
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create index if not exists club_rules_club_id_idx on public.club_rules(club_id);
create index if not exists club_rules_season_id_idx on public.club_rules(season_id);

insert into public.club_rules (
  club_id,
  season_id,
  rule_preset,
  score_format,
  fixture_rules,
  deadline_rules,
  forfeit_rules,
  result_submission_rules,
  captain_confirmation_rules,
  league_cup_rules,
  custom_rules
)
select
  c.id,
  s.id,
  'standard',
  'Best of 3 sets',
  'Teams arrange their own fixture time. Matches should be played before the listed deadline unless agreed by the organiser.',
  'Results should be submitted before the next fixture release or before the fixture pack deadline.',
  'If one team fails to respond, arrange or attend, the organiser may award a forfeit win. If both teams fail to arrange, both teams may receive 0 points.',
  'One captain submits the score. The opposing captain or organiser can confirm, dispute or correct the result.',
  'Captains are responsible for arranging fixtures, submitting results and raising disputes quickly.',
  'Cup qualification can be automatic based on league position or manually selected by the organiser.',
  ''
from public.clubs c
left join lateral (
  select id
  from public.seasons
  where status = 'active'
  order by created_at desc
  limit 1
) s on true
where c.is_active = true
on conflict (club_id, season_id) do nothing;

notify pgrst, 'reload schema';
