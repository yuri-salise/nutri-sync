-- NutriSync on Supabase: run once in the Supabase SQL editor, after `alembic upgrade head`.
-- Safe to run again after later migrations.
--
-- Supabase publishes the `public` schema through its Data API to the `anon` and
-- `authenticated` roles. NutriSync never uses that API: the FastAPI backend talks to
-- Postgres directly. Without this, anyone holding the project's public anon key could
-- read tables such as `users` (password hashes included).

-- 1. Take every privilege on public away from the Data API roles, now and for future tables.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- 2. Defense in depth: RLS on every public table. The backend connects as the table owner
--    and is not affected; any other role sees no rows unless a policy allows it.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- 3. Check: should return no rows.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated');
