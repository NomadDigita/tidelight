-- Retain hashes for every refresh token in an OAuth grant so a consumed token
-- replay revokes the active grant instead of merely returning invalid_grant.
create table public.tic_oauth_refresh_history (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  session_id uuid not null references public.tic_oauth_sessions(id) on delete cascade,
  client_id text not null references public.tic_oauth_clients(client_id) on delete cascade,
  issued_at timestamptz not null default now(),
  consumed_at timestamptz
);
create index tic_oauth_refresh_history_session_idx on public.tic_oauth_refresh_history(session_id);
alter table public.tic_oauth_refresh_history enable row level security;
revoke all on public.tic_oauth_refresh_history from public, anon, authenticated;
grant all on public.tic_oauth_refresh_history to service_role;

create function public.record_tic_oauth_refresh_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.refresh_token_hash is not distinct from new.refresh_token_hash then
      return new;
    end if;
    if old.refresh_token_hash is not null then
      insert into public.tic_oauth_refresh_history(token_hash, session_id, client_id, issued_at, consumed_at)
      values (old.refresh_token_hash, old.id, old.client_id, coalesce(old.refreshed_at, old.created_at), now())
      on conflict (token_hash) do update
        set consumed_at = coalesce(public.tic_oauth_refresh_history.consumed_at, excluded.consumed_at)
        where public.tic_oauth_refresh_history.session_id = excluded.session_id;
    end if;
  end if;

  if new.refresh_token_hash is not null then
    insert into public.tic_oauth_refresh_history(token_hash, session_id, client_id, issued_at)
    values (new.refresh_token_hash, new.id, new.client_id, coalesce(new.refreshed_at, new.created_at));
  end if;
  return new;
end;
$$;
revoke all on function public.record_tic_oauth_refresh_history() from public, anon, authenticated;
create trigger tic_oauth_refresh_history_trigger
after insert or update of refresh_token_hash on public.tic_oauth_sessions
for each row execute function public.record_tic_oauth_refresh_history();

-- Existing grants become part of the history before any rotation can occur.
insert into public.tic_oauth_refresh_history(token_hash, session_id, client_id, issued_at)
select refresh_token_hash, id, client_id, coalesce(refreshed_at, created_at)
from public.tic_oauth_sessions
where refresh_token_hash is not null
on conflict (token_hash) do nothing;

create function public.rotate_tic_oauth_refresh_token(
  p_client_id text,
  p_old_refresh_hash text,
  p_new_access_hash text,
  p_new_refresh_hash text,
  p_requested_scopes text[],
  p_access_expires_at timestamptz,
  p_refresh_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  grant_row public.tic_oauth_sessions%rowtype;
  key_row public.developer_api_keys%rowtype;
  requested text[];
  reused_session_id uuid;
begin
  if p_client_id !~ '^tlic_[A-Za-z0-9_-]{32,64}$'
    or p_old_refresh_hash !~ '^[0-9a-f]{64}$'
    or p_new_access_hash !~ '^[0-9a-f]{64}$'
    or p_new_refresh_hash !~ '^[0-9a-f]{64}$'
    or p_new_access_hash = p_new_refresh_hash
    or p_access_expires_at <= now()
    or p_refresh_expires_at <= p_access_expires_at then
    return jsonb_build_object('status', 'invalid_grant');
  end if;

  -- Lock the grant before changing tokens. A concurrent request using the same
  -- old token will observe the consumed hash below and revoke the token family.
  select s.* into grant_row
  from public.tic_oauth_sessions as s
  where s.client_id = p_client_id
    and s.resource = 'https://mcp.tidelight.app/mcp'
    and s.refresh_token_hash = p_old_refresh_hash
    and s.refresh_token_expires_at > now()
    and s.revoked_at is null
  for update;

  if not found then
    select h.session_id into reused_session_id
    from public.tic_oauth_refresh_history as h
    join public.tic_oauth_sessions as s on s.id = h.session_id
    where h.client_id = p_client_id
      and h.token_hash = p_old_refresh_hash
      and h.consumed_at is not null
      and s.revoked_at is null
    limit 1;

    if reused_session_id is not null then
      update public.tic_oauth_sessions
      set revoked_at = now(), access_token_hash = null, access_token_expires_at = null,
          refresh_token_hash = null, refresh_token_expires_at = null
      where id = reused_session_id and revoked_at is null;
      return jsonb_build_object('status', 'reuse_detected');
    end if;
    return jsonb_build_object('status', 'invalid_grant');
  end if;

  requested := coalesce(p_requested_scopes, grant_row.scopes);
  if cardinality(requested) not between 1 and 2
    or not requested <@ array['market:read', 'research:run']::text[]
    or cardinality(requested) <> (select count(distinct scope) from unnest(requested) as u(scope))
    or not requested <@ grant_row.scopes then
    return jsonb_build_object('status', 'invalid_scope');
  end if;

  select k.* into key_row
  from public.developer_api_keys as k
  where k.id = grant_row.key_id;

  if not found or key_row.revoked_at is not null
    or (key_row.expires_at is not null and key_row.expires_at <= now())
    or not requested <@ key_row.scopes then
    return jsonb_build_object('status', 'invalid_grant');
  end if;

  update public.tic_oauth_sessions
  set access_token_hash = p_new_access_hash,
      access_token_expires_at = p_access_expires_at,
      refresh_token_hash = p_new_refresh_hash,
      refresh_token_expires_at = p_refresh_expires_at,
      refreshed_at = now(),
      scopes = requested
  where id = grant_row.id and refresh_token_hash = p_old_refresh_hash and revoked_at is null;

  if not found then
    return jsonb_build_object('status', 'invalid_grant');
  end if;

  return jsonb_build_object('status', 'rotated', 'scopes', to_jsonb(requested));
end;
$$;
revoke all on function public.rotate_tic_oauth_refresh_token(text, text, text, text, text[], timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.rotate_tic_oauth_refresh_token(text, text, text, text, text[], timestamptz, timestamptz) to service_role;
