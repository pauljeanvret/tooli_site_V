-- Plan quotas and AI usage tracking.
-- Safe migration: creates usage tables and adds non-destructive columns only.

create table if not exists public.plan_limits (
  plan_id text primary key,
  name text not null,
  monthly_price_eur integer not null,
  setup_price_eur integer not null,
  max_labels integer not null,
  monthly_email_analyses integer not null,
  monthly_ai_drafts integer not null,
  monthly_telegram_ai_alerts integer not null,
  monthly_style_analyses integer not null,
  automation_frequency_label text not null,
  telegram_category_alerts boolean not null default false,
  telegram_advanced boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.plan_limits (
  plan_id,
  name,
  monthly_price_eur,
  setup_price_eur,
  max_labels,
  monthly_email_analyses,
  monthly_ai_drafts,
  monthly_telegram_ai_alerts,
  monthly_style_analyses,
  automation_frequency_label,
  telegram_category_alerts,
  telegram_advanced,
  updated_at
) values
  ('starter', 'Starter', 29, 49, 5, 1500, 100, 0, 1, '30 minutes minimum', false, false, now()),
  ('pro', 'Pro', 69, 99, 12, 4000, 400, 500, 2, '10 minutes minimum', true, false, now()),
  ('premium', 'Premium', 129, 199, 25, 10000, 1200, 2000, 4, '5 minutes minimum', true, true, now())
on conflict (plan_id) do update set
  name = excluded.name,
  monthly_price_eur = excluded.monthly_price_eur,
  setup_price_eur = excluded.setup_price_eur,
  max_labels = excluded.max_labels,
  monthly_email_analyses = excluded.monthly_email_analyses,
  monthly_ai_drafts = excluded.monthly_ai_drafts,
  monthly_telegram_ai_alerts = excluded.monthly_telegram_ai_alerts,
  monthly_style_analyses = excluded.monthly_style_analyses,
  automation_frequency_label = excluded.automation_frequency_label,
  telegram_category_alerts = excluded.telegram_category_alerts,
  telegram_advanced = excluded.telegram_advanced,
  updated_at = now();

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('email_analysis', 'ai_draft', 'telegram_alert', 'style_analysis')),
  amount integer not null default 1 check (amount > 0),
  credits_used integer not null default 0 check (credits_used >= 0),
  source text not null default 'manual',
  related_gmail_message_id text,
  related_thread_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_key text not null,
  emails_analyzed integer not null default 0 check (emails_analyzed >= 0),
  ai_drafts_created integer not null default 0 check (ai_drafts_created >= 0),
  telegram_alerts_sent integer not null default 0 check (telegram_alerts_sent >= 0),
  style_analyses_used integer not null default 0 check (style_analyses_used >= 0),
  credits_used integer not null default 0 check (credits_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

alter table public.email_processing_logs
  add column if not exists processed_at timestamptz;

alter table public.email_processing_logs
  add column if not exists skipped_reason text;

create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events(user_id, created_at desc);

create index if not exists ai_usage_events_type_created_idx
  on public.ai_usage_events(user_id, event_type, created_at desc);

create index if not exists monthly_usage_month_idx
  on public.monthly_usage(month_key);

alter table public.plan_limits enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.monthly_usage enable row level security;

drop policy if exists "plan_limits_read_all" on public.plan_limits;
create policy "plan_limits_read_all" on public.plan_limits
  for select using (true);

drop policy if exists "ai_usage_events_select_own" on public.ai_usage_events;
create policy "ai_usage_events_select_own" on public.ai_usage_events
  for select using (auth.uid() = user_id);

drop policy if exists "monthly_usage_select_own" on public.monthly_usage;
create policy "monthly_usage_select_own" on public.monthly_usage
  for select using (auth.uid() = user_id);
