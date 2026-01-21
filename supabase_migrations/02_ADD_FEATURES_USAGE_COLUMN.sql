-- Add users.features_usage for usage tracking
-- Safe to run multiple times.

alter table public.users
  add column if not exists features_usage jsonb not null default jsonb_build_object(
    'qrCodesGenerated', 0,
    'barcodesGenerated', 0,
    'bulkGenerations', 0,
    'aiCustomizations', 0
  );

-- Optional: backfill nulls if the column existed but was nullable
update public.users
set features_usage = coalesce(features_usage, jsonb_build_object(
  'qrCodesGenerated', 0,
  'barcodesGenerated', 0,
  'bulkGenerations', 0,
  'aiCustomizations', 0
))
where features_usage is null;
