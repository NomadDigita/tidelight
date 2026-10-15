do $$
begin
  create role anon nologin;
exception when duplicate_object then null;
end $$;
do $$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;
do $$
begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null;
end $$;

create schema auth;
create table auth.users (id uuid primary key);
create table public.developer_projects (id uuid primary key);
create table public.developer_api_keys (
  id uuid primary key,
  revoked_at timestamptz,
  expires_at timestamptz,
  scopes text[] not null
);
