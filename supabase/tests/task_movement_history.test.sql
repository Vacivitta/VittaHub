-- Task 23A: reversible fictional fixtures, local pgTAP.
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

update public.board_columns set business_state = 'concluido'
where id = 'a4000000-0000-4000-8000-000000000002';
select ok(not has_function_privilege('anon','public.list_task_history(uuid)','EXECUTE'),'anonymous has no history execute');
select ok(p.prosecdef and p.proconfig @> array['search_path=""'] and pg_get_userbyid(p.proowner)='postgres','secured history definer') from pg_proc p where p.oid='public.list_task_history(uuid)'::regprocedure;
select ok(not exists(select 1 from pg_proc p, lateral aclexplode(p.proacl) a where p.oid='public.list_task_history(uuid)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC has no history execute');
set local role anon;
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002')$$,'42501',null::text,'anonymous cannot move');
select throws_ok($$select public.list_task_history('a5000000-0000-4000-8000-000000000001')$$,'42501',null::text,'anonymous cannot read history');
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002')$$,'42501',null::text,'missing session cannot move');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000099',true);
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002')$$,'42501',null::text,'missing profile cannot move');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002')$$,'42501',null::text,'outsider manager cannot move');
select throws_ok($$select public.list_task_history('a5000000-0000-4000-8000-000000000001')$$,'42501',null::text,'outsider cannot resolve actor names');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000005',true);
select lives_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002')$$,'unrelated active member moves shared task');
select is((select business_state::text from public.tasks where id='a5000000-0000-4000-8000-000000000001'),'fazendo','movement preserves state even in mapped column');
select is((select actor_id from public.task_events where task_id='a5000000-0000-4000-8000-000000000001'),'a1000000-0000-4000-8000-000000000005'::uuid,'actor comes from authenticated caller');
select ok((select created_at between transaction_timestamp() and clock_timestamp() from public.task_events where task_id='a5000000-0000-4000-8000-000000000001'),'timestamp comes from database');
select is((select content from public.task_events where task_id='a5000000-0000-4000-8000-000000000001'),'Pendência movida de "Entrada" para "Execução".','history records origin and destination');
select is((select actor_display_name from public.list_task_history('a5000000-0000-4000-8000-000000000001')),'Observador','authorized history resolves actor name');
select lives_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002')$$,'same column succeeds without event');
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000003')$$,'22023',null::text,'cross-board target rejected');
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000099')$$,'22023',null::text,'missing target rejected');
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000099','a4000000-0000-4000-8000-000000000001')$$,'42501',null::text,'missing task rejected');
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000002')$$,'42501',null::text,'shared permission does not expose private movement');
select throws_ok($$select public.list_task_history('a5000000-0000-4000-8000-000000000002')$$,'42501',null::text,'shared participant cannot read private history');
select is((select count(*)::integer from public.task_events where task_id='a5000000-0000-4000-8000-000000000002'),0,'RLS hides private history');
select is((select count(*)::integer from public.task_events where task_id in ('a5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002')),1,'no duplicate or failed-move events');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.profiles set is_active=false where id='a1000000-0000-4000-8000-000000000005';
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000005',true);
set local role authenticated;
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001')$$,'42501',null::text,'inactive member cannot move');
select throws_ok($$select public.list_task_history('a5000000-0000-4000-8000-000000000001')$$,'42501',null::text,'inactive caller cannot resolve history');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select lives_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000002')$$,'private assignee can move');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000001')$$,'private creator can move');
reset role;
insert into public.board_memberships(board_id,user_id,is_board_admin,added_by) values ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003',true,'a1000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select lives_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000002')$$,'authorized manager can move private');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000001')$$,'global admin without membership can move private');
select is((select count(*)::integer from public.task_events where task_id in ('a5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002')),5,'one event for each effective authorized move');
reset role;
update public.profiles set is_active=true where id='a1000000-0000-4000-8000-000000000005';
-- A new login is required after reactivation, independent of board membership.
insert into auth.sessions(id,user_id,created_at,updated_at) values('a1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000005',clock_timestamp(),clock_timestamp());
select set_config('request.jwt.claims','{"session_id":"a1000000-0000-4000-8000-000000000005"}',true);
delete from public.board_memberships where board_id='a3000000-0000-4000-8000-000000000001' and user_id in ('a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000005');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000002')$$,'42501',null::text,'removed participant 2 cannot move');
select throws_ok($$select public.list_task_history('a5000000-0000-4000-8000-000000000002')$$,'42501',null::text,'removed participant 2 cannot read private history');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000002')$$,'42501',null::text,'removed participant 3 cannot move');
select throws_ok($$select public.list_task_history('a5000000-0000-4000-8000-000000000002')$$,'42501',null::text,'removed participant 3 cannot read private history');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000002')$$,'42501',null::text,'removed participant 4 cannot move');
select throws_ok($$select public.list_task_history('a5000000-0000-4000-8000-000000000002')$$,'42501',null::text,'removed participant 4 cannot read private history');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000005',true);
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002')$$,'42501',null::text,'removed participant 5 cannot move');
select throws_ok($$select public.list_task_history('a5000000-0000-4000-8000-000000000002')$$,'42501',null::text,'removed participant 5 cannot read private history');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select is((select actor_display_name from public.list_task_history('a5000000-0000-4000-8000-000000000001')),'Observador','historical actor remains identified after leaving board');
select is((select count(*)::integer from public.profiles where id='a1000000-0000-4000-8000-000000000005'),0,'actor resolution does not broaden profiles RLS');
select is((select count(*)::integer from public.task_events where task_id in ('a5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002')),5,'revoked attempts create no events');
reset role;
alter table public.task_events add constraint task23_event_failure check (event_type <> 'column_moved') not valid;
set local role authenticated;
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001')$$,'23514',null::text,'event failure rolls back movement');
select is((select column_id from public.tasks where id='a5000000-0000-4000-8000-000000000001'),'a4000000-0000-4000-8000-000000000002'::uuid,'column unchanged when event insert fails');
select is((select count(*)::integer from public.task_events where task_id in ('a5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002')),5,'audit insert failure adds no events');
reset role;
alter table public.task_events drop constraint task23_event_failure;
insert into public.board_memberships(board_id,user_id,added_by) values ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001');
update public.tasks set business_state='aguardando_aceite' where id='a5000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select lives_ok($$select public.accept_task('a5000000-0000-4000-8000-000000000002')$$,'accept records existing workflow history');
select lives_ok($$select public.start_task('a5000000-0000-4000-8000-000000000002')$$,'start records existing workflow history');
select lives_ok($$select public.wait_task_for_third_party('a5000000-0000-4000-8000-000000000002', 'Dependência externa')$$,'wait records existing workflow history');
select lives_ok($$select public.resume_task('a5000000-0000-4000-8000-000000000002')$$,'resume records existing workflow history');
select lives_ok($$select public.complete_task('a5000000-0000-4000-8000-000000000002')$$,'complete records existing workflow history');
select is((select count(*)::integer from public.list_task_history('a5000000-0000-4000-8000-000000000002') where event_type in ('accepted','started','waiting_third_party','resumed','completed')),5,'all workflow event types available');
select ok(not exists(select 1 from public.list_task_history('a5000000-0000-4000-8000-000000000002') where actor_display_name is null),'authorized history identifies all actors');
select results_eq($$select id from public.list_task_history('a5000000-0000-4000-8000-000000000002')$$,$$select id from public.task_events where task_id='a5000000-0000-4000-8000-000000000002' order by created_at,id$$,'history has stable chronological order');
select throws_ok($$insert into public.task_events(task_id,event_type,content,actor_id) values ('a5000000-0000-4000-8000-000000000002','forged','forged','a1000000-0000-4000-8000-000000000001')$$,'42501',null::text,'client cannot forge events');
reset role;
insert into public.board_memberships(board_id,user_id,added_by) values
('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000005',true);
select throws_ok($$select public.list_task_history('a5000000-0000-4000-8000-000000000002')$$,
  '42501',null::text,'current common member cannot read populated private history');
select is((select count(*)::integer from public.task_events where task_id='a5000000-0000-4000-8000-000000000002'),0,
  'direct RLS also hides populated private history');
reset role;
update public.profiles set is_active=false where id='a1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.move_task_to_column('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001')$$,
  '42501',null::text,'inactive global administrator cannot move');
select throws_ok($$select public.list_task_history('a5000000-0000-4000-8000-000000000002')$$,
  '42501',null::text,'inactive global administrator cannot resolve history');
reset role;
select * from finish();
rollback;
