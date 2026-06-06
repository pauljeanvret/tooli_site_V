-- Telegram connection flow for Pro/Premium.
-- Safe migration: extends existing telegram storage and adds token/log tables.

alter table public.telegram_connections
  add column if not exists telegram_chat_id text;

alter table public.telegram_connections
  add column if not exists telegram_username text;

alter table public.telegram_connections
  add column if not exists telegram_connected_at timestamptz;

alter table public.telegram_connections
  add column if not exists telegram_enabled boolean not null default false;

alter table public.telegram_connections
  add column if not exists telegram_connection_status text not null default 'disconnected';

create table if not exists public.telegram_connection_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_alert_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  gmail_message_id text,
  telegram_message_id text,
  category text,
  sent_at timestamptz,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create index if not exists telegram_connection_tokens_user_idx
  on public.telegram_connection_tokens(user_id, created_at desc);

create index if not exists telegram_connection_tokens_expires_idx
  on public.telegram_connection_tokens(expires_at);

create index if not exists telegram_alert_logs_user_created_idx
  on public.telegram_alert_logs(user_id, created_at desc);

alter table public.telegram_connection_tokens enable row level security;
alter table public.telegram_alert_logs enable row level security;

drop policy if exists "telegram_connection_tokens_select_own" on public.telegram_connection_tokens;
create policy "telegram_connection_tokens_select_own" on public.telegram_connection_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "telegram_alert_logs_select_own" on public.telegram_alert_logs;
create policy "telegram_alert_logs_select_own" on public.telegram_alert_logs
  for select using (auth.uid() = user_id);
