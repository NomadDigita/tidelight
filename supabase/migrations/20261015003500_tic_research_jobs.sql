-- Durable, tenant isolated Tidelight Intelligence Cloud research jobs.
create table public.tic_research_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  key_id uuid references public.developer_api_keys(id) on delete set null,
  request_id uuid not null references public.developer_api_requests(id) on delete cascade,
  ticker text not null check (ticker ~ '^[A-Z][A-Z0-9.]{0,9}$'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  status text not null default 'queued' check (status in ('queued','running','retry_wait','complete','failed','cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  max_attempts integer not null default 3 check (max_attempts = 3),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  cancel_requested_at timestamptz,
  result jsonb,
  error_code text check (error_code is null or error_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (project_id, idempotency_key),
  foreign key (project_id, owner_id) references public.developer_projects(id, owner_id) on delete cascade
);
create index tic_research_jobs_queue_idx on public.tic_research_jobs(next_attempt_at, created_at) where status in ('queued','retry_wait');
create index tic_research_jobs_owner_idx on public.tic_research_jobs(owner_id, created_at desc);
create index tic_research_jobs_lease_idx on public.tic_research_jobs(lease_expires_at) where status = 'running';
alter table public.tic_research_jobs enable row level security;
revoke all on public.tic_research_jobs from public, anon, authenticated;
grant all on public.tic_research_jobs to service_role;

alter table public.developer_api_keys drop constraint developer_api_keys_scopes_check;
alter table public.developer_api_keys add constraint developer_api_keys_scopes_check
  check (scopes <@ array['market:read','research:run']::text[] and cardinality(scopes) > 0);

create or replace function public.enqueue_tic_research_job(p_hash text, p_ticker text, p_idempotency_key text)
returns table(job_id uuid, job_status text, request_id uuid, is_duplicate boolean, reason text)
language plpgsql security definer set search_path = public
as $$
declare
  k public.developer_api_keys%rowtype;
  minute_count integer;
  month_count integer;
  hourly_count integer;
  new_request_id uuid;
  existing_job public.tic_research_jobs%rowtype;
  new_job_id uuid;
begin
  select * into k from public.developer_api_keys where key_hash = p_hash for update;
  if not found or k.revoked_at is not null or (k.expires_at is not null and k.expires_at <= now()) then
    return query select null::uuid, null::text, null::uuid, false, 'invalid_key'::text;
    return;
  end if;
  if not 'research:run' = any(k.scopes) then
    return query select null::uuid, null::text, null::uuid, false, 'insufficient_scope'::text;
    return;
  end if;
  if p_ticker !~ '^[A-Z][A-Z0-9.]{0,9}$' or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,128}$' then
    return query select null::uuid, null::text, null::uuid, false, 'invalid_request'::text;
    return;
  end if;
  select count(*) into minute_count from public.developer_api_requests r where r.key_id = k.id and r.created_at >= now() - interval '1 minute';
  select count(*) into month_count from public.developer_api_requests r where r.key_id = k.id and r.created_at >= date_trunc('month', now());
  if minute_count >= k.minute_limit or month_count >= k.monthly_limit then
    return query select null::uuid, null::text, null::uuid, false, 'quota_exceeded'::text;
    return;
  end if;

  -- A project-row lock serializes job budgets across every key in that project.
  perform 1 from public.developer_projects p where p.id = k.project_id and p.owner_id = k.owner_id for update;
  if not found then
    return query select null::uuid, null::text, null::uuid, false, 'project_unavailable'::text;
    return;
  end if;
  insert into public.developer_api_requests(project_id,key_id,owner_id,endpoint)
  values (k.project_id,k.id,k.owner_id,'/v1/research/jobs') returning id into new_request_id;
  update public.developer_api_keys set last_used_at = now() where id = k.id;

  select * into existing_job from public.tic_research_jobs j where j.project_id = k.project_id and j.idempotency_key = p_idempotency_key;
  if found then
    if existing_job.ticker <> p_ticker then
      return query select null::uuid, null::text, new_request_id, false, 'idempotency_conflict'::text;
    else
      return query select existing_job.id, existing_job.status, new_request_id, true, null::text;
    end if;
    return;
  end if;

  select count(*) into hourly_count from public.tic_research_jobs j where j.project_id = k.project_id and j.created_at >= now() - interval '1 hour';
  if hourly_count >= 10 then
    return query select null::uuid, null::text, new_request_id, false, 'job_quota_exceeded'::text;
    return;
  end if;
  insert into public.tic_research_jobs(project_id,owner_id,key_id,request_id,ticker,idempotency_key)
  values (k.project_id,k.owner_id,k.id,new_request_id,p_ticker,p_idempotency_key) returning id into new_job_id;
  return query select new_job_id, 'queued'::text, new_request_id, false, null::text;
end;
$$;

create function public.claim_tic_research_job()
returns table(id uuid, project_id uuid, owner_id uuid, key_id uuid, request_id uuid, ticker text, attempt_count integer, lease_token uuid)
language plpgsql security definer set search_path = public
as $$
declare picked public.tic_research_jobs%rowtype;
begin
  update public.tic_research_jobs j set status='cancelled', completed_at=now(), lease_token=null, lease_expires_at=null
    where j.status='running' and j.lease_expires_at <= now() and j.cancel_requested_at is not null;
  update public.tic_research_jobs j set status='failed', error_code='attempts_exhausted', completed_at=now(), lease_token=null, lease_expires_at=null
    where j.status='running' and j.lease_expires_at <= now() and j.attempt_count >= j.max_attempts;
  select * into picked from public.tic_research_jobs j
    where j.cancel_requested_at is null and j.attempt_count < j.max_attempts and (
      (j.status in ('queued','retry_wait') and j.next_attempt_at <= now()) or
      (j.status='running' and j.lease_expires_at <= now())
    ) order by j.created_at for update skip locked limit 1;
  if not found then return; end if;
  update public.tic_research_jobs j set status='running', attempt_count=j.attempt_count+1,
    lease_token=gen_random_uuid(), lease_expires_at=now()+interval '55 seconds', started_at=coalesce(j.started_at,now()), error_code=null
    where j.id=picked.id returning * into picked;
  return query select picked.id,picked.project_id,picked.owner_id,picked.key_id,picked.request_id,picked.ticker,picked.attempt_count,picked.lease_token;
end;
$$;

create function public.complete_tic_research_job(p_id uuid, p_lease_token uuid, p_result jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare changed_status text;
begin
  update public.tic_research_jobs set
    status=case when cancel_requested_at is null then 'complete' else 'cancelled' end,
    result=case when cancel_requested_at is null then p_result else null end,
    completed_at=now(), lease_token=null, lease_expires_at=null, error_code=null
  where id=p_id and status='running' and lease_token=p_lease_token returning status into changed_status;
  return changed_status;
end;
$$;

create function public.fail_tic_research_job(p_id uuid, p_lease_token uuid, p_error_code text)
returns text language plpgsql security definer set search_path = public as $$
declare changed_status text;
begin
  update public.tic_research_jobs set
    status=case when cancel_requested_at is not null then 'cancelled' when attempt_count >= max_attempts then 'failed' else 'retry_wait' end,
    error_code=case when cancel_requested_at is not null then null when attempt_count >= max_attempts then left(p_error_code,64) else null end,
    next_attempt_at=now()+make_interval(secs => least(300,30 * (2 ^ greatest(attempt_count-1,0)))),
    completed_at=case when cancel_requested_at is not null or attempt_count >= max_attempts then now() else null end,
    lease_token=null, lease_expires_at=null
  where id=p_id and status='running' and lease_token=p_lease_token returning status into changed_status;
  return changed_status;
end;
$$;

create function public.cancel_tic_research_job(p_id uuid, p_project_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare changed_status text;
begin
  update public.tic_research_jobs set
    status=case when status='running' then status else 'cancelled' end,
    cancel_requested_at=now(),
    completed_at=case when status='running' then completed_at else now() end,
    lease_token=case when status='running' then lease_token else null end,
    lease_expires_at=case when status='running' then lease_expires_at else null end
  where id=p_id and project_id=p_project_id and status in ('queued','retry_wait','running')
  returning status into changed_status;
  return changed_status;
end;
$$;

revoke all on function public.enqueue_tic_research_job(text,text,text) from public,anon,authenticated;
revoke all on function public.claim_tic_research_job() from public,anon,authenticated;
revoke all on function public.complete_tic_research_job(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.fail_tic_research_job(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.cancel_tic_research_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.enqueue_tic_research_job(text,text,text) to service_role;
grant execute on function public.claim_tic_research_job() to service_role;
grant execute on function public.complete_tic_research_job(uuid,uuid,jsonb) to service_role;
grant execute on function public.fail_tic_research_job(uuid,uuid,text) to service_role;
grant execute on function public.cancel_tic_research_job(uuid,uuid) to service_role;
