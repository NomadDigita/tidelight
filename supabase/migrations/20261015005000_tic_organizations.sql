-- Organization tenancy for Tidelight Intelligence Cloud.
-- Existing personal projects are moved into a private, owner-only organization.
create table public.developer_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.developer_organization_members (
  organization_id uuid not null references public.developer_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','developer','reader')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);
create index developer_organization_members_user_idx on public.developer_organization_members(user_id,organization_id);

create table public.developer_organization_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.developer_organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('organization_created','member_added','member_role_changed','member_removed')),
  previous_role text check (previous_role is null or previous_role in ('owner','admin','developer','reader')),
  new_role text check (new_role is null or new_role in ('owner','admin','developer','reader')),
  created_at timestamptz not null default now()
);
create index developer_organization_audit_org_idx on public.developer_organization_audit(organization_id,created_at desc);

alter table public.developer_projects add column organization_id uuid;

insert into public.developer_organizations(name,slug,created_by)
select 'Personal workspace','personal-' || left(replace(owner_id::text,'-',''),12),owner_id
from (select distinct owner_id from public.developer_projects) owners;

insert into public.developer_organization_members(organization_id,user_id,role,added_by)
select o.id,o.created_by,'owner',o.created_by from public.developer_organizations o;

update public.developer_projects p
set organization_id=o.id
from public.developer_organizations o
where o.created_by=p.owner_id and o.slug='personal-' || left(replace(p.owner_id::text,'-',''),12);

alter table public.developer_projects alter column organization_id set not null;
alter table public.developer_projects add constraint developer_projects_organization_id_fkey
  foreign key (organization_id) references public.developer_organizations(id) on delete cascade;
create index developer_projects_org_idx on public.developer_projects(organization_id,created_at desc);

-- Project creator is attribution only. Membership controls access after this migration.
alter table public.developer_api_keys drop constraint developer_api_keys_project_id_owner_id_fkey;
alter table public.tic_research_jobs drop constraint tic_research_jobs_project_id_owner_id_fkey;
alter table public.developer_projects drop constraint developer_projects_id_owner_id_key;
alter table public.developer_projects drop constraint developer_projects_owner_id_fkey;
alter table public.developer_projects alter column owner_id drop not null;
alter table public.developer_projects add constraint developer_projects_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;
alter table public.developer_api_keys add constraint developer_api_keys_project_id_fkey
  foreign key (project_id) references public.developer_projects(id) on delete cascade;
alter table public.developer_api_keys add constraint developer_api_keys_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete cascade;
alter table public.developer_api_requests drop constraint developer_api_requests_owner_id_fkey;
alter table public.developer_api_requests alter column owner_id drop not null;
alter table public.developer_api_requests add constraint developer_api_requests_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;
alter table public.tic_research_jobs add constraint tic_research_jobs_project_id_fkey
  foreign key (project_id) references public.developer_projects(id) on delete cascade;
alter table public.tic_research_jobs drop constraint tic_research_jobs_owner_id_fkey;
alter table public.tic_research_jobs alter column owner_id drop not null;
alter table public.tic_research_jobs add constraint tic_research_jobs_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

alter table public.developer_organizations enable row level security;
alter table public.developer_organization_members enable row level security;
alter table public.developer_organization_audit enable row level security;
revoke all on public.developer_organizations,public.developer_organization_members,public.developer_organization_audit from public,anon,authenticated;
grant all on public.developer_organizations,public.developer_organization_members,public.developer_organization_audit to service_role;

create function public.create_developer_organization(p_user_id uuid,p_name text,p_slug text)
returns table(organization_id uuid,role text)
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if p_user_id is null or p_name is null or char_length(trim(p_name)) not between 2 and 80
     or p_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' then raise exception 'invalid organization'; end if;
  insert into public.developer_organizations(name,slug,created_by)
  values(trim(p_name),p_slug,p_user_id) returning id into new_id;
  insert into public.developer_organization_members(organization_id,user_id,role,added_by)
  values(new_id,p_user_id,'owner',p_user_id);
  insert into public.developer_organization_audit(organization_id,actor_id,target_user_id,action,new_role)
  values(new_id,p_user_id,p_user_id,'organization_created','owner');
  return query select new_id,'owner'::text;
end $$;

create function public.ensure_personal_developer_organization(p_user_id uuid)
returns table(organization_id uuid,role text)
language plpgsql security definer set search_path = '' as $$
declare found_org uuid; found_role text; new_id uuid; personal_slug text;
begin
  if p_user_id is null then raise exception 'invalid user'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select m.organization_id,m.role into found_org,found_role from public.developer_organization_members m
  where m.user_id=p_user_id order by m.created_at limit 1;
  if found_org is not null then return query select found_org,found_role; return; end if;
  personal_slug:='personal-' || left(replace(p_user_id::text,'-',''),16);
  insert into public.developer_organizations(name,slug,created_by)
  values('Personal workspace',personal_slug,p_user_id) returning id into new_id;
  insert into public.developer_organization_members(organization_id,user_id,role,added_by)
  values(new_id,p_user_id,'owner',p_user_id);
  insert into public.developer_organization_audit(organization_id,actor_id,target_user_id,action,new_role)
  values(new_id,p_user_id,p_user_id,'organization_created','owner');
  return query select new_id,'owner'::text;
