-- Disposable CI-only tenant tests for proposed Social staging schema.
-- Fixed IDs are invented, never actual customer/user IDs.
begin;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

-- Authenticated A owner can create an A draft from an A confirmed result.
insert into public.rallora_social_posts
(id, club_id, created_by, kind, title, body, source_fixture_id)
values (
'00000000-0000-0000-0000-0000000007a1',
'00000000-0000-0000-0000-0000000000a1',
'00000000-0000-0000-0000-000000000a01',
'result','A confirmed score','Club A result',
'00000000-0000-0000-0000-0000000004a1');

insert into public.rallora_social_post_targets
(id,club_id,post_id,channel,caption)
values (
'00000000-0000-0000-0000-0000000008a1',
'00000000-0000-0000-0000-0000000000a1',
'00000000-0000-0000-0000-0000000007a1',
'whatsapp','A shareable message');

do $$
begin
  if (select count(*) from public.rallora_social_posts) <> 1 then
    raise exception 'A owner should only see A draft';
  end if;
  if (select count(*) from public.rallora_social_post_targets) <> 1 then
    raise exception 'A owner should only see A draft target';
  end if;
  if has_table_privilege('authenticated',
       'public.rallora_social_delivery_jobs','INSERT') then
    raise exception 'Authenticated must not insert delivery jobs';
  end if;
  if has_table_privilege('authenticated',
       'public.rallora_social_connections','INSERT') then
    raise exception 'Authenticated must not insert connected accounts';
  end if;
end $$;

-- A cannot attach an unreleased fixture belonging to B even if its result
-- is confirmed; nor can A write in B's club at all.
do $$
begin
  insert into public.rallora_social_posts
  (id,club_id,created_by,kind,title,body,source_fixture_id)
  values('00000000-0000-0000-0000-0000000007a2',
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000a01',
  'result','Bad source','Must reject foreign score',
  '00000000-0000-0000-0000-0000000004b2');
  raise exception 'Foreign result incorrectly accepted';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  insert into public.rallora_social_posts
  (id,club_id,created_by,title,body)
  values('00000000-0000-0000-0000-0000000007a3',
  '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-000000000a01','B draft','Must reject');
  raise exception 'Cross-club draft incorrectly accepted';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  update public.rallora_social_posts set status='scheduled',
  scheduled_for=now() where id='00000000-0000-0000-0000-0000000007a1';
  raise exception 'Client transitioned draft to scheduled';
exception when insufficient_privilege then null;
end $$;

-- Suspended user has no write access or read access even within club A.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';
do $$
begin
  if (select count(*) from public.rallora_social_posts) <> 0 then
    raise exception 'Suspended member saw A social post';
  end if;
  insert into public.rallora_social_posts
  (id,club_id,created_by,title,body)
  values('00000000-0000-0000-0000-0000000007a4',
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000a02','Suspended','Must reject');
  raise exception 'Suspended member wrote post';
exception when insufficient_privilege then null;
end $$;

-- B owner sees no A data and may create their own draft only.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';
do $$
begin
 if (select count(*) from public.rallora_social_posts) <> 0 then
   raise exception 'B owner leaked A post';
 end if;
 if (select count(*) from public.rallora_social_post_targets) <> 0 then
   raise exception 'B owner leaked A channel target';
 end if;
end $$;
insert into public.rallora_social_posts
(id,club_id,created_by,title,body)
values('00000000-0000-0000-0000-0000000007b2',
'00000000-0000-0000-0000-0000000000b2',
'00000000-0000-0000-0000-000000000b01',
'Club B news','B only');

-- B must not be able to read A, nor attach a target to A's post while claiming B.
do $$
begin
  insert into public.rallora_social_post_targets
    (id,club_id,post_id,channel,caption)
  values('00000000-0000-0000-0000-0000000008b2',
  '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-0000000007a1',
  'instagram','Trying to attach across clubs');
  raise exception 'Cross-club target accepted';
exception when foreign_key_violation then null;
         when insufficient_privilege then null;
end $$;

-- Authenticated members cannot promote their draft to delivery by editing
-- the channel target, either.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';
do $$
begin
  update public.rallora_social_post_targets set status='sent'
  where id='00000000-0000-0000-0000-0000000008a1';
  raise exception 'Client promoted a draft target to sent';
exception when insufficient_privilege then null;
end $$;

rollback;

-- No anonymous table access even if an unrelated league table is published.
do $$
begin
  if has_table_privilege('anon','public.rallora_social_posts','SELECT') then
    raise exception 'Anonymous can read Social drafts';
  end if;
  if has_table_privilege('anon','public.rallora_social_connections','SELECT') then
    raise exception 'Anonymous can read connected account metadata';
  end if;
end $$;
