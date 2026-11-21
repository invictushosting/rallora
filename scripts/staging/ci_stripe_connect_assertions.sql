begin;
do $$
declare
  club uuid:=gen_random_uuid(); season uuid:=gen_random_uuid(); box uuid:=gen_random_uuid();
  owner_id uuid:=gen_random_uuid(); payer uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  entry uuid:=gen_random_uuid(); version_id uuid; attempt uuid; expired_attempt uuid;
  account_id text:='acct_stripeTestClub'; result jsonb; state_token text; rejected boolean;
begin
  insert into auth.users(id,email) values
    (owner_id,'stripe-owner@example.invalid'),(payer,'stripe-payer@example.invalid'),(outsider,'stripe-other@example.invalid');
  insert into public.clubs(id,slug,name) values (club,'stripe-ci','Stripe CI');
  insert into public.rallora_club_memberships(club_id,user_id,role,status) values (club,owner_id,'owner','active');
  insert into public.seasons(id,club_id,name,status,starts_on,ends_on,registration_published)
    values (season,club,'Card entry league','draft',current_date,current_date+7,true);
  insert into public.divisions(id,season_id,name) values (box,season,'Box');

  if has_function_privilege('authenticated','public.rallora_stripe_reconcile(text,uuid,text,integer,integer)','EXECUTE')
    or has_function_privilege('anon','public.rallora_stripe_checkout(uuid,uuid,uuid,text,boolean)','EXECUTE')
    or has_function_privilege('authenticated','public.rallora_stripe_account(uuid,text,text,boolean)','EXECUTE') then
    raise exception 'Card integration service functions are browser-accessible';
  end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  set local role authenticated;
  rejected:=false;
  begin
    insert into public.rallora_club_entry_fees(season_id,enabled,amount_pence,method,instructions,refund_terms)
      values(season,true,2500,'stripe_connect','Stripe Checkout','Refund terms');
  exception when raise_exception then
    if sqlerrm not like 'Connect a Stripe account%' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'Enabled card payment without an account'; end if;
  reset role;

  set local role service_role;
  if public.rallora_stripe_oauth(outsider,'stripe-ci',null) is not null then raise exception 'Outside user initiated Stripe OAuth'; end if;
  state_token:=public.rallora_stripe_oauth(owner_id,'stripe-ci',null);
  if state_token is null or public.rallora_stripe_oauth(outsider,null,state_token::uuid) is not null then
    raise exception 'OAuth state was not bound to the club owner'; end if;
  if public.rallora_stripe_oauth(owner_id,null,state_token::uuid) is distinct from 'stripe-ci'
    or public.rallora_stripe_oauth(owner_id,null,state_token::uuid) is not null then
    raise exception 'Stripe OAuth state could not be consumed exactly once'; end if;
  result:=public.rallora_stripe_account(owner_id,'stripe-ci',account_id,true);
  if (result->>'ready')::boolean is distinct from true then raise exception 'Stripe connection was not stored'; end if;
  reset role;

  set local role authenticated;
  insert into public.rallora_club_entry_fees(season_id,enabled,amount_pence,method,instructions,refund_terms)
    values(season,true,2500,'stripe_connect','Stripe Checkout','Refund terms')
    returning rallora_club_entry_fees.version into version_id;
  perform set_config('request.jwt.claim.sub',payer::text,true);
  insert into public.rallora_team_applications(id,club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email,entry_fee_version)
    values(entry,club,season,payer,'Test paid pair','Stripe Payer','Stripe Partner','stripe-partner@example.invalid',version_id);
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  rejected:=false;
  begin perform public.rallora_record_entry_payment(entry,'paid');
  exception when raise_exception then
    if sqlerrm<>'Stripe confirms payments and refunds for this entry' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'Manual override accepted on Stripe entry'; end if;
  reset role;

  set local role service_role;
  if public.rallora_stripe_checkout(outsider,entry,null,null,false) is not null then raise exception 'Wrong payer opened checkout'; end if;
  result:=public.rallora_stripe_checkout(payer,entry,null,null,false);
  expired_attempt:=(result->>'attempt')::uuid;
  if result->>'account' is distinct from account_id or (result->>'amount')::int is distinct from 2500 then
    raise exception 'Checkout did not target the club account or the snapshotted fee'; end if;
  perform public.rallora_stripe_checkout(payer,entry,expired_attempt,'cs_test_Expired',false);
  result:=public.rallora_stripe_checkout(payer,entry,expired_attempt,'cs_test_Expired',true);
  attempt:=(result->>'attempt')::uuid;
  if attempt=expired_attempt or result->>'session' is not null then raise exception 'Expired checkout not reset'; end if;
  perform public.rallora_stripe_checkout(payer,entry,attempt,'cs_test_Current',false);
  result:=public.rallora_stripe_checkout(payer,entry,null,null,false);
  if result->>'session' is distinct from 'cs_test_Current' or (result->>'attempt')::uuid is distinct from attempt then
    raise exception 'Checkout did not reuse the bound session'; end if;
  if public.rallora_stripe_reconcile('acct_elsewhere',attempt,'cs_test_Current',2500,0)
    or public.rallora_stripe_reconcile(account_id,attempt,'cs_test_Current',2400,0)
    or public.rallora_stripe_reconcile(account_id,expired_attempt,'cs_test_Expired',2500,0) then
    raise exception 'Reconciliation accepted the wrong club, amount or attempt'; end if;
  if not public.rallora_stripe_reconcile(account_id,attempt,'cs_test_Current',2500,0) then raise exception 'Card payment was not recorded'; end if;
  perform public.rallora_stripe_reconcile(account_id,attempt,'cs_test_Current',2500,0);
  reset role;

  set local role authenticated;
  perform public.rallora_review_team_application(entry,'approved',box);
  reset role;
  set local role service_role;
  perform public.rallora_stripe_reconcile(account_id,attempt,'cs_test_Current',2500,500);
  perform public.rallora_stripe_reconcile(account_id,attempt,'cs_test_Current',2500,2500);
  perform public.rallora_stripe_reconcile(account_id,attempt,'cs_test_Current',2500,0);
  perform public.rallora_stripe_account_event(account_id,false,false);
  perform public.rallora_stripe_account_event(account_id,true,true);
  result:=public.rallora_stripe_account(owner_id,'stripe-ci',null,null);
  if (result->>'ready')::boolean is distinct from false then raise exception 'Stale update reactivated deauthorised account'; end if;
  reset role;

  if (select status from public.rallora_entry_payments where application_id=entry) is distinct from 'refunded' then
    raise exception 'Delayed payment event reopened a refunded entry'; end if;
  if (select array_agg(action order by id) from rallora_private.entry_payment_audit where application_id=entry)
      is distinct from array['paid','partially_refunded','refunded'] then raise exception 'Incorrect refund history'; end if;
end $$;
rollback;
