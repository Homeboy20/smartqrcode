-- Allow restaurant managers (restaurant_staff.role = 'manager') to manage staff for their restaurant.

-- restaurant_staff: managers can read all staff rows for their restaurant
create policy if not exists "Managers can read staff"
on public.restaurant_staff
for select
to authenticated
using (
  exists (
    select 1
    from public.restaurant_staff s
    where s.restaurant_id = restaurant_staff.restaurant_id
      and s.user_id = auth.uid()
      and s.role = 'manager'
  )
);

-- restaurant_staff: managers can insert staff rows for their restaurant
create policy if not exists "Managers can insert staff"
on public.restaurant_staff
for insert
to authenticated
with check (
  exists (
    select 1
    from public.restaurant_staff s
    where s.restaurant_id = restaurant_staff.restaurant_id
      and s.user_id = auth.uid()
      and s.role = 'manager'
  )
);

-- restaurant_staff: managers can update staff rows for their restaurant
create policy if not exists "Managers can update staff"
on public.restaurant_staff
for update
to authenticated
using (
  exists (
    select 1
    from public.restaurant_staff s
    where s.restaurant_id = restaurant_staff.restaurant_id
      and s.user_id = auth.uid()
      and s.role = 'manager'
  )
)
with check (
  exists (
    select 1
    from public.restaurant_staff s
    where s.restaurant_id = restaurant_staff.restaurant_id
      and s.user_id = auth.uid()
      and s.role = 'manager'
  )
);

-- restaurant_staff: managers can delete staff rows for their restaurant
create policy if not exists "Managers can delete staff"
on public.restaurant_staff
for delete
to authenticated
using (
  exists (
    select 1
    from public.restaurant_staff s
    where s.restaurant_id = restaurant_staff.restaurant_id
      and s.user_id = auth.uid()
      and s.role = 'manager'
  )
);
