/*
  migration: create mvp schema for damix 10x cards
  purpose:
    - create core mvp tables: public.flashcards, public.generations, public.app_config
    - enforce constraints (lengths, enums via checks, ai/manual consistency, hash length)
    - add updated_at maintenance triggers where applicable
    - enable row level security (rls) on all new tables
    - add explicit, granular rls policies per operation and per supabase role (anon, authenticated)

  affected objects:
    - extension: pgcrypto (for gen_random_uuid())
    - function: public.tg_set_updated_at()
    - tables:
      - public.flashcards
      - public.generations
      - public.app_config
    - indexes:
      - public.flashcards: idx_flashcards_user_created_at, idx_flashcards_user_updated_at, idx_flashcards_user_source, idx_flashcards_generation_id
      - public.generations: idx_generations_user_created_at, idx_generations_user_status_created_at

  notes:
    - auth is provided by supabase auth; user references use auth.users(id)
    - public.app_config is intentionally not accessible to anon/authenticated users; backend access should use service role (service role bypasses rls in supabase)
    - daily limit aggregation is expected to use utc boundaries; this migration does not add computed columns for that
*/

begin;

-- ensure uuid generation function is available (supabase commonly enables this, but we make it explicit).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helper trigger function for updated_at maintenance
-- ---------------------------------------------------------------------------
-- this function is used by triggers on tables that have an updated_at column.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- table: public.generations
-- ---------------------------------------------------------------------------
-- stores generation attempts for daily limiting (utc day), diagnostics, and success metrics.
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid() not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz null,
  error_code text null,
  error_message text null,
  input_length integer not null check (input_length between 1000 and 20000),
  input_hash bytea not null check (octet_length(input_hash) = 32),
  generated_count integer null,
  accepted_original_count integer null,
  accepted_edited_count integer null
);

-- indexes for common queries: history and daily usage counting.
create index if not exists idx_generations_user_created_at
  on public.generations (user_id, created_at desc);

create index if not exists idx_generations_user_status_created_at
  on public.generations (user_id, status, created_at desc);

-- rls: owner-only access for authenticated; explicit deny for anon.
alter table public.generations enable row level security;
alter table public.generations force row level security;

-- anon policies (deny all)
create policy generations_select_anon_deny
  on public.generations
  for select
  to anon
  using (false);

create policy generations_insert_anon_deny
  on public.generations
  for insert
  to anon
  with check (false);

create policy generations_update_anon_deny
  on public.generations
  for update
  to anon
  using (false)
  with check (false);

create policy generations_delete_anon_deny
  on public.generations
  for delete
  to anon
  using (false);

-- authenticated policies (owner-only)
-- rationale: a user can only see and mutate their own generation records (user_id = auth.uid()).
create policy generations_select_authenticated_owner
  on public.generations
  for select
  to authenticated
  using (user_id = auth.uid());

create policy generations_insert_authenticated_owner
  on public.generations
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy generations_update_authenticated_owner
  on public.generations
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy generations_delete_authenticated_owner
  on public.generations
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- table: public.flashcards
-- ---------------------------------------------------------------------------
-- stores accepted flashcards (ai and manual). ai flashcards must reference a generation id.
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid() not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  front text not null
    check (char_length(front) >= 1)
    check (char_length(front) <= 200),
  back text not null
    check (char_length(back) >= 1)
    check (char_length(back) <= 500),
  source text not null check (source in ('ai', 'ai-edited', 'manual')),
  generation_id uuid null references public.generations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- enforce consistency between source and generation_id:
  -- - manual cards must not reference generations
  -- - ai / ai-edited cards must reference a generation
  constraint flashcards_source_generation_consistency
    check (
      (source = 'manual' and generation_id is null)
      or
      (source in ('ai', 'ai-edited') and generation_id is not null)
    )
);

-- indexes for list and sorting views.
create index if not exists idx_flashcards_user_created_at
  on public.flashcards (user_id, created_at desc);

create index if not exists idx_flashcards_user_updated_at
  on public.flashcards (user_id, updated_at desc);

create index if not exists idx_flashcards_user_source
  on public.flashcards (user_id, source);

-- optional index from the plan, implemented for join/count performance.
create index if not exists idx_flashcards_generation_id
  on public.flashcards (generation_id);

-- keep updated_at current on any update.
drop trigger if exists set_updated_at_on_flashcards on public.flashcards;
create trigger set_updated_at_on_flashcards
before update on public.flashcards
for each row
execute function public.tg_set_updated_at();

-- rls: owner-only access for authenticated; explicit deny for anon.
alter table public.flashcards enable row level security;
alter table public.flashcards force row level security;

-- anon policies (deny all)
create policy flashcards_select_anon_deny
  on public.flashcards
  for select
  to anon
  using (false);

create policy flashcards_insert_anon_deny
  on public.flashcards
  for insert
  to anon
  with check (false);

create policy flashcards_update_anon_deny
  on public.flashcards
  for update
  to anon
  using (false)
  with check (false);

create policy flashcards_delete_anon_deny
  on public.flashcards
  for delete
  to anon
  using (false);

-- authenticated policies (owner-only)
-- rationale: a user can only see and mutate their own flashcards (user_id = auth.uid()).
-- note: update policy uses both using and with check to prevent transferring ownership by changing user_id.
create policy flashcards_select_authenticated_owner
  on public.flashcards
  for select
  to authenticated
  using (user_id = auth.uid());

create policy flashcards_insert_authenticated_owner
  on public.flashcards
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy flashcards_update_authenticated_owner
  on public.flashcards
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy flashcards_delete_authenticated_owner
  on public.flashcards
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- table: public.app_config
-- ---------------------------------------------------------------------------
-- key/value store for global configuration.
-- security model: no access for anon/authenticated; backend should use service role.
create table if not exists public.app_config (
  key text primary key not null,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- keep updated_at current on any update.
drop trigger if exists set_updated_at_on_app_config on public.app_config;
create trigger set_updated_at_on_app_config
before update on public.app_config
for each row
execute function public.tg_set_updated_at();

-- rls: enabled (required), with explicit deny policies for anon/authenticated.
alter table public.app_config enable row level security;
alter table public.app_config force row level security;

-- anon policies (deny all)
create policy app_config_select_anon_deny
  on public.app_config
  for select
  to anon
  using (false);

create policy app_config_insert_anon_deny
  on public.app_config
  for insert
  to anon
  with check (false);

create policy app_config_update_anon_deny
  on public.app_config
  for update
  to anon
  using (false)
  with check (false);

create policy app_config_delete_anon_deny
  on public.app_config
  for delete
  to anon
  using (false);

-- authenticated policies (deny insert, update, delete)
-- rationale: authenticated users should not modify global configuration.
create policy app_config_insert_authenticated_deny
  on public.app_config
  for insert
  to authenticated
  with check (false);

create policy app_config_update_authenticated_deny
  on public.app_config
  for update
  to authenticated
  using (false)
  with check (false);

create policy app_config_delete_authenticated_deny
  on public.app_config
  for delete
  to authenticated
  using (false);

-- ensure authenticated users can read configuration values.
-- rationale: read-only access for application usage; writes remain blocked.
create policy app_config_select_authenticated_read
  on public.app_config
  for select
  to authenticated
  using (true);

commit;


