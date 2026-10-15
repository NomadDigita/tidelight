-- Supabase Cron dispatches the Vercel worker; do not use a sub-daily Vercel
-- Cron here because this deployment's Vercel plan only supports daily jobs.
create extension if not exists pg_net;

create or replace function private.invoke_tic_research_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_url text;
  worker_secret text;
  request_id bigint;
begin
  select decrypted_secret into worker_url
  from vault.decrypted_secrets
  where name = 'tic_research_worker_url';
  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'tic_research_worker_secret';
  if worker_url is null or worker_secret is null then
    raise exception 'Tidelight research worker Vault configuration is missing';
  end if;
  select net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || worker_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function private.invoke_tic_research_worker() from public, anon, authenticated, service_role;

do $$
declare
  prior_job record;
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'tic_research_worker_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'tic_research_worker_secret') then
    raise exception 'Create the Tidelight research worker URL and bearer in Supabase Vault before scheduling it';
  end if;
  for prior_job in select jobid from cron.job where jobname = 'tic-research-worker' loop
    perform cron.unschedule(prior_job.jobid);
  end loop;
  perform cron.schedule(
    'tic-research-worker',
    '* * * * *',
    'select private.invoke_tic_research_worker();'
  );
end;
$$;
