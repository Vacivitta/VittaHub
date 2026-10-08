-- Task 16: board/column management and column-only task movement.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'public.create_board_column(uuid,text)', 'EXECUTE'), 'anon cannot create columns');
select ok(not has_function_privilege('anon', 'public.rename_board_column(uuid,text)', 'EXECUTE'), 'anon cannot rename columns');
select ok(not has_function_privilege('anon', 'public.move_task_to_column(uuid,uuid)', 'EXECUTE'), 'anon cannot move tasks');
select ok(p.prosecdef and p.proconfig @> array['search_path=""'], p.proname || ': secured definer')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'get_board_creation_context', 'can_manage_board_structure', 'create_board',
  'create_board_column', 'rename_board_column', 'move_task_to_column'
);

insert into public.departments (id, name) values
  ('a2000000-0000-4000-8000-000000000001', 'Operações'),
  ('a2000000-0000-4000-8000-000000000002', 'Atendimento');
insert into auth.users (id) values
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000003'),
  ('a1000000-0000-4000-8000-000000000004'),
  ('a1000000-0000-4000-8000-000000000005');
insert into public.profiles (id, department_id, display_name, role) values
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Admin', 'administrador'),
  ('a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'Gestor A', 'gestor'),
  ('a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000002', 'Gestor B', 'gestor'),
  ('a1000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001', 'Membro', 'membro'),
  ('a1000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000001', 'Observador', 'membro');
insert into public.board_creation_authorizations (user_id, granted_by) values
  ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001');
insert into public.boards (id, department_id, title, created_by) values
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Quadro A', 'a1000000-0000-4000-8000-000000000002'),
  ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'Quadro B', 'a1000000-0000-4000-8000-000000000003');
insert into public.board_memberships (board_id, user_id, is_board_admin, added_by) values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', false, 'a1000000-0000-4000-8000-000000000002'),
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', false, 'a1000000-0000-4000-8000-000000000002');
insert into public.board_columns (id, board_id, title, position) values
  ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'Entrada', 0),
  ('a4000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', 'Execução', 1),
  ('a4000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000002', 'Outro quadro', 0);
insert into public.tasks (id, board_id, column_id, title, created_by, assignee_id, due_at, business_state, is_private) values
  ('a5000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'Compartilhada', 'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004', '2030-01-01', 'fazendo', false),
  ('a5000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'Privada', 'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004', '2030-01-02', 'a_fazer', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.create_board('  Quadro admin  ', 'a2000000-0000-4000-8000-000000000002', '  descrição  ')$$, 'admin creates in an existing department');

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.create_board('Quadro gestor', 'a2000000-0000-4000-8000-000000000001')$$, 'manager creates in own department');
select throws_ok($$select public.create_board('Outro departamento', 'a2000000-0000-4000-8000-000000000002')$$, '42501', null::text, 'manager cannot create outside own department');
select throws_ok($$select public.create_board('   ', 'a2000000-0000-4000-8000-000000000001')$$, '22023', null::text, 'blank board title rejected');

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000004', true);
select throws_ok($$select public.create_board('Membro negado', 'a2000000-0000-4000-8000-000000000001')$$, '42501', null::text, 'member cannot create board even with legacy authorization');
select throws_ok($$select public.create_board_column('a3000000-0000-4000-8000-000000000001', 'Negada')$$, '42501', null::text, 'member cannot create column');

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.create_board_column('a3000000-0000-4000-8000-000000000001', '  Revisão  ')$$, 'manager creates a column');
select is((select max(position) from public.board_columns where board_id = 'a3000000-0000-4000-8000-000000000001'), 2, 'new column is appended');
select lives_ok($$select public.rename_board_column('a4000000-0000-4000-8000-000000000002', '  Em andamento  ')$$, 'manager renames own board column');
select is((select title from public.board_columns where id = 'a4000000-0000-4000-8000-000000000002'), 'Em andamento', 'rename stores trimmed name');
select throws_ok($$select public.rename_board_column('a4000000-0000-4000-8000-000000000002', ' ')$$, '22023', null::text, 'blank rename rejected');
select throws_ok($$select public.rename_board_column('a4000000-0000-4000-8000-000000000003', 'Inválida')$$, '42501', null::text, 'manager cannot rename another board column');

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000004', true);
create temporary table movement_before as
select business_state, due_at, assignee_id, is_private, accepted_at, awaiting_reassignment, refused_assignee_id from public.tasks
where id = 'a5000000-0000-4000-8000-000000000001';
select lives_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000002')$$, 'assignee moves task within board');
select results_eq(
  $$select business_state, due_at, assignee_id, is_private, accepted_at, awaiting_reassignment, refused_assignee_id from public.tasks where id = 'a5000000-0000-4000-8000-000000000001'$$,
  $$select * from movement_before$$,
  'movement preserves state, deadline, assignee, privacy and acceptance');
select is((select column_id from public.tasks where id = 'a5000000-0000-4000-8000-000000000001'), 'a4000000-0000-4000-8000-000000000002'::uuid, 'column_id changes');
select is((select business_state::text from public.tasks where id = 'a5000000-0000-4000-8000-000000000001'), 'fazendo', 'business_state remains exactly unchanged');
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000003')$$, '22023', null::text, 'cross-board move rejected');

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000005', true);
select lives_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001')$$, 'active unrelated board member can move shared task');
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002')$$, '42501', null::text, 'private task visibility does not grant movement');

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002')$$, 'system admin can move private task');
select is((select business_state::text from public.tasks where id = 'a5000000-0000-4000-8000-000000000002'), 'a_fazer', 'private task business state is preserved');
select is((select count(*)::integer from public.task_events where event_type = 'column_moved' and task_id in ('a5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002')), 3, 'successful moves record system events');

select * from finish();
rollback;
