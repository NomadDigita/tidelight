create or replace function nightwatch_private.nightwatch_ensure_account()
returns table(id uuid, cash_balance numeric, paused boolean)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to initialize your paper account.' using errcode = '42501';
  end if;
  insert into public.nightwatch_accounts(user_id) values (v_user_id)
    on conflict (user_id) do nothing;
  return query
    select a.id, a.cash_balance, a.paused
    from public.nightwatch_accounts as a
    where a.user_id = v_user_id;
end;
$$;

revoke all on function nightwatch_private.nightwatch_ensure_account() from public, anon;
grant execute on function nightwatch_private.nightwatch_ensure_account() to authenticated;

drop function public.nightwatch_ensure_account();

create function public.nightwatch_ensure_account()
returns table(id uuid, cash_balance numeric, paused boolean)
language sql
security invoker
set search_path = pg_catalog
as $$
  select * from nightwatch_private.nightwatch_ensure_account();
$$;

revoke all on function public.nightwatch_ensure_account() from public, anon;
grant execute on function public.nightwatch_ensure_account() to authenticated;
