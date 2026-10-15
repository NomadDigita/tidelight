-- Rotate an API key in one transaction: the old credential is revoked exactly
-- when its replacement is created, with its access policy carried forward.
create or replace function public.rotate_developer_api_key(
  p_key_id uuid,
  p_key_hash text,
  p_key_prefix text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_key public.developer_api_keys%rowtype;
  replacement_id uuid;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' or p_key_prefix !~ '^tl_(test|live)_[A-Za-z0-9_-]{8}$' then
    raise exception 'invalid key material';
  end if;

  select * into current_key
  from public.developer_api_keys
  where id = p_key_id
  for update;

  if not found or current_key.revoked_at is not null
    or (current_key.expires_at is not null and current_key.expires_at <= now()) then
    raise exception 'active key not found';
  end if;

  update public.developer_api_keys
  set revoked_at = now()
  where id = current_key.id;

  insert into public.developer_api_keys (
    project_id, owner_id, name, environment, key_prefix, key_hash, scopes,
    minute_limit, monthly_limit, expires_at
  ) values (
    current_key.project_id, current_key.owner_id, current_key.name,
    current_key.environment, p_key_prefix, p_key_hash, current_key.scopes,
    current_key.minute_limit, current_key.monthly_limit, current_key.expires_at
  ) returning id into replacement_id;

  return replacement_id;
end;
$$;

revoke all on function public.rotate_developer_api_key(uuid,text,text) from public, anon, authenticated;
grant execute on function public.rotate_developer_api_key(uuid,text,text) to service_role;
