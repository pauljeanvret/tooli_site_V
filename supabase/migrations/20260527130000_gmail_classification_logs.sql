-- Gmail Classification Batch: compact per-email processing logs.
-- Adds structured columns to existing logs without storing full email bodies.

alter table public.email_processing_logs
  add column if not exists thread_id text;

alter table public.email_processing_logs
  add column if not exists sender text;

alter table public.email_processing_logs
  add column if not exists subject text;

alter table public.email_processing_logs
  add column if not exists predicted_category text;

alter table public.email_processing_logs
  add column if not exists confidence numeric;

alter table public.email_processing_logs
  add column if not exists importance text;

alter table public.email_processing_logs
  add column if not exists label_applied boolean not null default false;

alter table public.email_processing_logs
  add column if not exists draft_created boolean not null default false;

alter table public.email_processing_logs
  add column if not exists draft_id text;

alter table public.email_processing_logs
  add column if not exists reason text;

alter table public.email_processing_logs
  add column if not exists processed_at timestamptz;

create index if not exists email_processing_logs_message_idx
  on public.email_processing_logs(user_id, gmail_message_id);

create index if not exists email_processing_logs_status_idx
  on public.email_processing_logs(user_id, status, created_at desc);
