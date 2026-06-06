-- Batch 1: Supabase Auth + SaaS persistence support.
-- Keeps service-role persistence available while allowing future authenticated client writes.

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "subscriptions_insert_own" on public.subscriptions;
create policy "subscriptions_insert_own" on public.subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "subscriptions_update_own" on public.subscriptions;
create policy "subscriptions_update_own" on public.subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "automation_profiles_insert_own" on public.automation_profiles;
create policy "automation_profiles_insert_own" on public.automation_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "automation_profiles_update_own" on public.automation_profiles;
create policy "automation_profiles_update_own" on public.automation_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own" on public.audit_logs
  for insert with check (auth.uid() = user_id);
