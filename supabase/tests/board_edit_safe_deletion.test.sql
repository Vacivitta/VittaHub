-- Task 16.1: role-aware board editing and conservative structural deletion.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'public.update_board(uuid,text,text)', 'EXECUTE'), 'anon cannot edit boards');
select ok(not has_function_privilege('anon', 'public.delete_board_column(uuid)', 'EXECUTE'), 'anon cannot delete columns');
select ok(not has_function_privilege('anon', 'public.delete_board(uuid)', 'EXECUTE'), 'anon cannot delete boards');
select ok(p.prosecdef and p.proconfig @> array['search_path=""'], p.proname || ': secured definer')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('update_board', 'delete_board_column', 'delete_board');

insert into public.departments (id, name) values
  ('b2000000-0000-4000-8000-000000000001', 'Operações 16.1'),
  ('b2000000-0000-4000-8000-000000000002', 'Atendimento 16.1');
insert into auth.users (id) values
  ('b1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002'),
  ('b1000000-0000-4000-8000-000000000003'),
  ('b1000000-0000-4000-8000-000000000004');
insert into public.profiles (id, department_id, display_name, role) values
  ('b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Admin 16.1', 'administrador'),
  ('b1000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'Gestor A 16.1', 'gestor'),
  ('b1000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000002', 'Gestor B 16.1', 'gestor'),
  ('b1000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000001', 'Membro 16.1', 'membro');
insert into public.board_creation_authorizations (user_id, granted_by) values
  ('b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001');

insert into public.boards (id, department_id, title, description, created_by, created_at) values
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Editável', 'Original', 'b1000000-0000-4000-8000-000000000002', '2026-01-01 10:00:00+00'),
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'Outro quadro', null, 'b1000000-0000-4000-8000-000000000003', '2026-01-02 10:00:00+00'),
  ('b3000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001', 'Vazio removível', null, 'b1000000-0000-4000-8000-000000000002', '2025-01-01 10:00:00+00'),
  ('b3000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000001', 'Com concluída', null, 'b1000000-0000-4000-8000-000000000002', '2026-01-04 10:00:00+00');
insert into public.board_memberships (board_id, user_id, is_board_admin, added_by) values
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000004', false, 'b1000000-0000-4000-8000-000000000002'),
  ('b3000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000004', false, 'b1000000-0000-4000-8000-000000000002');
