-- Toolia SaaS backend V1
-- Safe defaults: no auto-send, no permanent delete, Gmail OAuth only.

create extension if not exists "pgcrypto";

do $$
begin
  create type subscription_status as enum ('demo', 'trialing', 'active', 'past_due', 'canceled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type automation_status as enum ('draft', 'active', 'paused', 'disabled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type automation_action as enum ('label_only', 'draft_reply', 'notify_telegram', 'archive');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null,
  status subscription_status not null default 'demo',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  gmail_email text,
  google_account_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  scopes text[] not null default '{}',
  connected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gmail_connections_no_password check (access_token_encrypted is null or access_token_encrypted <> '')
);

create table if not exists public.automation_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status automation_status not null default 'draft',
  profile_json jsonb not null,
  business_context jsonb not null default '{}'::jsonb,
  global_settings jsonb not null default '{}'::jsonb,
  safety jsonb not null default '{}'::jsonb,
  activated_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_profiles_no_auto_send check ((profile_json #>> '{global_settings,auto_send_enabled}')::boolean is not true),
  constraint automation_profiles_no_delete check ((profile_json #>> '{global_settings,permanent_delete_enabled}')::boolean is not true)
);

create table if not exists public.automation_categories (
  id uuid primary key default gen_random_uuid(),
  automation_profile_id uuid not null references public.automation_profiles(id) on delete cascade,
  key text not null,
  label text not null,
  description text not null,
  actions jsonb not null default '{"label": true, "draft": false, "telegram": false, "archive": false}'::jsonb,
  priority text not null default 'normal',
  draft_reply_enabled boolean not null default false,
  telegram_notify boolean not null default false,
  archive_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (automation_profile_id, key)
);

create table if not exists public.gmail_label_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  automation_category_id uuid not null references public.automation_categories(id) on delete cascade,
  gmail_label_id text,
  gmail_label_name text not null,
  created_in_gmail boolean not null default false,
  created_at timestamptz not null default now(),
  unique (automation_category_id, gmail_label_name)
);

create table if not exists public.email_processing_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  automation_profile_id uuid references public.automation_profiles(id) on delete set null,
  gmail_message_id text,
  category_key text,
  action automation_action,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chat_id_encrypted text,
  username text,
  enabled boolean not null default false,
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  actor text not null default 'system',
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists gmail_connections_user_id_idx on public.gmail_connections(user_id);
create index if not exists automation_profiles_user_id_status_idx on public.automation_profiles(user_id, status);
create index if not exists automation_categories_profile_id_idx on public.automation_categories(automation_profile_id);
create index if not exists gmail_label_mappings_user_id_idx on public.gmail_label_mappings(user_id);
create index if not exists email_processing_logs_user_id_created_at_idx on public.email_processing_logs(user_id, created_at desc);
create index if not exists telegram_connections_user_id_idx on public.telegram_connections(user_id);
create index if not exists audit_logs_user_id_created_at_idx on public.audit_logs(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.automation_profiles enable row level security;
alter table public.automation_categories enable row level security;
alter table public.gmail_label_mappings enable row level security;
alter table public.email_processing_logs enable row level security;
alter table public.telegram_connections enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions for select using (auth.uid() = user_id);

drop policy if exists "gmail_connections_select_own" on public.gmail_connections;
create policy "gmail_connections_select_own" on public.gmail_connections for select using (auth.uid() = user_id);

drop policy if exists "automation_profiles_select_own" on public.automation_profiles;
create policy "automation_profiles_select_own" on public.automation_profiles for select using (auth.uid() = user_id);

drop policy if exists "telegram_connections_select_own" on public.telegram_connections;
create policy "telegram_connections_select_own" on public.telegram_connections for select using (auth.uid() = user_id);

drop policy if exists "audit_logs_select_own" on public.audit_logs;
create policy "audit_logs_select_own" on public.audit_logs for select using (auth.uid() = user_id);
