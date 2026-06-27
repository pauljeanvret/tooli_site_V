-- Add Stripe subscription statuses needed for accurate admin finance display.
-- Safe migration: only extends the existing enum, no data is changed or removed.

alter type public.subscription_status add value if not exists 'paused';
alter type public.subscription_status add value if not exists 'incomplete';
alter type public.subscription_status add value if not exists 'unpaid';
alter type public.subscription_status add value if not exists 'unknown';
