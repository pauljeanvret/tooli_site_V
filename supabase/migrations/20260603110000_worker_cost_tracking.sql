-- Worker cost optimization: last run tracking and optional estimated AI cost.
-- Safe migration: adds columns only, no destructive change.

alter table public.automation_profiles
  add column if not exists last_worker_run_at timestamptz;

alter table public.automation_profiles
  add column if not exists last_worker_status text;

alter table public.automation_profiles
  add column if not exists last_worker_processed_count integer not null default 0;

alter table public.automation_profiles
  add column if not exists last_worker_ai_cost_estimate numeric not null default 0;

alter table public.monthly_usage
  add column if not exists estimated_ai_cost_eur numeric not null default 0;

create index if not exists automation_profiles_worker_run_idx
  on public.automation_profiles(status, last_worker_run_at desc);
