-- Stripe revenue ledger for internal finance/profitability reporting.
-- Stores paid invoice/session facts in cents, including discounts and refunds.
-- No payment method details, card data, Gmail data, prompts, tokens, or secrets are stored here.

create table if not exists public.stripe_revenue_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stripe_created_at timestamptz,
  stripe_event_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_invoice_id text,
  stripe_checkout_session_id text,
  user_id uuid references public.profiles(id) on delete set null,
  customer_email text,
  plan text,
  currency text not null default 'eur',
  amount_paid_cents integer not null default 0,
  amount_due_cents integer,
  amount_discount_cents integer,
  amount_refunded_cents integer not null default 0,
  net_revenue_cents integer not null default 0,
  period_start timestamptz,
  period_end timestamptz,
  source text not null,
  raw_type text,
  metadata jsonb
);

create unique index if not exists stripe_revenue_events_event_id_unique
  on public.stripe_revenue_events(stripe_event_id)
  where stripe_event_id is not null;

create unique index if not exists stripe_revenue_events_invoice_id_unique
  on public.stripe_revenue_events(stripe_invoice_id)
  where stripe_invoice_id is not null;

create unique index if not exists stripe_revenue_events_checkout_session_id_unique
  on public.stripe_revenue_events(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists stripe_revenue_events_user_created_idx
  on public.stripe_revenue_events(user_id, created_at desc);

create index if not exists stripe_revenue_events_customer_created_idx
  on public.stripe_revenue_events(stripe_customer_id, created_at desc);

create index if not exists stripe_revenue_events_period_idx
  on public.stripe_revenue_events(period_start, period_end);

create index if not exists stripe_revenue_events_plan_created_idx
  on public.stripe_revenue_events(plan, created_at desc);

alter table public.stripe_revenue_events enable row level security;

-- No public policies on purpose.
-- The finance dashboard reads this table only through admin/server routes using the service role.
