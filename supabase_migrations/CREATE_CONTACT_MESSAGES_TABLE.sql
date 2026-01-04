-- Contact messages system (hardened)
--
-- Goals:
-- - Public submissions are accepted via Supabase Edge Functions (no direct table writes)
-- - Strict default-deny RLS on all supporting tables
-- - Prevent user_id spoofing completely (user_id set only by trusted backend)
-- - Production-grade validation at the DB layer (CHECK constraints)
-- - Rate limiting support for Edge Functions (bucket table + atomic increment RPC)
--
-- Notes:
-- - Admin access must use the service role key (bypasses RLS)
-- - Optional: authenticated users may read their own messages (SELECT policy)

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Main table
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- GDPR retention: when this row becomes eligible for deletion
  -- (set/overridden by Edge Function; default here is a safe fallback)
  retention_expires_at timestamptz not null default (now() + interval '180 days'),

  -- Who sent it
  user_id uuid null references auth.users(id) on delete set null,
  name text not null,
  email citext not null,

  -- Content
  subject text not null,
  message text not null,

  -- Anti-spam / analytics (populated by Edge Function)
  ip_hash text null,
  user_agent text null,
  content_hash text not null,
  source text not null default 'edge_function',
  is_spam boolean not null default false,
  spam_score smallint not null default 0
);

-- Validation (DB-enforced)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contact_messages_name_len'
  ) then
    alter table public.contact_messages
      add constraint contact_messages_name_len
      check (char_length(btrim(name)) between 1 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_messages_subject_len'
  ) then
    alter table public.contact_messages
      add constraint contact_messages_subject_len
      check (char_length(btrim(subject)) between 1 and 200);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_messages_message_len'
  ) then
    alter table public.contact_messages
      add constraint contact_messages_message_len
      check (char_length(btrim(message)) between 1 and 5000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_messages_email_format'
  ) then
    -- Pragmatic email pattern (not RFC-perfect, but production-grade for forms)
    alter table public.contact_messages
      add constraint contact_messages_email_format
      check (
        (email::text) ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_messages_ip_hash_format'
  ) then
    -- Hex sha256 (64 hex chars) or NULL
    alter table public.contact_messages
      add constraint contact_messages_ip_hash_format
      check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_messages_content_hash_format'
  ) then
    alter table public.contact_messages
      add constraint contact_messages_content_hash_format
      check (content_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_messages_source'
  ) then
    alter table public.contact_messages
      add constraint contact_messages_source
      check (source in ('edge_function'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_messages_spam_score_range'
  ) then
    alter table public.contact_messages
      add constraint contact_messages_spam_score_range
      check (spam_score between 0 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_messages_retention_expires_at'
  ) then
    alter table public.contact_messages
      add constraint contact_messages_retention_expires_at
      check (retention_expires_at >= created_at);
  end if;
end $$;

-- Indexes for admin querying/analytics
create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

create index if not exists contact_messages_user_id_created_at_idx
  on public.contact_messages (user_id, created_at desc);

create index if not exists contact_messages_email_created_at_idx
  on public.contact_messages (email, created_at desc);

create index if not exists contact_messages_is_spam_created_at_idx
  on public.contact_messages (is_spam, created_at desc);

create index if not exists contact_messages_content_hash_idx
  on public.contact_messages (content_hash);

create index if not exists contact_messages_ip_hash_created_at_idx
  on public.contact_messages (ip_hash, created_at desc);

create index if not exists contact_messages_retention_expires_at_idx
  on public.contact_messages (retention_expires_at);

-- Strict RLS: default deny
alter table public.contact_messages enable row level security;
alter table public.contact_messages force row level security;

drop policy if exists "contact_messages_insert_public" on public.contact_messages;

-- Optional: authenticated users can read only their own messages
-- (remove this policy if you don't want any user reads)
create policy "contact_messages_select_own"
  on public.contact_messages
  for select
  to authenticated
  using (user_id = auth.uid());

-- Hard deny write access from public roles at the privilege layer.
-- This prevents bypassing Edge Function rate limiting via direct PostgREST inserts.
revoke all on table public.contact_messages from anon, authenticated;
grant select on table public.contact_messages to authenticated;

-- No UPDATE/DELETE policies are defined. Combined with revoked privileges above,
-- public clients cannot update/delete under any circumstance.

-- ==============================
-- Audit logging (abuse detection)
-- ==============================

create table if not exists public.contact_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Event type: submitted, rate_limited, deduped, honeypot, blocked, admin_list
  event_type text not null,
  request_id uuid not null,

  actor_key text null,
  user_id uuid null references auth.users(id) on delete set null,
  ip_hash text null,
  user_agent text null,
  content_hash text null,

  message_id uuid null references public.contact_messages(id) on delete set null,
  details jsonb not null default '{}'::jsonb,

  retention_expires_at timestamptz not null default (now() + interval '365 days')
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contact_audit_events_event_type'
  ) then
    alter table public.contact_audit_events
      add constraint contact_audit_events_event_type
      check (
        event_type in (
          'submitted',
          'rate_limited',
          'deduped',
          'honeypot',
          'blocked',
          'admin_list'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_audit_events_ip_hash_format'
  ) then
    alter table public.contact_audit_events
      add constraint contact_audit_events_ip_hash_format
      check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_audit_events_content_hash_format'
  ) then
    alter table public.contact_audit_events
      add constraint contact_audit_events_content_hash_format
      check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_audit_events_retention_expires_at'
  ) then
    alter table public.contact_audit_events
      add constraint contact_audit_events_retention_expires_at
      check (retention_expires_at >= created_at);
  end if;
