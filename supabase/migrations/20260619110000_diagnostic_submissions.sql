-- Toolia public Gmail inbox diagnostic submissions.
-- Stores declared questionnaire answers and calculated estimates.
-- Raw Gmail data is never involved in this diagnostic.

create table if not exists public.diagnostic_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null,
  email text not null,
  age_range text not null,
  role text not null,
  company_size text not null,
  emails_per_day_range text not null,
  emails_per_day_estimate integer not null,
  inbox_minutes_per_day integer not null,
  main_pain text not null,
  organization_level text not null,
  monthly_income_range text not null,
  monthly_income_estimate integer not null,
  hourly_value numeric not null,
  hours_lost_per_month numeric not null,
  hours_lost_per_year numeric not null,
  cost_lost_per_month numeric not null,
  cost_lost_per_year numeric not null,
  recommended_plan text not null,
  consent_to_contact boolean not null,
  status text not null default 'new',
  notes text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  user_agent text,
  referrer text,
  constraint diagnostic_submissions_recommended_plan_check
    check (recommended_plan in ('starter', 'pro', 'premium')),
  constraint diagnostic_submissions_status_check
    check (status in ('new', 'to_contact', 'contacted', 'converted', 'not_interested')),
  constraint diagnostic_submissions_consent_check
    check (consent_to_contact = true)
);

create index if not exists diagnostic_submissions_created_at_idx
  on public.diagnostic_submissions(created_at desc);

create index if not exists diagnostic_submissions_status_idx
  on public.diagnostic_submissions(status, created_at desc);

create index if not exists diagnostic_submissions_recommended_plan_idx
  on public.diagnostic_submissions(recommended_plan, created_at desc);

alter table public.diagnostic_submissions enable row level security;

-- No public SELECT/UPDATE/DELETE policy on purpose.
-- Submissions are created and read through server routes using the service role.
