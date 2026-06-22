-- Add stable Stripe payment references for refund reconciliation.
-- Safe migration: only adds nullable identifiers and indexes to the existing revenue ledger.

alter table public.stripe_revenue_events
  add column if not exists stripe_payment_intent_id text;

alter table public.stripe_revenue_events
  add column if not exists stripe_charge_id text;

create unique index if not exists stripe_revenue_events_payment_intent_id_unique
  on public.stripe_revenue_events(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists stripe_revenue_events_charge_id_unique
  on public.stripe_revenue_events(stripe_charge_id)
  where stripe_charge_id is not null;

create index if not exists stripe_revenue_events_refund_idx
  on public.stripe_revenue_events(amount_refunded_cents)
  where amount_refunded_cents > 0;
