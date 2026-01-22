-- Add delivery staff role and order assignment fields

-- 1) Allow a new staff role: delivery
alter table public.restaurant_staff
  drop constraint if exists restaurant_staff_role_check;

alter table public.restaurant_staff
  add constraint restaurant_staff_role_check
  check (role in ('manager', 'kitchen', 'waiter', 'delivery'));

-- 2) Add assignment metadata to orders
alter table public.restaurant_orders
  add column if not exists assigned_to_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists assigned_by_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz null;

create index if not exists restaurant_orders_assigned_to_user_id_idx
  on public.restaurant_orders (assigned_to_user_id);

create index if not exists restaurant_orders_status_created_at_idx
  on public.restaurant_orders (status, created_at desc);
