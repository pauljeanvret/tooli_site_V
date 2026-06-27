-- Relax Stripe payment reference indexes for legacy refund reconciliation.
-- Safe migration: avoids unique conflicts when old invoice/session rows and charge refund rows coexist.

drop index if exists public.stripe_revenue_events_payment_intent_id_unique;
drop index if exists public.stripe_revenue_events_charge_id_unique;

create index if not exists stripe_revenue_events_payment_intent_id_idx
  on public.stripe_revenue_events(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists stripe_revenue_events_charge_id_idx
  on public.stripe_revenue_events(stripe_charge_id)
  where stripe_charge_id is not null;
