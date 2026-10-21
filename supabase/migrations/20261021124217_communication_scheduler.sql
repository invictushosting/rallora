begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create function rallora_private.communication_tick() returns void language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 perform rallora_private.generate_reminders();
 select token into secret from rallora_private.delivery_worker_config where singleton;
 perform net.http_post(url:='https://www.rallora.app/api/internal/deliveries',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:='{}'::jsonb,timeout_milliseconds:=180000);
end $$;
revoke all on function rallora_private.communication_tick() from public,anon,authenticated;
select cron.schedule('rallora-club-communications','*/5 * * * *','select rallora_private.communication_tick();');
commit;
