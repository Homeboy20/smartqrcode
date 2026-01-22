-- Team notifications for order workflow (manual + system events)

create table if not exists public.restaurant_order_notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid null references public.restaurant_orders(id) on delete set null,
  kind text not null default 'manual',
  target_role text null,
  target_user_id uuid null references auth.users(id) on delete set null,
  message text null,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint restaurant_order_notifications_kind_check check (kind in ('manual','assignment','ready','status'))
);

create index if not exists restaurant_order_notifications_restaurant_created_idx
  on public.restaurant_order_notifications (restaurant_id, created_at desc);

create index if not exists restaurant_order_notifications_target_user_created_idx
  on public.restaurant_order_notifications (target_user_id, created_at desc);

alter table public.restaurant_order_notifications enable row level security;

-- Staff + owner can read notifications for their restaurant (limited to targeted/broadcast)
drop policy if exists "Staff can read order notifications" on public.restaurant_order_notifications;
create policy "Staff can read order notifications"
on public.restaurant_order_notifications
for select
to authenticated
using (
  (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_order_notifications.restaurant_id
        and r.user_id = auth.uid()
    )
    or exists (
      select 1 from public.restaurant_staff s
      where s.restaurant_id = restaurant_order_notifications.restaurant_id
        and s.user_id = auth.uid()
    )
  )
  and (
    restaurant_order_notifications.target_user_id is null
    or restaurant_order_notifications.target_user_id = auth.uid()
    or (
      restaurant_order_notifications.target_role is not null
      and exists (
        select 1 from public.restaurant_staff s2
        where s2.restaurant_id = restaurant_order_notifications.restaurant_id
          and s2.user_id = auth.uid()
          and s2.role = restaurant_order_notifications.target_role
      )
    )
  )
);

-- Only owner/manager/kitchen can create notifications (manual or system)
drop policy if exists "Staff can create order notifications" on public.restaurant_order_notifications;
create policy "Staff can create order notifications"
on public.restaurant_order_notifications
for insert
to authenticated
with check (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_order_notifications.restaurant_id
      and r.user_id = auth.uid()
  )
  or exists (
    select 1 from public.restaurant_staff s
    where s.restaurant_id = restaurant_order_notifications.restaurant_id
      and s.user_id = auth.uid()
      and s.role in ('manager','kitchen')
  )
);
