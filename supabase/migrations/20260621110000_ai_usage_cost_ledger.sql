-- AI cost ledger for internal finance/profitability reporting.
-- Safe migration: extends the existing ai_usage_events table without changing quota behavior.
-- No Gmail bodies, prompts, subjects, tokens, or secrets are stored here.

alter table public.ai_usage_events
  add column if not exists customer_id uuid references public.profiles(id) on delete set null;

alter table public.ai_usage_events
  add column if not exists stripe_customer_id text;

alter table public.ai_usage_events
  add column if not exists plan text;

alter table public.ai_usage_events
  add column if not exists action_type text not null default 'other';

alter table public.ai_usage_events
  add column if not exists provider text not null default 'unknown';

alter table public.ai_usage_events
  add column if not exists model text not null default 'unknown';

alter table public.ai_usage_events
  add column if not exists prompt_tokens integer not null default 0;

alter table public.ai_usage_events
  add column if not exists completion_tokens integer not null default 0;

alter table public.ai_usage_events
  add column if not exists total_tokens integer not null default 0;

alter table public.ai_usage_events
  add column if not exists input_cost_eur numeric(18,6) not null default 0;

alter table public.ai_usage_events
  add column if not exists output_cost_eur numeric(18,6) not null default 0;

alter table public.ai_usage_events
  add column if not exists total_cost_eur numeric(18,6) not null default 0;

alter table public.ai_usage_events
  add column if not exists currency text not null default 'EUR';

alter table public.ai_usage_events
  add column if not exists metadata jsonb;

alter table public.ai_usage_events
  add column if not exists run_id text;

alter table public.ai_usage_events
  add column if not exists gmail_message_count integer;

alter table public.ai_usage_events
  add column if not exists success boolean not null default true;

alter table public.ai_usage_events
  add column if not exists error_code text;

create index if not exists ai_usage_events_cost_user_created_idx
  on public.ai_usage_events(user_id, created_at desc);

create index if not exists ai_usage_events_cost_plan_created_idx
  on public.ai_usage_events(plan, created_at desc);

create index if not exists ai_usage_events_action_created_idx
  on public.ai_usage_events(action_type, created_at desc);

create index if not exists ai_usage_events_run_id_idx
  on public.ai_usage_events(run_id);