end $$;

create index if not exists contact_audit_events_created_at_idx
  on public.contact_audit_events (created_at desc);

create index if not exists contact_audit_events_event_type_created_at_idx
  on public.contact_audit_events (event_type, created_at desc);

create index if not exists contact_audit_events_actor_key_created_at_idx
  on public.contact_audit_events (actor_key, created_at desc);

alter table public.contact_audit_events enable row level security;
alter table public.contact_audit_events force row level security;

revoke all on table public.contact_audit_events from anon, authenticated;

-- ==============================
-- Notification outbox (email)
-- ==============================

create table if not exists public.contact_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message_id uuid not null references public.contact_messages(id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text null,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz null,
  retention_expires_at timestamptz not null default (now() + interval '365 days')
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contact_notification_outbox_status'
  ) then
    alter table public.contact_notification_outbox
      add constraint contact_notification_outbox_status
      check (status in ('pending', 'sent', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contact_notification_outbox_retention_expires_at'
  ) then
    alter table public.contact_notification_outbox
      add constraint contact_notification_outbox_retention_expires_at
      check (retention_expires_at >= created_at);
  end if;
end $$;

create index if not exists contact_notification_outbox_status_next_attempt_idx
  on public.contact_notification_outbox (status, next_attempt_at);

alter table public.contact_notification_outbox enable row level security;
alter table public.contact_notification_outbox force row level security;

revoke all on table public.contact_notification_outbox from anon, authenticated;

-- ==============================
-- Abuse blocks (manual/admin)
-- ==============================

create table if not exists public.contact_abuse_blocks (
  actor_key text primary key,
  created_at timestamptz not null default now(),
  blocked_until timestamptz not null,
  reason text null,
  updated_at timestamptz not null default now()
);

alter table public.contact_abuse_blocks enable row level security;
alter table public.contact_abuse_blocks force row level security;

revoke all on table public.contact_abuse_blocks from anon, authenticated;

-- Rate limiting support table (Edge Function-only)
create table if not exists public.contact_message_rate_limits (
  actor_key text not null,
  bucket_start timestamptz not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (actor_key, bucket_start)
);

create index if not exists contact_message_rate_limits_bucket_start_idx
  on public.contact_message_rate_limits (bucket_start desc);

alter table public.contact_message_rate_limits enable row level security;
alter table public.contact_message_rate_limits force row level security;

revoke all on table public.contact_message_rate_limits from anon, authenticated;

-- Convenience indexes for investigating abuse
create index if not exists contact_message_rate_limits_actor_key_bucket_start_idx
  on public.contact_message_rate_limits (actor_key, bucket_start desc);

-- Atomic increment RPC for rate limiting (service-role only)
create or replace function public.increment_contact_rate_limit(
  p_actor_key text,
  p_bucket_start timestamptz
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.contact_message_rate_limits (actor_key, bucket_start, count)
  values (p_actor_key, p_bucket_start, 1)
  on conflict (actor_key, bucket_start)
  do update set count = public.contact_message_rate_limits.count + 1
  returning count into new_count;

  return new_count;
end;
$$;

revoke all on function public.increment_contact_rate_limit(text, timestamptz) from public;
grant execute on function public.increment_contact_rate_limit(text, timestamptz) to service_role;

-- ==============================
-- Retention purge helper (service-role only)
-- ==============================

create or replace function public.purge_contact_data(
  p_limit integer default 5000
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_messages integer := 0;
  deleted_outbox integer := 0;
  deleted_audit integer := 0;
  deleted_rate_limits integer := 0;
begin
  delete from public.contact_notification_outbox
  where retention_expires_at < now();

  get diagnostics deleted_outbox = row_count;

  -- Delete message rows eligible for deletion (cascades to outbox via FK)
  with doomed as (
    select id
    from public.contact_messages
    where retention_expires_at < now()
    order by retention_expires_at asc
    limit p_limit
  )
  delete from public.contact_messages cm
  using doomed
  where cm.id = doomed.id;

  get diagnostics deleted_messages = row_count;

  delete from public.contact_audit_events
  where retention_expires_at < now();

  get diagnostics deleted_audit = row_count;

  -- Rate-limit buckets can get large under high traffic; keep a short history.
  delete from public.contact_message_rate_limits
  where bucket_start < (now() - interval '7 days');

  get diagnostics deleted_rate_limits = row_count;

  return jsonb_build_object(
    'deleted_messages', coalesce(deleted_messages, 0),
    'deleted_outbox', coalesce(deleted_outbox, 0),
    'deleted_audit_events', coalesce(deleted_audit, 0)
    ,'deleted_rate_limits', coalesce(deleted_rate_limits, 0)
  );
end;
$$;

revoke all on function public.purge_contact_data(integer) from public;
grant execute on function public.purge_contact_data(integer) to service_role;
