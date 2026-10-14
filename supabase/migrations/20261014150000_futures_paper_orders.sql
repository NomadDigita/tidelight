create table if not exists public.futures_paper_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.futures_paper_accounts(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z]{2,10}USDT$'),
  action text not null check (action in ('open_long','open_short')),
  order_type text not null check (order_type in ('limit','conditional')),
  margin numeric(12,2) not null check (margin between 10 and 250),
  leverage integer not null check (leverage between 1 and 100),
  limit_price numeric(24,10),
  trigger_price numeric(24,10),
  post_only boolean not null default false,
  reduce_only boolean not null default false,
  status text not null default 'pending' check (status in ('pending','processing','filled','canceled','blocked')),
  reason text,
  fill_price numeric(24,10),
  quantity numeric(24,8),
  fill_id uuid references public.futures_paper_fills(id) on delete set null,
  processing_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  filled_at timestamptz,
  constraint futures_paper_orders_price_valid check (
    (order_type = 'limit' and limit_price is not null and limit_price > 0 and trigger_price is null)
    or (order_type = 'conditional' and trigger_price is not null and trigger_price > 0 and limit_price is null)
  )
);

create index if not exists futures_paper_orders_open_idx on public.futures_paper_orders(user_id, symbol, created_at desc) where status in ('pending','processing');
create index if not exists futures_paper_orders_account_idx on public.futures_paper_orders(account_id, created_at desc);
alter table public.futures_paper_orders enable row level security;
create policy "Owners read their futures paper orders" on public.futures_paper_orders for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.futures_paper_orders from public, anon, authenticated;
grant select on public.futures_paper_orders to authenticated;
grant all on public.futures_paper_orders to service_role;
