begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
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
update public.board_memberships set is_board_admin=true
where user_id='a1000000-0000-4000-8000-000000000004';
create temporary table original_tasks as select * from public.tasks where board_id='a3000000-0000-4000-8000-000000000001';
select ok(not has_column_privilege('authenticated','public.board_columns','business_state','UPDATE'),'no direct state UPDATE');
select ok(not has_function_privilege('anon','public.set_board_column_state(uuid,public.kanban_business_state)','EXECUTE'),'anonymous denied');
select is((select business_state from public.board_columns where id='a4000000-0000-4000-8000-000000000001'),null::public.kanban_business_state,'column starts unbound');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select lives_ok($$select public.set_board_column_state('a4000000-0000-4000-8000-000000000001','a_fazer')$$,'local admin binds a_fazer');
select is((select business_state::text from public.board_columns where id='a4000000-0000-4000-8000-000000000001'),'a_fazer','saved a_fazer');
select lives_ok($$select public.set_board_column_state('a4000000-0000-4000-8000-000000000001','fazendo')$$,'local admin binds fazendo');
select is((select business_state::text from public.board_columns where id='a4000000-0000-4000-8000-000000000001'),'fazendo','saved fazendo');
select lives_ok($$select public.set_board_column_state('a4000000-0000-4000-8000-000000000001','aguardando_terceiro')$$,'local admin binds aguardando_terceiro');
select is((select business_state::text from public.board_columns where id='a4000000-0000-4000-8000-000000000001'),'aguardando_terceiro','saved aguardando_terceiro');
select lives_ok($$select public.set_board_column_state('a4000000-0000-4000-8000-000000000001','concluido')$$,'local admin binds concluido');
select is((select business_state::text from public.board_columns where id='a4000000-0000-4000-8000-000000000001'),'concluido','saved concluido');
select lives_ok($$select public.set_board_column_state('a4000000-0000-4000-8000-000000000002','concluido')$$,'duplicate state allowed');
select is((select count(*) from public.board_columns where board_id='a3000000-0000-4000-8000-000000000001' and business_state='concluido'),2::bigint,'multiple columns same state');
select throws_ok($$select public.set_board_column_state('a4000000-0000-4000-8000-000000000001','aguardando_aceite')$$,'22023',null::text,'awaiting acceptance denied');
select throws_ok($$select public.set_board_column_state('a4000000-0000-4000-8000-000000000003','fazendo')$$,'42501',null::text,'local admin cannot cross boards');
select lives_ok($$select public.set_board_column_state('a4000000-0000-4000-8000-000000000001',null)$$,'remove binding');
select is((select business_state from public.board_columns where id='a4000000-0000-4000-8000-000000000001'),null::public.kanban_business_state,'binding removed');
select lives_ok($$select public.create_board_column('a3000000-0000-4000-8000-000000000001','Unbound new')$$,'creation preserved');
select is((select business_state from public.board_columns where board_id='a3000000-0000-4000-8000-000000000001' and title='Unbound new'),null::public.kanban_business_state,'new columns unbound');
select lives_ok($$select public.rename_board_column('a4000000-0000-4000-8000-000000000002','Renamed bound')$$,'rename preserved');
select is((select business_state::text from public.board_columns where id='a4000000-0000-4000-8000-000000000002'),'concluido','rename preserves binding');
select lives_ok($$select public.delete_board_column('a4000000-0000-4000-8000-000000000002')$$,'empty bound column deletion preserved');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000005',true);
select throws_ok($$select public.set_board_column_state('a4000000-0000-4000-8000-000000000001','fazendo')$$,'42501',null::text,'ordinary participant denied');
reset role;
update public.profiles set is_active=false where id='a1000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.set_board_column_state('a4000000-0000-4000-8000-000000000001','fazendo')$$,'42501',null::text,'inactive admin denied');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.set_board_column_state('a4000000-0000-4000-8000-000000000001','fazendo')$$,'existing global column authority preserved');
reset role;
select throws_ok($$update public.board_columns set business_state='aguardando_aceite' where id='a4000000-0000-4000-8000-000000000001'$$,'23514',null::text,'table check rejects forbidden state');
select results_eq($$select to_jsonb(t) from public.tasks t where board_id='a3000000-0000-4000-8000-000000000001' order by id$$,
  $$select to_jsonb(t) from original_tasks t order by id$$,'all existing task fields preserved');
select * from finish(); rollback;
