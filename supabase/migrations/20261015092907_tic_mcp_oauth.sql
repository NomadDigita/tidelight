-- OAuth clients and user-approved MCP grants. Only server-side code using the
-- service role can read credential hashes or mutate the authorization records.
create table public.tic_oauth_clients (
  client_id text primary key check (client_id ~ '^tlic_[A-Za-z0-9_-]{32,64}$'),
  client_name text not null check (char_length(client_name) between 1 and 120),
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 20),
  scopes text[] not null check (cardinality(scopes) between 1 and 2 and scopes <@ array['market:read','research:run']::text[]),
  created_at timestamptz not null default now()
);

create table public.tic_oauth_flows (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.tic_oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  scopes text[] not null check (cardinality(scopes) between 1 and 2 and scopes <@ array['market:read','research:run']::text[]),
  resource text not null check (resource = 'https://mcp.tidelight.app/mcp'),
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43,128}$'),
  state text check (state is null or char_length(state) between 1 and 512),
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now()
);
create index tic_oauth_flows_expiry_idx on public.tic_oauth_flows(expires_at);

create table public.tic_oauth_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.tic_oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.developer_projects(id) on delete cascade,
  key_id uuid not null references public.developer_api_keys(id) on delete cascade,
  redirect_uri text not null,
  resource text not null check (resource = 'https://mcp.tidelight.app/mcp'),
  scopes text[] not null check (cardinality(scopes) between 1 and 2 and scopes <@ array['market:read','research:run']::text[]),
  authorization_code_hash text unique,
  code_challenge text check (code_challenge is null or code_challenge ~ '^[A-Za-z0-9_-]{43,128}$'),
  code_expires_at timestamptz,
  code_used_at timestamptz,
  access_token_hash text unique,
  access_token_expires_at timestamptz,
  refresh_token_hash text unique,
  refresh_token_expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  refreshed_at timestamptz
);
create index tic_oauth_sessions_user_idx on public.tic_oauth_sessions(user_id,created_at desc);
create index tic_oauth_sessions_key_idx on public.tic_oauth_sessions(key_id,revoked_at);

create table public.tic_oauth_rate_limits (
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  endpoint text not null check (endpoint in ('register','authorize','token','revoke')),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count between 1 and 1000),
  primary key (subject_hash,endpoint)
);
create index tic_oauth_rate_limits_window_idx on public.tic_oauth_rate_limits(window_started_at);

create function public.reserve_tic_oauth_rate_limit(p_subject_hash text,p_endpoint text,p_max_requests integer,p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare current_window timestamptz; current_count integer;
begin
  if p_subject_hash !~ '^[0-9a-f]{64}$' or p_endpoint not in ('register','authorize','token','revoke')
     or p_max_requests not between 1 and 1000 or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid OAuth rate limit parameters';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_subject_hash || ':' || p_endpoint,0));
  delete from public.tic_oauth_rate_limits where window_started_at < now() - interval '1 day';
  select window_started_at,request_count into current_window,current_count
    from public.tic_oauth_rate_limits where subject_hash=p_subject_hash and endpoint=p_endpoint for update;
  if not found then
    insert into public.tic_oauth_rate_limits(subject_hash,endpoint,window_started_at,request_count)
    values(p_subject_hash,p_endpoint,now(),1);
  elsif current_window <= now() - make_interval(secs => p_window_seconds) then
    update public.tic_oauth_rate_limits set window_started_at=now(),request_count=1
      where subject_hash=p_subject_hash and endpoint=p_endpoint;
  elsif current_count >= p_max_requests then
    return false;
  else
    update public.tic_oauth_rate_limits set request_count=request_count+1
      where subject_hash=p_subject_hash and endpoint=p_endpoint;
  end if;
  return true;
end $$;

alter table public.tic_oauth_clients enable row level security;
alter table public.tic_oauth_flows enable row level security;
alter table public.tic_oauth_sessions enable row level security;
alter table public.tic_oauth_rate_limits enable row level security;
revoke all on public.tic_oauth_clients,public.tic_oauth_flows,public.tic_oauth_sessions,public.tic_oauth_rate_limits from public,anon,authenticated;
grant all on public.tic_oauth_clients,public.tic_oauth_flows,public.tic_oauth_sessions,public.tic_oauth_rate_limits to service_role;
revoke all on function public.reserve_tic_oauth_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_tic_oauth_rate_limit(text,text,integer,integer) to service_role;
