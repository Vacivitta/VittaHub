-- Task 14: messages are published for Realtime Postgres Changes.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);

select ok(exists (
  select 1
  from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'messages'
), 'messages are published for Supabase Realtime');

select * from finish();
rollback;
