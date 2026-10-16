-- Run only after /api/cron/nightwatch-schedules is deployed and its bearer
-- secret matches tic_research_worker_secret in Supabase Vault.
-- Supabase Cron is minute-granularity; entered seconds are preserved in the
-- schedule and dispatched on the first poll after that time.
do $$
declare
  v_job_id bigint;
  v_worker_url text;
  v_worker_secret text;
begin
  if to_regclass('cron.job') is null or to_regprocedure('cron.schedule(text,text,text)') is null
     or to_regprocedure('cron.unschedule(bigint)') is null
     or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'pg_cron and pg_net must be installed before enabling Nightwatch schedules';
  end if;
  select decrypted_secret into v_worker_url from vault.decrypted_secrets where name='tic_research_worker_url';
  select decrypted_secret into v_worker_secret from vault.decrypted_secrets where name='tic_research_worker_secret';
  if v_worker_url !~ '^https://[^/]+/api/cron/tic-research/?$' or v_worker_secret is null or length(v_worker_secret)<32 then
    raise exception 'The verified Tidelight research worker URL and secret must be configured in Vault';
  end if;

  select jobid into v_job_id from cron.job where jobname='nightwatch-custom-schedules';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'nightwatch-custom-schedules',
    '* * * * *',
    'select private.invoke_nightwatch_schedule_worker();'
  );
end;
$$;
