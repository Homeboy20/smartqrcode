-- Restaurant staff roles + order management (manager/kitchen/waiter)

-- Staff roles for a restaurant
create table if not exists public.restaurant_staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint restaurant_staff_role_check check (role in ('manager', 'kitchen', 'waiter')),
  constraint restaurant_staff_unique unique (restaurant_id, user_id)
);

create index if not exists restaurant_staff_restaurant_id_idx on public.restaurant_staff (restaurant_id);
create index if not exists restaurant_staff_user_id_idx on public.restaurant_staff (user_id);

-- Orders placed from public menu
create table if not exists public.restaurant_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  status text not null default 'placed',
  order_type text not null default 'delivery',
  table_number integer null,
  customer_name text null,
  customer_phone text null,
  delivery_address text null,
  delivery_notes text null,
  items jsonb not null,
  total numeric(12,2) not null default 0,
  placed_via text not null default 'menu',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint restaurant_orders_status_check check (status in ('placed','accepted','preparing','ready','served','completed','cancelled')),
  constraint restaurant_orders_type_check check (order_type in ('dine_in','delivery')),
  constraint restaurant_orders_table_positive check (table_number is null or table_number > 0)
);

create index if not exists restaurant_orders_restaurant_id_idx on public.restaurant_orders (restaurant_id);
create index if not exists restaurant_orders_restaurant_id_status_idx on public.restaurant_orders (restaurant_id, status);
create index if not exists restaurant_orders_created_at_idx on public.restaurant_orders (created_at desc);

-- Keep updated_at current
drop trigger if exists set_restaurant_orders_updated_at on public.restaurant_orders;
create trigger set_restaurant_orders_updated_at
before update on public.restaurant_orders
for each row
execute function public.set_updated_at();

-- RLS
alter table public.restaurant_staff enable row level security;
alter table public.restaurant_orders enable row level security;

-- Staff visibility: user can see their own staff row
drop policy if exists "Staff can read own staff row" on public.restaurant_staff;
create policy "Staff can read own staff row"
on public.restaurant_staff
for select
to authenticated
using (auth.uid() = user_id);

-- Restaurant owner can manage staff
drop policy if exists "Owner manages staff" on public.restaurant_staff;
create policy "Owner manages staff"
on public.restaurant_staff
for all
to authenticated
using (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_staff.restaurant_id
      and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_staff.restaurant_id
      and r.user_id = auth.uid()
  )
);

-- Orders: staff + owner can read orders for their restaurant
drop policy if exists "Staff can read orders" on public.restaurant_orders;
create policy "Staff can read orders"
on public.restaurant_orders
for select
to authenticated
using (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_orders.restaurant_id
      and r.user_id = auth.uid()
  )
  or exists (
    select 1 from public.restaurant_staff s
    where s.restaurant_id = restaurant_orders.restaurant_id
      and s.user_id = auth.uid()
  )
);

-- Orders: staff + owner can update orders for their restaurant
drop policy if exists "Staff can update orders" on public.restaurant_orders;
create policy "Staff can update orders"
on public.restaurant_orders
for update
to authenticated
using (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_orders.restaurant_id
      and r.user_id = auth.uid()
  )
  or exists (
    select 1 from public.restaurant_staff s
    where s.restaurant_id = restaurant_orders.restaurant_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_orders.restaurant_id
      and r.user_id = auth.uid()
  )
  or exists (
    select 1 from public.restaurant_staff s
    where s.restaurant_id = restaurant_orders.restaurant_id
      and s.user_id = auth.uid()
  )
);

-- Orders: insert via server (service role). No public insert policy here.
