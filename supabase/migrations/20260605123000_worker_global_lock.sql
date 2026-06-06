-- Global worker lock for automatic Gmail processing.
-- Prevents overlapping worker runs in serverless/cron environments.

create table if not exists public.worker_locks (
  lock_key text primary key,
  owner_id uuid not null,
  acquired_at timestamptz not null default now(),
  locked_until timestamptz not null,
  released_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists worker_locks_locked_until_idx
  on public.worker_locks(locked_until);

alter table public.worker_locks enable row level security;

revoke all on table public.worker_locks from anon, authenticated;
grant select, insert, update, delete on table public.worker_locks to service_role;

create or replace function public.try_acquire_worker_lock(
  p_lock_key text,
  p_owner_id uuid,
  p_timeout_seconds integer default 600,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_timeout_seconds integer := greatest(coalesce(p_timeout_seconds, 600), 1);
  v_locked_until timestamptz := v_now + make_interval(secs => v_timeout_seconds);
  v_row public.worker_locks%rowtype;
begin
  insert into public.worker_locks as existing_lock (
    lock_key,
    owner_id,
    acquired_at,
    locked_until,
    released_at,
    metadata,
    updated_at
  )
  values (
    p_lock_key,
    p_owner_id,
    v_now,
    v_locked_until,
    null,
    coalesce(p_metadata, '{}'::jsonb),
    v_now
  )
  on conflict (lock_key) do update
    set owner_id = excluded.owner_id,
        acquired_at = excluded.acquired_at,
        locked_until = excluded.locked_until,
        released_at = null,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    where existing_lock.locked_until <= v_now
       or existing_lock.released_at is not null
  returning * into v_row;

  if v_row.lock_key is not null then
    return jsonb_build_object(
      'acquired', true,
      'lockKey', v_row.lock_key,
      'ownerId', v_row.owner_id,
      'lockedUntil', v_row.locked_until,
      'existingOwnerId', null,
      'existingLockedUntil', null
    );
  end if;

  select *
    into v_row
    from public.worker_locks
   where lock_key = p_lock_key;

  return jsonb_build_object(
    'acquired', false,
    'lockKey', p_lock_key,
    'ownerId', p_owner_id,
    'lockedUntil', null,
    'existingOwnerId', v_row.owner_id,
    'existingLockedUntil', v_row.locked_until
  );
end;
$$;

create or replace function public.release_worker_lock(
  p_lock_key text,
  p_owner_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released integer := 0;
begin
  update public.worker_locks
     set released_at = now(),
         locked_until = now(),
         updated_at = now()
   where lock_key = p_lock_key
     and owner_id = p_owner_id
     and released_at is null;

  get diagnostics v_released = row_count;
  return v_released > 0;
end;
$$;

revoke all on function public.try_acquire_worker_lock(text, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.release_worker_lock(text, uuid) from public, anon, authenticated;
grant execute on function public.try_acquire_worker_lock(text, uuid, integer, jsonb) to service_role;
grant execute on function public.release_worker_lock(text, uuid) to service_role;
