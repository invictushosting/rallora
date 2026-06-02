-- GSM Padel League Cup + sponsor slot support

alter table public.sponsors
  add column if not exists placement text not null default 'homepage',
  add column if not exists logo_url text,
  add column if not exists website_url text;

update public.sponsors
set placement = case
  when lower(coalesce(sponsor_type, '')) like '%cup%' then 'cup'
  when lower(coalesce(sponsor_type, '')) like '%league%' then 'league'
  when lower(coalesce(sponsor_type, '')) like '%division%' then 'division'
  else coalesce(nullif(placement, ''), 'homepage')
end;

insert into public.sponsors (name, sponsor_type, placement, sort_order, is_active)
select 'GSM League Cup', 'Cup Sponsor', 'cup', 1, true
where not exists (
  select 1 from public.sponsors where lower(name) = lower('GSM League Cup')
);

notify pgrst, 'reload schema';
