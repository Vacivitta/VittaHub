-- Revised 26A contract: run after the incremental removal migration is authorized/applied.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);
select ok(to_regprocedure('public.set_board_column_state(uuid,public.kanban_business_state)') is null,
  'obsolete column binding RPC removed');
select ok(not exists (select 1 from pg_constraint
  where conrelid = 'public.board_columns'::regclass and conname = 'board_columns_allowed_business_state'),
  'only the old 26A constraint removed');
select has_column('public', 'board_columns', 'business_state', 'legacy column preserved');
select ok(not has_column_privilege('authenticated', 'public.board_columns', 'business_state', 'UPDATE'),
  'direct column state updates remain forbidden');
select * from finish();
rollback;
