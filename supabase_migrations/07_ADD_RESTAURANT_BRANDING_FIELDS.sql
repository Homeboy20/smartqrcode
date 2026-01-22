-- Adds per-restaurant branding options for the public menu + WhatsApp order note.

alter table if exists public.restaurants
add column if not exists logo_url text null,
add column if not exists brand_primary_color text not null default '#111827',
add column if not exists whatsapp_order_note text null;

-- Basic validation for hex colors (#RGB or #RRGGBB)
alter table if exists public.restaurants
drop constraint if exists restaurants_brand_primary_color_format;

alter table if exists public.restaurants
add constraint restaurants_brand_primary_color_format
check (brand_primary_color ~ '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$');
