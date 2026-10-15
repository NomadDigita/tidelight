-- Reuse the existing Vault-protected worker bearer and Supabase pg_net dispatch.
create or replace function private.invoke_tic_webhook_worker()
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare worker_url text; worker_secret text; request_id bigint;
begin
  select decrypted_secret into worker_url from vault.decrypted_secrets where name='tic_research_worker_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name='tic_research_worker_secret';
  if worker_url is null or worker_secret is null then raise exception 'Tidelight webhook worker Vault configuration is missing'; end if;
  worker_url := regexp_replace(worker_url, '/api/cron/tic-research/?$', '/api/cron/tic-webhooks');
  if worker_url = (select decrypted_secret from vault.decrypted_secrets where name='tic_research_worker_url') then
    raise exception 'Tidelight research worker URL does not have the expected path';
  end if;
  select net.http_post(url:=worker_url,headers:=jsonb_build_object('Authorization','Bearer '||worker_secret),body:='{}'::jsonb,timeout_milliseconds:=10000) into request_id;
  return request_id;
end;
$$;
revoke all on function private.invoke_tic_webhook_worker() from public,anon,authenticated,service_role;
do $$
declare prior record;
begin
  for prior in select jobid from cron.job where jobname='tic-webhook-worker' loop perform cron.unschedule(prior.jobid); end loop;
  perform cron.schedule('tic-webhook-worker','* * * * *','select private.invoke_tic_webhook_worker();');
end;
$$;

create or replace function private.cleanup_tic_webhook_history()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare deleted_count integer;
begin
  with expired as (
    select id from public.tic_webhook_deliveries
    where created_at < now() - interval '90 days' and status in ('succeeded','failed','cancelled')
    order by created_at limit 10000 for update skip locked
  ), removed as (
    delete from public.tic_webhook_deliveries d using expired e where d.id=e.id returning d.id
  ) select count(*)::integer into deleted_count from removed;
  return coalesce(deleted_count,0);
end;
$$;
revoke all on function private.cleanup_tic_webhook_history() from public,anon,authenticated,service_role;
do $$
declare prior record;
begin
  for prior in select jobid from cron.job where jobname='tic-webhook-retention' loop perform cron.unschedule(prior.jobid); end loop;
  perform cron.schedule('tic-webhook-retention','15 3 * * *','select private.cleanup_tic_webhook_history();');
end;
$$;