insert into public.board_columns (id, board_id, title, position) values
  ('b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'Ocupada', 0),
  ('b4000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000001', 'Vazia', 1),
  ('b4000000-0000-4000-8000-000000000003', 'b3000000-0000-4000-8000-000000000002', 'Outra', 0),
  ('b4000000-0000-4000-8000-000000000004', 'b3000000-0000-4000-8000-000000000003', 'Vazia removível', 0),
  ('b4000000-0000-4000-8000-000000000005', 'b3000000-0000-4000-8000-000000000004', 'Concluídas', 0);
insert into public.tasks (id, board_id, column_id, title, created_by, assignee_id, due_at, business_state, is_private) values
  ('b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'Ativa preservada', 'b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', '2030-01-01', 'fazendo', false),
  ('b5000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000004', 'b4000000-0000-4000-8000-000000000005', 'Concluída preservada', 'b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', '2030-01-02', 'concluido', false);
insert into public.task_events (id, task_id, event_type, content, actor_id) values
  ('b6000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'started', 'Histórico preservado', 'b1000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.update_board('b3000000-0000-4000-8000-000000000001', '  Novo nome  ', '  Nova descrição  ')$$, 'authorized manager edits board');
select is((select title from public.boards where id = 'b3000000-0000-4000-8000-000000000001'), 'Novo nome', 'title is trimmed and updated');
select is((select description from public.boards where id = 'b3000000-0000-4000-8000-000000000001'), 'Nova descrição', 'description is trimmed and updated');
select is((select department_id from public.boards where id = 'b3000000-0000-4000-8000-000000000001'), 'b2000000-0000-4000-8000-000000000001'::uuid, 'department is unchanged');
select is((select created_by from public.boards where id = 'b3000000-0000-4000-8000-000000000001'), 'b1000000-0000-4000-8000-000000000002'::uuid, 'creator is unchanged');
select is((select created_at from public.boards where id = 'b3000000-0000-4000-8000-000000000001'), '2026-01-01 10:00:00+00'::timestamptz, 'created_at is unchanged after editing');
select throws_ok($$select public.update_board('b3000000-0000-4000-8000-000000000001', ' ', null)$$, '22023', null::text, 'blank board title is rejected');

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000004', true);
select throws_ok($$select public.update_board('b3000000-0000-4000-8000-000000000001', 'Membro', null)$$, '42501', null::text, 'member cannot edit board');
select throws_ok($$select public.delete_board_column('b4000000-0000-4000-8000-000000000002')$$, '42501', null::text, 'member cannot delete empty column');
select throws_ok($$select public.delete_board('b3000000-0000-4000-8000-000000000003')$$, '42501', null::text, 'member cannot delete board');

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', true);
select throws_ok($$select public.update_board('b3000000-0000-4000-8000-000000000001', 'Sem acesso', null)$$, '42501', null::text, 'manager cannot edit another board');
select throws_ok($$select public.delete_board_column('b4000000-0000-4000-8000-000000000002')$$, '42501', null::text, 'manager cannot delete another board column');
select throws_ok($$select public.delete_board('b3000000-0000-4000-8000-000000000003')$$, '42501', null::text, 'manager cannot delete another board');

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.delete_board_column('b4000000-0000-4000-8000-000000000001')$$, '23503', null::text, 'occupied column is rejected');
select ok(exists(select 1 from public.tasks where id = 'b5000000-0000-4000-8000-000000000001'), 'task remains after rejected column deletion');
select ok(exists(select 1 from public.board_columns where id = 'b4000000-0000-4000-8000-000000000002'), 'other column remains after rejected deletion');
select lives_ok($$select public.delete_board_column('b4000000-0000-4000-8000-000000000002')$$, 'authorized manager deletes empty column');
select ok(not exists(select 1 from public.board_columns where id = 'b4000000-0000-4000-8000-000000000002'), 'only empty column is removed');

select throws_ok($$select public.delete_board('b3000000-0000-4000-8000-000000000001')$$, '23503', null::text, 'board with active task is rejected');
select ok(exists(select 1 from public.tasks where id = 'b5000000-0000-4000-8000-000000000001'), 'active task remains intact');
select ok(exists(select 1 from public.task_events where id = 'b6000000-0000-4000-8000-000000000001'), 'task history remains intact');
select throws_ok($$select public.delete_board('b3000000-0000-4000-8000-000000000004')$$, '23503', null::text, 'board with completed task is also rejected');
select ok(exists(select 1 from public.tasks where id = 'b5000000-0000-4000-8000-000000000002'), 'completed task remains intact');
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select ok(exists(select 1 from public.boards where id = 'b3000000-0000-4000-8000-000000000002'), 'another board is unaffected');

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.delete_board('b3000000-0000-4000-8000-000000000003')$$, 'authorized manager deletes task-free board');
select ok(not exists(select 1 from public.boards where id = 'b3000000-0000-4000-8000-000000000003'), 'empty board is removed');
select ok(not exists(select 1 from public.board_columns where board_id = 'b3000000-0000-4000-8000-000000000003'), 'empty board columns are removed');
select ok(not exists(select 1 from public.board_memberships where board_id = 'b3000000-0000-4000-8000-000000000003'), 'empty board memberships are removed');

select lives_ok($$select public.create_board('Recriado', 'b2000000-0000-4000-8000-000000000001')$$, 'board recreation succeeds');
select ok((select created_at is not null from public.boards where title = 'Recriado'), 'created board receives created_at');
select isnt((select created_at from public.boards where title = 'Recriado'), '2025-01-01 10:00:00+00'::timestamptz, 'recreated board does not reuse deleted timestamp');

select * from finish();
rollback;
