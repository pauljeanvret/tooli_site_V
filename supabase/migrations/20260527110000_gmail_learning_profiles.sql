-- Gmail Learning Batch: compact writing style profile storage.
-- Stores only summarized style signals, never raw Gmail email bodies.

create table if not exists public.writing_style_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sample_count integer not null default 0,
  tone_summary text not null default '',
  average_length text not null default 'medium',
  greeting_style text not null default '',
  closing_style text not null default '',
  signature_detected text,
  formality_level text not null default 'balanced',
  tutoiement_or_vouvoiement_preference text not null default 'unknown',
  common_phrases text[] not null default '{}',
  things_to_avoid text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint writing_style_profiles_average_length_check
    check (average_length in ('short', 'medium', 'long')),
  constraint writing_style_profiles_formality_level_check
    check (formality_level in ('casual', 'balanced', 'formal')),
  constraint writing_style_profiles_addressing_check
    check (tutoiement_or_vouvoiement_preference in ('tu', 'vous', 'mixed', 'unknown'))
);

create index if not exists writing_style_profiles_updated_at_idx
  on public.writing_style_profiles(updated_at desc);

alter table public.writing_style_profiles enable row level security;

drop policy if exists "writing_style_profiles_select_own" on public.writing_style_profiles;
create policy "writing_style_profiles_select_own" on public.writing_style_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "writing_style_profiles_insert_own" on public.writing_style_profiles;
create policy "writing_style_profiles_insert_own" on public.writing_style_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "writing_style_profiles_update_own" on public.writing_style_profiles;
create policy "writing_style_profiles_update_own" on public.writing_style_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "writing_style_profiles_delete_own" on public.writing_style_profiles;
create policy "writing_style_profiles_delete_own" on public.writing_style_profiles
  for delete using (auth.uid() = user_id);
