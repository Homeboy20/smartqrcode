-- Restaurant digital menu MVP
-- Adds Restaurant onboarding + menu items for WhatsApp ordering.

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  whatsapp_number text not null,
  accepted_payments text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurants_user_id_unique unique (user_id),
  constraint restaurants_slug_unique unique (slug),
  constraint restaurants_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index if not exists restaurants_user_id_idx on public.restaurants (user_id);
create index if not exists restaurants_slug_idx on public.restaurants (slug);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category text not null,
  name text not null,
  description text null,
  price numeric(12,2) not null check (price >= 0),
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_restaurant_id_idx on public.menu_items (restaurant_id);
create index if not exists menu_items_restaurant_id_category_idx on public.menu_items (restaurant_id, category);

-- Keep updated_at current
-- Reuse public.set_updated_at() defined in 01_CREATE_USERS_TABLE.sql

drop trigger if exists set_restaurants_updated_at on public.restaurants;
create trigger set_restaurants_updated_at
before update on public.restaurants
for each row
execute function public.set_updated_at();

drop trigger if exists set_menu_items_updated_at on public.menu_items;
create trigger set_menu_items_updated_at
before update on public.menu_items
for each row
execute function public.set_updated_at();

-- RLS
alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;

-- Public menu read (unauthenticated customers)
drop policy if exists "Public can read restaurants" on public.restaurants;
create policy "Public can read restaurants"
on public.restaurants
for select
using (true);

drop policy if exists "Public can read menu items" on public.menu_items;
create policy "Public can read menu items"
on public.menu_items
for select
using (true);

-- Owners can manage their own restaurant
drop policy if exists "Owners manage restaurant" on public.restaurants;
create policy "Owners manage restaurant"
on public.restaurants
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Owners can manage menu items for their restaurant
-- (Tie ownership through restaurants.user_id)
drop policy if exists "Owners manage menu items" on public.menu_items;
create policy "Owners manage menu items"
on public.menu_items
for all
to authenticated
using (
  exists (
    select 1
    from public.restaurants r
    where r.id = menu_items.restaurant_id
      and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.restaurants r
    where r.id = menu_items.restaurant_id
      and r.user_id = auth.uid()
  )
);
