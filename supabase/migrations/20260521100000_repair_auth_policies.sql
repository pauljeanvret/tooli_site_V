-- Repair RLS policies for Toolia SaaS tables.
-- Safe to run multiple times: no tables are dropped and no data is deleted.

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.automation_profiles enable row level security;
alter table public.automation_categories enable row level security;
alter table public.gmail_label_mappings enable row level security;
alter table public.email_processing_logs enable row level security;
alter table public.telegram_connections enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "subscriptions_insert_own" on public.subscriptions;
create policy "subscriptions_insert_own" on public.subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "subscriptions_update_own" on public.subscriptions;
create policy "subscriptions_update_own" on public.subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "gmail_connections_select_own" on public.gmail_connections;
create policy "gmail_connections_select_own" on public.gmail_connections
  for select using (auth.uid() = user_id);

drop policy if exists "gmail_connections_insert_own" on public.gmail_connections;
create policy "gmail_connections_insert_own" on public.gmail_connections
  for insert with check (auth.uid() = user_id);

drop policy if exists "gmail_connections_update_own" on public.gmail_connections;
create policy "gmail_connections_update_own" on public.gmail_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "gmail_connections_delete_own" on public.gmail_connections;
create policy "gmail_connections_delete_own" on public.gmail_connections
  for delete using (auth.uid() = user_id);

drop policy if exists "automation_profiles_select_own" on public.automation_profiles;
create policy "automation_profiles_select_own" on public.automation_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "automation_profiles_insert_own" on public.automation_profiles;
create policy "automation_profiles_insert_own" on public.automation_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "automation_profiles_update_own" on public.automation_profiles;
create policy "automation_profiles_update_own" on public.automation_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "automation_profiles_delete_own" on public.automation_profiles;
create policy "automation_profiles_delete_own" on public.automation_profiles
  for delete using (auth.uid() = user_id);

drop policy if exists "automation_categories_select_own" on public.automation_categories;
create policy "automation_categories_select_own" on public.automation_categories
  for select using (
    exists (
      select 1
      from public.automation_profiles
      where automation_profiles.id = automation_categories.automation_profile_id
        and automation_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "automation_categories_insert_own" on public.automation_categories;
create policy "automation_categories_insert_own" on public.automation_categories
  for insert with check (
    exists (
      select 1
      from public.automation_profiles
      where automation_profiles.id = automation_categories.automation_profile_id
        and automation_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "automation_categories_update_own" on public.automation_categories;
create policy "automation_categories_update_own" on public.automation_categories
  for update using (
    exists (
      select 1
      from public.automation_profiles
      where automation_profiles.id = automation_categories.automation_profile_id
        and automation_profiles.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.automation_profiles
      where automation_profiles.id = automation_categories.automation_profile_id
        and automation_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "automation_categories_delete_own" on public.automation_categories;
create policy "automation_categories_delete_own" on public.automation_categories
  for delete using (
    exists (
      select 1
      from public.automation_profiles
      where automation_profiles.id = automation_categories.automation_profile_id
        and automation_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "gmail_label_mappings_select_own" on public.gmail_label_mappings;
create policy "gmail_label_mappings_select_own" on public.gmail_label_mappings
  for select using (auth.uid() = user_id);

drop policy if exists "gmail_label_mappings_insert_own" on public.gmail_label_mappings;
create policy "gmail_label_mappings_insert_own" on public.gmail_label_mappings
  for insert with check (auth.uid() = user_id);

drop policy if exists "gmail_label_mappings_update_own" on public.gmail_label_mappings;
create policy "gmail_label_mappings_update_own" on public.gmail_label_mappings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "gmail_label_mappings_delete_own" on public.gmail_label_mappings;
create policy "gmail_label_mappings_delete_own" on public.gmail_label_mappings
  for delete using (auth.uid() = user_id);

drop policy if exists "email_processing_logs_select_own" on public.email_processing_logs;
create policy "email_processing_logs_select_own" on public.email_processing_logs
  for select using (auth.uid() = user_id);

drop policy if exists "email_processing_logs_insert_own" on public.email_processing_logs;
create policy "email_processing_logs_insert_own" on public.email_processing_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "telegram_connections_select_own" on public.telegram_connections;
create policy "telegram_connections_select_own" on public.telegram_connections
  for select using (auth.uid() = user_id);

drop policy if exists "telegram_connections_insert_own" on public.telegram_connections;
create policy "telegram_connections_insert_own" on public.telegram_connections
  for insert with check (auth.uid() = user_id);

drop policy if exists "telegram_connections_update_own" on public.telegram_connections;
create policy "telegram_connections_update_own" on public.telegram_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "telegram_connections_delete_own" on public.telegram_connections;
create policy "telegram_connections_delete_own" on public.telegram_connections
  for delete using (auth.uid() = user_id);

drop policy if exists "audit_logs_select_own" on public.audit_logs;
create policy "audit_logs_select_own" on public.audit_logs
  for select using (auth.uid() = user_id);

drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own" on public.audit_logs
  for insert with check (auth.uid() = user_id);