end $$;

-- Keep the old project create route safe during rolling deploys; new code passes
-- an explicit organization, while legacy inserts enter the creator's workspace.
create function public.assign_personal_developer_organization()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare found_org uuid;
begin
  if new.organization_id is not null then return new; end if;
  if new.owner_id is null then raise exception 'project owner is required'; end if;
  select m.organization_id into found_org from public.developer_organization_members m
    where m.user_id=new.owner_id and m.role='owner' order by m.created_at limit 1;
  if found_org is null then
    select e.organization_id into found_org from public.ensure_personal_developer_organization(new.owner_id) e;
  end if;
  new.organization_id:=found_org;
  return new;
end $$;
create trigger developer_projects_personal_organization
  before insert on public.developer_projects
  for each row execute function public.assign_personal_developer_organization();
revoke all on function public.assign_personal_developer_organization() from public,anon,authenticated,service_role;

create function public.list_developer_organization_members(p_organization_id uuid,p_actor_id uuid)
returns table(user_id uuid,email text,role text,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.developer_organization_members m where m.organization_id=p_organization_id and m.user_id=p_actor_id) then
    raise exception 'permission denied';
  end if;
  return query select m.user_id,u.email,m.role,m.created_at from public.developer_organization_members m
    join auth.users u on u.id=m.user_id where m.organization_id=p_organization_id order by
    case m.role when 'owner' then 0 when 'admin' then 1 when 'developer' then 2 else 3 end,m.created_at;
end $$;

create function public.add_developer_organization_member(p_organization_id uuid,p_actor_id uuid,p_email text,p_role text)
returns table(member_user_id uuid,member_role text)
language plpgsql security definer set search_path = '' as $$
declare actor_role text; target_id uuid;
begin
  select m.role into actor_role from public.developer_organization_members m
  where m.organization_id=p_organization_id and m.user_id=p_actor_id for update;
  if actor_role is null or actor_role not in ('owner','admin') or (p_role='admin' and actor_role<>'owner')
     or p_role not in ('admin','developer','reader') then raise exception 'permission denied'; end if;
  select u.id into target_id from auth.users u where lower(u.email)=lower(trim(p_email)) limit 1;
  if target_id is null then raise exception 'account not found'; end if;
  insert into public.developer_organization_members(organization_id,user_id,role,added_by)
  values(p_organization_id,target_id,p_role,p_actor_id);
  insert into public.developer_organization_audit(organization_id,actor_id,target_user_id,action,new_role)
  values(p_organization_id,p_actor_id,target_id,'member_added',p_role);
  return query select target_id,p_role;
end $$;

create function public.change_developer_organization_member(p_organization_id uuid,p_actor_id uuid,p_member_id uuid,p_role text,p_remove boolean default false)
returns text
language plpgsql security definer set search_path = '' as $$
declare actor_role text; prior_role text; owners integer;
begin
  select m.role into actor_role from public.developer_organization_members m
  where m.organization_id=p_organization_id and m.user_id=p_actor_id for update;
  if actor_role is null or actor_role not in ('owner','admin') then raise exception 'permission denied'; end if;
  select m.role into prior_role from public.developer_organization_members m
  where m.organization_id=p_organization_id and m.user_id=p_member_id for update;
  if prior_role is null then raise exception 'member not found'; end if;
  if actor_role='admin' and (prior_role in ('owner','admin') or p_role in ('owner','admin')) then raise exception 'permission denied'; end if;
  if not p_remove and (p_role not in ('owner','admin','developer','reader')) then raise exception 'invalid role'; end if;
  if p_remove or (prior_role='owner' and p_role<>'owner') then
    select count(*) into owners from public.developer_organization_members m where m.organization_id=p_organization_id and m.role='owner';
    if prior_role='owner' and owners<=1 then raise exception 'organization requires an owner'; end if;
  end if;
  if p_remove then
    delete from public.developer_organization_members where organization_id=p_organization_id and user_id=p_member_id;
    update public.developer_api_keys k set revoked_at=now()
      from public.developer_projects p where p.id=k.project_id and p.organization_id=p_organization_id
        and k.owner_id=p_member_id and k.revoked_at is null;
    insert into public.developer_organization_audit(organization_id,actor_id,target_user_id,action,previous_role)
    values(p_organization_id,p_actor_id,p_member_id,'member_removed',prior_role);
    return 'removed';
  end if;
  if prior_role=p_role then return prior_role; end if;
  update public.developer_organization_members set role=p_role,updated_at=now()
  where organization_id=p_organization_id and user_id=p_member_id;
  if p_role='reader' and prior_role<>'reader' then
    update public.developer_api_keys k set revoked_at=now()
      from public.developer_projects p where p.id=k.project_id and p.organization_id=p_organization_id
        and k.owner_id=p_member_id and k.revoked_at is null;
  end if;
  insert into public.developer_organization_audit(organization_id,actor_id,target_user_id,action,previous_role,new_role)
  values(p_organization_id,p_actor_id,p_member_id,'member_role_changed',prior_role,p_role);
  return p_role;
