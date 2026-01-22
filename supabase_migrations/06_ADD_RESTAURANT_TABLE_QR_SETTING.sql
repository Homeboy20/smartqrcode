-- Adds a per-restaurant toggle to enable dine-in per-table QR codes.

alter table if exists public.restaurants
add column if not exists enable_table_qr boolean not null default false;
