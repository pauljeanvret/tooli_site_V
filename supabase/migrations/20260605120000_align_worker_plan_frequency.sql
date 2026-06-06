-- Align plan frequency labels with the worker MVP cooldowns.
-- Safe migration: updates display labels only, no quota or pricing changes.

update public.plan_limits
set automation_frequency_label = '30 minutes minimum',
    updated_at = now()
where plan_id = 'starter';

update public.plan_limits
set automation_frequency_label = '10 minutes minimum',
    updated_at = now()
where plan_id = 'pro';

update public.plan_limits
set automation_frequency_label = '5 minutes minimum',
    updated_at = now()
where plan_id = 'premium';
