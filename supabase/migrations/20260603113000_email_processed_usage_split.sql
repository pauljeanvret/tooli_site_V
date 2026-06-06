-- Split customer-facing processed emails from internal AI-analyzed emails.
-- Safe migration: adds columns and backfills from the legacy emails_analyzed counter.

alter table public.monthly_usage
  add column if not exists emails_processed integer not null default 0 check (emails_processed >= 0);

alter table public.monthly_usage
  add column if not exists emails_ai_analyzed integer not null default 0 check (emails_ai_analyzed >= 0);

update public.monthly_usage
set
  emails_processed = greatest(emails_processed, emails_analyzed),
  emails_ai_analyzed = greatest(emails_ai_analyzed, emails_analyzed)
where emails_analyzed > 0;
