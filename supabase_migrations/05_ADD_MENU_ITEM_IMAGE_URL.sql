-- Add optional image URL to menu items (restaurant digital menu)

alter table public.menu_items
add column if not exists image_url text null;

-- Basic safety: accept only http(s) when provided.
alter table public.menu_items
drop constraint if exists menu_items_image_url_format;

alter table public.menu_items
add constraint menu_items_image_url_format
check (image_url is null or image_url ~ '^https?://');
