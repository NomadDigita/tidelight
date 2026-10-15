-- Tidelight Intelligence Cloud, first public read-only capability.
-- All writes pass through the server. Browser roles cannot read credential hashes.
create table public.developer_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null,
  name text not null check (char_length(name) between 2 and 80),
  environment text not null check (environment in ('test', 'production')),
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null check (scopes <@ array['market:read']::text[] and cardinality(scopes) > 0),
  minute_limit integer not null default 30 check (minute_limit between 1 and 300),
  monthly_limit integer not null default 10000 check (monthly_limit between 1 and 1000000),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (project_id, owner_id) references public.developer_projects(id, owner_id) on delete cascade
);

create table public.developer_api_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.developer_projects(id) on delete cascade,
  key_id uuid references public.developer_api_keys(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  status_code integer,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index developer_api_requests_key_time_idx on public.developer_api_requests(key_id, created_at desc);
create index developer_api_requests_project_time_idx on public.developer_api_requests(project_id, created_at desc);
create index developer_api_keys_owner_idx on public.developer_api_keys(owner_id, created_at desc);

alter table public.developer_projects enable row level security;
alter table public.developer_api_keys enable row level security;
alter table public.developer_api_requests enable row level security;
revoke all on public.developer_projects, public.developer_api_keys, public.developer_api_requests from public, anon, authenticated;
grant all on public.developer_projects, public.developer_api_keys, public.developer_api_requests to service_role;

-- Locking the key row serializes quota decisions made by concurrent requests.
create function public.reserve_developer_request(p_hash text, p_scope text, p_endpoint text)
returns table(request_id uuid, project_id uuid, owner_id uuid, key_id uuid, reason text)
language plpgsql security definer set search_path = public
as $$
declare k public.developer_api_keys%rowtype;
declare minute_count integer;
declare month_count integer;
declare new_id uuid;
begin
  select * into k from public.developer_api_keys where key_hash = p_hash for update;
  if not found or k.revoked_at is not null or (k.expires_at is not null and k.expires_at <= now()) then
    return query select null::uuid, null::uuid, null::uuid, null::uuid, 'invalid_key'::text;
    return;
  end if;
  if not p_scope = any(k.scopes) then
    return query select null::uuid, null::uuid, null::uuid, null::uuid, 'insufficient_scope'::text;
    return;
  end if;
  select count(*) into minute_count from public.developer_api_requests r where r.key_id = k.id and r.created_at >= now() - interval '1 minute';
  select count(*) into month_count from public.developer_api_requests r where r.key_id = k.id and r.created_at >= date_trunc('month', now());
  if minute_count >= k.minute_limit or month_count >= k.monthly_limit then
    return query select null::uuid, null::uuid, null::uuid, null::uuid, 'quota_exceeded'::text;
    return;
  end if;
  insert into public.developer_api_requests(project_id, key_id, owner_id, endpoint)
  values (k.project_id, k.id, k.owner_id, left(p_endpoint, 120)) returning id into new_id;
  update public.developer_api_keys set last_used_at = now() where id = k.id;
  return query select new_id, k.project_id, k.owner_id, k.id, null::text;
end;
$$;
revoke all on function public.reserve_developer_request(text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_developer_request(text, text, text) to service_role;
