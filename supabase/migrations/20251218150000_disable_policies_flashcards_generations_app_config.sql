/*
  migration: disable policies for mvp tables
  purpose:
    - drop all RLS policies on:
      - public.flashcards
      - public.generations
      - public.app_config
    - disable (and unforce) RLS on those tables so policies no longer apply
*/

begin;

-- Drop every policy currently defined on these tables (robust against policy renames).
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

-- Ensure RLS is not applied for these MVP tables.
alter table public.flashcards disable row level security;
alter table public.flashcards no force row level security;

alter table public.generations disable row level security;
alter table public.generations no force row level security;

alter table public.app_config disable row level security;
alter table public.app_config no force row level security;

commit;


