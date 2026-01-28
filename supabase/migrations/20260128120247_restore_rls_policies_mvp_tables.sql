/*
  migration: restore rls and policies for mvp tables
  purpose:
    - re-enable and force rls on public.flashcards, public.generations, public.app_config
    - restore granular policies as defined in the mvp schema migration
  affected objects:
    - tables: public.flashcards, public.generations, public.app_config
    - policies: all rls policies for the above tables
  notes:
    - this migration is intended to reverse the development-only rls disablement
    - service role continues to bypass rls as per supabase behavior
*/

begin;

-- drop any existing policies first to avoid name collisions.
-- destructive: this removes all rls policies for the target tables so they can be recreated cleanly.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('flashcards', 'generations', 'app_config')
  loop
    execute format('drop policy if exists %I on %I.%I;', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- table: public.generations
-- ---------------------------------------------------------------------------
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
