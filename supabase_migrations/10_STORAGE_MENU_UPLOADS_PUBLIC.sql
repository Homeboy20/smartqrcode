-- Ensure menu uploads bucket is publicly readable so menu item images can load on public menu pages.

-- 1) Create bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('menu-uploads', 'menu-uploads', true)
on conflict (id) do update set public = true;

-- 2) Allow public (anon) read access to objects in this bucket
-- Note: even for public buckets, explicit policies help avoid accidental RLS blocks.
drop policy if exists "Public can read menu uploads" on storage.objects;
create policy "Public can read menu uploads"
on storage.objects
for select
to anon
using (
  bucket_id = 'menu-uploads'
);
