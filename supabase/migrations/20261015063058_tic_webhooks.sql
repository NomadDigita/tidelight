-- Tenant-scoped webhook subscriptions with durable event and delivery history.
alter table public.developer_api_keys drop constraint developer_api_keys_scopes_check;
alter table public.developer_api_keys add constraint developer_api_keys_scopes_check
  check (scopes <@ array['market:read','research:run','alerts:manage']::text[] and cardinality(scopes) > 0);

create unique index if not exists developer_projects_id_organization_id_key
  on public.developer_projects(id,organization_id);

create table public.tic_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.developer_projects(id) on delete cascade,
  organization_id uuid not null references public.developer_organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  url text not null check (char_length(url) between 10 and 2048),
  encrypted_secret text not null,
  events text[] not null check (cardinality(events) between 1 and 2 and events <@ array['research.job.completed','research.job.failed']::text[]),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.developer_projects(id, organization_id) on delete cascade
);
create index tic_webhook_endpoints_project_idx on public.tic_webhook_endpoints(project_id, created_at desc);

create table public.tic_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.tic_webhook_endpoints(id) on delete cascade,
  project_id uuid not null references public.developer_projects(id) on delete cascade,
  event_id uuid not null,
  event_type text not null check (event_type in ('research.job.completed','research.job.failed')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','retry_wait','succeeded','failed','cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_status_code integer,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  last_duration_ms integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (endpoint_id, event_id)
);
create index tic_webhook_deliveries_queue_idx on public.tic_webhook_deliveries(next_attempt_at, created_at) where status in ('pending','retry_wait','sending');
create index tic_webhook_deliveries_project_idx on public.tic_webhook_deliveries(project_id, created_at desc);

create table public.tic_webhook_delivery_attempts (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references public.tic_webhook_deliveries(id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 8),
  status_code integer,
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 60000),
  error_code text check (error_code is null or error_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  created_at timestamptz not null default now(),
  unique (delivery_id, attempt_number)
);

alter table public.tic_webhook_endpoints enable row level security;
alter table public.tic_webhook_deliveries enable row level security;
alter table public.tic_webhook_delivery_attempts enable row level security;
revoke all on public.tic_webhook_endpoints, public.tic_webhook_deliveries, public.tic_webhook_delivery_attempts from public, anon, authenticated;
grant all on public.tic_webhook_endpoints, public.tic_webhook_deliveries, public.tic_webhook_delivery_attempts to service_role;

create or replace function public.claim_tic_webhook_deliveries(p_limit integer default 3)
returns table(delivery_id uuid, endpoint_id uuid, project_id uuid, endpoint_url text, encrypted_secret text, event_id uuid, event_type text, payload jsonb, attempt_number integer, lease_token uuid)
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  update public.tic_webhook_deliveries d
  set status='failed',last_error_code='attempts_exhausted',completed_at=now(),lease_token=null,lease_expires_at=null
  where d.status='sending' and d.lease_expires_at < now() and d.attempt_count >= 8;
  return query
  with candidates as (
    select d.id
    from public.tic_webhook_deliveries d
    where ((d.status in ('pending','retry_wait') and d.next_attempt_at <= now())
       or (d.status = 'sending' and d.lease_expires_at < now() and d.attempt_count < 8))
      and exists (select 1 from public.tic_webhook_endpoints e where e.id=d.endpoint_id and e.enabled)
    order by d.next_attempt_at, d.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 3), 1), 3)
  ), claimed as (
    update public.tic_webhook_deliveries d
    set status='sending', attempt_count=d.attempt_count+1,
        lease_token=gen_random_uuid(), lease_expires_at=now()+interval '45 seconds'
    from candidates c
    where d.id=c.id and d.attempt_count < 8
    returning d.*
  )
  select c.id, e.id, c.project_id, e.url, e.encrypted_secret, c.event_id, c.event_type, c.payload, c.attempt_count, c.lease_token
  from claimed c join public.tic_webhook_endpoints e on e.id=c.endpoint_id
  where e.enabled
  order by c.created_at;
end;
$$;

create or replace function public.complete_tic_webhook_delivery(
  p_delivery_id uuid, p_lease_token uuid, p_status_code integer, p_duration_ms integer, p_error_code text, p_retryable boolean
) returns text
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare current public.tic_webhook_deliveries%rowtype;
begin
  select * into current from public.tic_webhook_deliveries d
  where d.id=p_delivery_id and d.status='sending' and d.lease_token=p_lease_token
  for update;
  if not found then return 'lease_lost'; end if;
  insert into public.tic_webhook_delivery_attempts(delivery_id,attempt_number,status_code,duration_ms,error_code)
  values(current.id,current.attempt_count,p_status_code,least(greatest(coalesce(p_duration_ms,0),0),60000),
    case when p_error_code ~ '^[a-z][a-z0-9_]{0,63}$' then p_error_code else null end);
  if p_status_code between 200 and 299 then
    update public.tic_webhook_deliveries set status='succeeded',last_status_code=p_status_code,last_error_code=null,last_duration_ms=p_duration_ms,completed_at=now(),lease_token=null,lease_expires_at=null where id=current.id;
    return 'succeeded';
  elsif p_retryable and current.attempt_count < 8 then
    update public.tic_webhook_deliveries set status='retry_wait',last_status_code=p_status_code,last_error_code=p_error_code,
      last_duration_ms=p_duration_ms,next_attempt_at=now()+make_interval(secs=>least(3600,15*(2^least(current.attempt_count-1,8))::integer)),lease_token=null,lease_expires_at=null where id=current.id;
    return 'retry_wait';
  else
    update public.tic_webhook_deliveries set status='failed',last_status_code=p_status_code,last_error_code=p_error_code,last_duration_ms=p_duration_ms,completed_at=now(),lease_token=null,lease_expires_at=null where id=current.id;
    return 'failed';
  end if;
end;
$$;

revoke all on function public.claim_tic_webhook_deliveries(integer) from public, anon, authenticated;
revoke all on function public.complete_tic_webhook_delivery(uuid,uuid,integer,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.claim_tic_webhook_deliveries(integer) to service_role;
grant execute on function public.complete_tic_webhook_delivery(uuid,uuid,integer,integer,text,boolean) to service_role;

create or replace function public.enqueue_tic_research_webhook_event()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare event_name text; event_payload jsonb;
begin
  if old.status is not distinct from new.status or new.status not in ('complete','failed') then return new; end if;
  event_name := case when new.status='complete' then 'research.job.completed' else 'research.job.failed' end;
  event_payload := jsonb_build_object(
    'id',new.id,'type',event_name,'created_at',now(),
    'data',jsonb_build_object('job_id',new.id,'ticker',new.ticker,'status',new.status,'completed_at',new.completed_at,'error_code',new.error_code)
  );
  insert into public.tic_webhook_deliveries(endpoint_id,project_id,event_id,event_type,payload)
  select e.id,new.project_id,new.id,event_name,event_payload
  from public.tic_webhook_endpoints e
  where e.project_id=new.project_id and e.enabled and event_name=any(e.events)
  on conflict(endpoint_id,event_id) do nothing;
  return new;
end;
$$;
revoke all on function public.enqueue_tic_research_webhook_event() from public, anon, authenticated;
create trigger tic_research_job_webhook_event
  after update of status on public.tic_research_jobs
  for each row execute function public.enqueue_tic_research_webhook_event();
