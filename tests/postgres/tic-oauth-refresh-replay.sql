\set ON_ERROR_STOP on

insert into public.tic_oauth_clients(client_id,client_name,redirect_uris,scopes)
values ('tlic_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','OAuth replay test',array['http://127.0.0.1:43123/callback'],array['market:read']);
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111');
insert into public.developer_projects(id) values ('22222222-2222-4222-8222-222222222222');
insert into public.developer_api_keys(id,revoked_at,expires_at,scopes)
values ('33333333-3333-4333-8333-333333333333',null,null,array['market:read']);
insert into public.tic_oauth_sessions(
  id,client_id,user_id,project_id,key_id,redirect_uri,resource,scopes,
  refresh_token_hash,refresh_token_expires_at
) values (
  '44444444-4444-4444-8444-444444444444','tlic_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333','http://127.0.0.1:43123/callback',
  'https://mcp.tidelight.app/mcp',array['market:read'],repeat('a',64),now()+interval '90 days'
);

do $$
declare result jsonb;
declare stored public.tic_oauth_sessions%rowtype;
begin
  result := public.rotate_tic_oauth_refresh_token(
    'tlic_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',repeat('a',64),repeat('b',64),repeat('c',64),
    array['research:run'],now()+interval '15 minutes',now()+interval '90 days'
  );
  if result->>'status' <> 'invalid_scope' then raise exception 'scope escalation was not rejected: %',result; end if;
  select * into stored from public.tic_oauth_sessions where id='44444444-4444-4444-8444-444444444444';
  if stored.refresh_token_hash <> repeat('a',64) or stored.revoked_at is not null then raise exception 'invalid scope request changed the grant'; end if;

  result := public.rotate_tic_oauth_refresh_token(
    'tlic_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',repeat('a',64),repeat('b',64),repeat('c',64),
    null,now()+interval '15 minutes',now()+interval '90 days'
  );
  if result->>'status' <> 'rotated' or result->'scopes' <> '["market:read"]'::jsonb then raise exception 'first refresh did not rotate safely: %',result; end if;

  result := public.rotate_tic_oauth_refresh_token(
    'tlic_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',repeat('c',64),repeat('d',64),repeat('e',64),
    null,now()+interval '15 minutes',now()+interval '90 days'
  );
  if result->>'status' <> 'rotated' then raise exception 'second refresh did not rotate: %',result; end if;

  result := public.rotate_tic_oauth_refresh_token(
    'tlic_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',repeat('a',64),repeat('f',64),repeat('1',64),
    null,now()+interval '15 minutes',now()+interval '90 days'
  );
  if result->>'status' <> 'reuse_detected' then raise exception 'replayed historical token was not detected: %',result; end if;
  select * into stored from public.tic_oauth_sessions where id='44444444-4444-4444-8444-444444444444';
  if stored.revoked_at is null or stored.refresh_token_hash is not null or stored.access_token_hash is not null then raise exception 'reuse did not revoke the complete grant'; end if;
  if (select count(*) from public.tic_oauth_refresh_history where session_id=stored.id and consumed_at is not null) <> 3 then raise exception 'history did not retain and consume every rotated token'; end if;

  result := public.rotate_tic_oauth_refresh_token(
    'tlic_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',repeat('9',64),repeat('8',64),repeat('7',64),
    null,now()+interval '15 minutes',now()+interval '90 days'
  );
  if result->>'status' <> 'invalid_grant' then raise exception 'unknown token was not rejected: %',result; end if;

  if not (select relrowsecurity from pg_class where oid='public.tic_oauth_refresh_history'::regclass) then raise exception 'RLS is not enabled on refresh history'; end if;
  if has_table_privilege('anon','public.tic_oauth_refresh_history','select') or has_table_privilege('authenticated','public.tic_oauth_refresh_history','select') then raise exception 'browser role can read refresh history'; end if;
  if has_function_privilege('anon','public.rotate_tic_oauth_refresh_token(text,text,text,text,text[],timestamp with time zone,timestamp with time zone)','execute') then raise exception 'anon can execute refresh rotation'; end if;
  if not has_function_privilege('service_role','public.rotate_tic_oauth_refresh_token(text,text,text,text,text[],timestamp with time zone,timestamp with time zone)','execute') then raise exception 'service_role cannot execute refresh rotation'; end if;
end $$;

select 'OAuth refresh replay integration test passed' as result;
