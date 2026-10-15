-- Fix member listing against Supabase Auth's varchar email column and allow
-- organization cascades to remove their membership rows.
create or replace function public.list_developer_organization_members(p_organization_id uuid,p_actor_id uuid)
returns table(user_id uuid,email text,role text,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.developer_organization_members m where m.organization_id=p_organization_id and m.user_id=p_actor_id) then
    raise exception 'permission denied';
  end if;
  return query select m.user_id,u.email::text,m.role,m.created_at from public.developer_organization_members m
    join auth.users u on u.id=m.user_id where m.organization_id=p_organization_id order by
    case m.role when 'owner' then 0 when 'admin' then 1 when 'developer' then 2 else 3 end,m.created_at;
end $$;

create or replace function public.enforce_developer_organization_owner()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare remaining_owners integer;
begin
  -- Membership rows are cascade-deleted with their organization. The owner
  -- invariant applies to a live organization, not its deletion cascade.
  if tg_op='DELETE' and not exists(
    select 1 from public.developer_organizations o where o.id=old.organization_id
  ) then
    return old;
  end if;
  if old.role='owner' and (tg_op='DELETE' or new.role<>'owner') then
    select count(*) into remaining_owners from public.developer_organization_members m
    where m.organization_id=old.organization_id and m.role='owner' and m.user_id<>old.user_id;
    if remaining_owners=0 then raise exception 'organization requires an owner'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

revoke all on function public.list_developer_organization_members(uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_developer_organization_members(uuid,uuid) to service_role;
revoke all on function public.enforce_developer_organization_owner() from public,anon,authenticated,service_role;
