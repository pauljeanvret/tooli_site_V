-- Batch Gmail 1: Google OAuth metadata for Gmail label access.
-- Safe migration: add columns only, do not drop tables or data.

alter table public.gmail_connections
  add column if not exists google_email text;

alter table public.gmail_connections
  add column if not exists status text not null default 'disconnected';

alter table public.gmail_connections
  add column if not exists expires_at timestamptz;

alter table public.gmail_connections
  add column if not exists scope text;

alter table public.gmail_connections
  add column if not exists token_type text;

alter table public.gmail_connections
  add column if not exists last_error text;

create index if not exists gmail_connections_user_status_idx
  on public.gmail_connections(user_id, status);

create index if not exists gmail_connections_user_connected_idx
  on public.gmail_connections(user_id, connected_at desc);
