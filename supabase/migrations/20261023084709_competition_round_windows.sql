-- A competition's planned playing windows travel with each rolling cycle.
-- Existing leagues keep the empty plan and their manual fixture controls.
alter table public.seasons
  add column if not exists round_windows jsonb not null default '[]'::jsonb;
alter table public.seasons
  add constraint seasons_round_windows_array check (
    jsonb_typeof(round_windows) = 'array' and jsonb_array_length(round_windows) <= 120
  );
comment on column public.seasons.round_windows is
  'Ordered inclusive playing windows, each with starts_on and ends_on. Organisers prepare and activate each next cycle; the plan does not automatically publish fixtures.';
