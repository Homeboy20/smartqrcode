-- Creates the public.users table used throughout the app for roles/subscriptions/usage.
-- This is intended to be applied in Supabase SQL editor or migration runner.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  photo_url text,
  role text not null default 'user',
  subscription_tier text not null default 'free',
  features_usage jsonb not null default jsonb_build_object(
    'qrCodesGenerated', 0,
    'barcodesGenerated', 0,
    'bulkGenerations', 0,
    'aiCustomizations', 0
  ),

  -- payment/provider identifiers
  paystack_customer_code text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Allow authenticated users to read their own row
create policy if not exists "Users can read own row"
on public.users
for select
to authenticated
using (auth.uid() = id);

-- Allow authenticated users to update their own row
create policy if not exists "Users can update own row"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Allow authenticated users to insert their own row (useful if trigger fails or for manual backfill)
create policy if not exists "Users can insert own row"
on public.users
for insert
to authenticated
with check (auth.uid() = id);

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

-- Automatically provision public.users row when a new auth user is created (email/password or OAuth)
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  name_from_meta text;
  avatar_from_meta text;
begin
  name_from_meta := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  );

  avatar_from_meta := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    ''
  );

  insert into public.users (
    id,
    email,
    display_name,
    photo_url,
    role,
    subscription_tier
  )
  values (
    new.id,
    new.email,
    nullif(name_from_meta, ''),
    nullif(avatar_from_meta, ''),
    'user',
    'free'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.users.display_name),
    photo_url = coalesce(excluded.photo_url, public.users.photo_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
