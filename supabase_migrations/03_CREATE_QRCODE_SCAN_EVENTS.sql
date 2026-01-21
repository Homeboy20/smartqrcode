-- Creates scan event logging for dynamic codes (and any code scans)

create table if not exists public.qrcode_scan_events (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.qrcodes(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  country text null,
  referer text null,
  user_agent text null,
  ip_hash text null check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists qrcode_scan_events_code_id_scanned_at_idx
  on public.qrcode_scan_events (code_id, scanned_at desc);

alter table public.qrcode_scan_events enable row level security;

-- Allow signed-in users to read scan events for codes they own.
-- Inserts are performed server-side using the service role key.
drop policy if exists "read scan events for own codes" on public.qrcode_scan_events;
create policy "read scan events for own codes"
on public.qrcode_scan_events
for select
using (
  exists (
    select 1
    from public.qrcodes q
    where q.id = qrcode_scan_events.code_id
      and q.user_id = auth.uid()
  )
);