end $$;

create function public.enforce_developer_organization_owner()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare remaining_owners integer;
begin
  if old.role='owner' and (tg_op='DELETE' or new.role<>'owner') then
    select count(*) into remaining_owners from public.developer_organization_members m
    where m.organization_id=old.organization_id and m.role='owner' and m.user_id<>old.user_id;
    if remaining_owners=0 then raise exception 'organization requires an owner'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger developer_organization_owner_invariant
  before update of role or delete on public.developer_organization_members
  for each row execute function public.enforce_developer_organization_owner();

revoke all on function public.create_developer_organization(uuid,text,text) from public,anon,authenticated;
revoke all on function public.ensure_personal_developer_organization(uuid) from public,anon,authenticated;
revoke all on function public.list_developer_organization_members(uuid,uuid) from public,anon,authenticated;
revoke all on function public.add_developer_organization_member(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.change_developer_organization_member(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.enforce_developer_organization_owner() from public,anon,authenticated,service_role;
grant execute on function public.create_developer_organization(uuid,text,text) to service_role;
grant execute on function public.ensure_personal_developer_organization(uuid) to service_role;
grant execute on function public.list_developer_organization_members(uuid,uuid) to service_role;
grant execute on function public.add_developer_organization_member(uuid,uuid,text,text) to service_role;
grant execute on function public.change_developer_organization_member(uuid,uuid,uuid,text,boolean) to service_role;

-- Shared project membership replaces the creator-only assertion used before organizations.
create or replace function public.enqueue_tic_research_job(p_hash text,p_ticker text,p_idempotency_key text)
returns table(job_id uuid,job_status text,request_id uuid,is_duplicate boolean,reason text)
language plpgsql security definer set search_path = public as $$
declare k public.developer_api_keys%rowtype; minute_count integer; month_count integer; hourly_count integer;
declare new_request_id uuid; existing_job public.tic_research_jobs%rowtype; new_job_id uuid;
begin
  select * into k from public.developer_api_keys where key_hash=p_hash for update;
  if not found or k.revoked_at is not null or (k.expires_at is not null and k.expires_at<=now()) then
    return query select null::uuid,null::text,null::uuid,false,'invalid_key'::text; return;
  end if;
  if not 'research:run'=any(k.scopes) then return query select null::uuid,null::text,null::uuid,false,'insufficient_scope'::text; return; end if;
  if p_ticker !~ '^[A-Z][A-Z0-9.]{0,9}$' or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,128}$' then
    return query select null::uuid,null::text,null::uuid,false,'invalid_request'::text; return;
  end if;
  select count(*) into minute_count from public.developer_api_requests r where r.key_id=k.id and r.created_at>=now()-interval '1 minute';
  select count(*) into month_count from public.developer_api_requests r where r.key_id=k.id and r.created_at>=date_trunc('month',now());
  if minute_count>=k.minute_limit or month_count>=k.monthly_limit then return query select null::uuid,null::text,null::uuid,false,'quota_exceeded'::text; return; end if;
  perform 1 from public.developer_projects p where p.id=k.project_id for update;
  if not found then return query select null::uuid,null::text,null::uuid,false,'project_unavailable'::text; return; end if;
  insert into public.developer_api_requests(project_id,key_id,owner_id,endpoint) values(k.project_id,k.id,k.owner_id,'/v1/research/jobs') returning id into new_request_id;
  update public.developer_api_keys set last_used_at=now() where id=k.id;
  select * into existing_job from public.tic_research_jobs j where j.project_id=k.project_id and j.idempotency_key=p_idempotency_key;
  if found then
    if existing_job.ticker<>p_ticker then return query select null::uuid,null::text,new_request_id,false,'idempotency_conflict'::text;
    else return query select existing_job.id,existing_job.status,new_request_id,true,null::text; end if;
    return;
  end if;
  select count(*) into hourly_count from public.tic_research_jobs j where j.project_id=k.project_id and j.created_at>=now()-interval '1 hour';
  if hourly_count>=10 then return query select null::uuid,null::text,new_request_id,false,'job_quota_exceeded'::text; return; end if;
  insert into public.tic_research_jobs(project_id,owner_id,key_id,request_id,ticker,idempotency_key)
  values(k.project_id,k.owner_id,k.id,new_request_id,p_ticker,p_idempotency_key) returning id into new_job_id;
  return query select new_job_id,'queued'::text,new_request_id,false,null::text;
end $$;
revoke all on function public.enqueue_tic_research_job(text,text,text) from public,anon,authenticated;
grant execute on function public.enqueue_tic_research_job(text,text,text) to service_role;
