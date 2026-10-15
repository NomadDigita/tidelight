-- Key lifecycle records are server-owned and retained with their project.
create table public.developer_api_key_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.developer_organizations(id) on delete cascade,
  project_id uuid not null references public.developer_projects(id) on delete cascade,
  key_id uuid references public.developer_api_keys(id) on delete set null,
  previous_key_id uuid references public.developer_api_keys(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null check (char_length(actor_email) between 3 and 254),
  action text not null check (action in ('created','rotated','revoked')),
  key_name text not null check (char_length(key_name) between 2 and 80),
  created_at timestamptz not null default now()
);
create index developer_api_key_audit_org_time_idx on public.developer_api_key_audit(organization_id,created_at desc);
create index developer_api_key_audit_project_time_idx on public.developer_api_key_audit(project_id,created_at desc);
alter table public.developer_api_key_audit enable row level security;
revoke all on public.developer_api_key_audit from public,anon,authenticated;
grant all on public.developer_api_key_audit to service_role;

create or replace function public.create_developer_api_key_with_audit(
  p_project_id uuid,
  p_actor_id uuid,
  p_actor_email text,
  p_name text,
  p_environment text,
  p_key_prefix text,
  p_key_hash text,
  p_scopes text[],
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  created_key_id uuid;
  active_count integer;
begin
  if p_name is null or char_length(trim(p_name)) not between 2 and 80
    or p_environment not in ('test','production')
    or p_key_hash !~ '^[0-9a-f]{64}$'
    or p_key_prefix !~ '^tl_(test|live)_[A-Za-z0-9_-]{8}$'
    or (p_environment='test' and p_key_prefix !~ '^tl_test_')
    or (p_environment='production' and p_key_prefix !~ '^tl_live_')
    or p_actor_id is null or p_actor_email is null or char_length(p_actor_email) not between 3 and 254
    -- The API caps choices at 365 days; one-day slack absorbs HTTP clock drift.
    or p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '366 days'
    or p_scopes is null or cardinality(p_scopes) not between 1 and 3
    or exists(select 1 from unnest(p_scopes) s(scope) where s.scope is null or s.scope not in ('market:read','research:run','alerts:manage'))
    or cardinality(array(select distinct s.scope from unnest(p_scopes) s(scope))) <> cardinality(p_scopes) then
    raise exception 'invalid key data';
  end if;

  select p.organization_id into org_id
  from public.developer_projects p where p.id=p_project_id for update;
  if not found then raise exception 'project not found'; end if;

  select count(*) into active_count from public.developer_api_keys k
  where k.project_id=p_project_id and k.revoked_at is null and (k.expires_at is null or k.expires_at>now());
  if active_count >= 10 then raise exception 'active key limit reached'; end if;

  insert into public.developer_api_keys(project_id,owner_id,name,environment,key_prefix,key_hash,scopes,expires_at)
  values(p_project_id,p_actor_id,trim(p_name),p_environment,p_key_prefix,p_key_hash,p_scopes,p_expires_at)
  returning id into created_key_id;

  insert into public.developer_api_key_audit(organization_id,project_id,key_id,actor_id,actor_email,action,key_name)
  values(org_id,p_project_id,created_key_id,p_actor_id,trim(p_actor_email),'created',trim(p_name));
  return created_key_id;
end;
$$;

create or replace function public.revoke_developer_api_key_with_audit(
  p_key_id uuid,
  p_actor_id uuid,
  p_actor_email text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_key public.developer_api_keys%rowtype;
  org_id uuid;
begin
  if p_actor_id is null or p_actor_email is null or char_length(p_actor_email) not between 3 and 254 then
    raise exception 'invalid actor';
  end if;
  select * into current_key from public.developer_api_keys k where k.id=p_key_id for update;
  if not found or current_key.revoked_at is not null then return false; end if;
  select p.organization_id into org_id from public.developer_projects p where p.id=current_key.project_id;
  if org_id is null then return false; end if;
  update public.developer_api_keys set revoked_at=now() where id=current_key.id;
  insert into public.developer_api_key_audit(organization_id,project_id,key_id,actor_id,actor_email,action,key_name)
  values(org_id,current_key.project_id,current_key.id,p_actor_id,p_actor_email,'revoked',current_key.name);
  return true;
end;
$$;

-- Keep the old service-role overload through rolling deployment; the updated
-- route uses the actor-aware five-argument overload below.
create or replace function public.rotate_developer_api_key(
  p_key_id uuid,
  p_key_hash text,
  p_key_prefix text,
  p_actor_id uuid,
  p_actor_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_key public.developer_api_keys%rowtype;
  org_id uuid;
  replacement_id uuid;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' or p_key_prefix !~ '^tl_(test|live)_[A-Za-z0-9_-]{8}$'
    or p_actor_id is null or p_actor_email is null or char_length(p_actor_email) not between 3 and 254 then
    raise exception 'invalid rotation data';
  end if;
  select * into current_key from public.developer_api_keys k where k.id=p_key_id for update;
  if not found or current_key.revoked_at is not null
    or (current_key.expires_at is not null and current_key.expires_at<=now()) then
    raise exception 'active key not found';
  end if;
  if (current_key.environment='test' and p_key_prefix !~ '^tl_test_')
    or (current_key.environment='production' and p_key_prefix !~ '^tl_live_') then
    raise exception 'invalid replacement environment';
  end if;
  select p.organization_id into org_id from public.developer_projects p where p.id=current_key.project_id;
  if org_id is null then raise exception 'project not found'; end if;

  update public.developer_api_keys set revoked_at=now() where id=current_key.id;
  insert into public.developer_api_keys(project_id,owner_id,name,environment,key_prefix,key_hash,scopes,minute_limit,monthly_limit,expires_at)
  values(current_key.project_id,current_key.owner_id,current_key.name,current_key.environment,p_key_prefix,p_key_hash,
    current_key.scopes,current_key.minute_limit,current_key.monthly_limit,current_key.expires_at)
  returning id into replacement_id;
  insert into public.developer_api_key_audit(organization_id,project_id,key_id,previous_key_id,actor_id,actor_email,action,key_name)
  values(org_id,current_key.project_id,replacement_id,current_key.id,p_actor_id,p_actor_email,'rotated',current_key.name);
  return replacement_id;
end;
$$;

revoke all on function public.create_developer_api_key_with_audit(uuid,uuid,text,text,text,text,text,text[],timestamptz) from public,anon,authenticated;
revoke all on function public.revoke_developer_api_key_with_audit(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.rotate_developer_api_key(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.create_developer_api_key_with_audit(uuid,uuid,text,text,text,text,text,text[],timestamptz) to service_role;
grant execute on function public.revoke_developer_api_key_with_audit(uuid,uuid,text) to service_role;
grant execute on function public.rotate_developer_api_key(uuid,text,text,uuid,text) to service_role;
