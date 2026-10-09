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
select ok(not has_function_privilege('anon','public.can_manage_board_columns(uuid)','EXECUTE'),'anonymous has no capability RPC');
select ok(not has_function_privilege('authenticated','vittahub_private.can_manage_board_columns(uuid)','EXECUTE'),'helper stays private');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims',jsonb_build_object('session_id','a1000000-0000-4000-8000-000000000004')::text,true);
select is(public.can_manage_board_columns('a3000000-0000-4000-8000-000000000001'),true,'active local member admin can manage columns');
select is(public.can_manage_board_structure('a3000000-0000-4000-8000-000000000001'),false,'member cannot manage board structure');
select lives_ok($$select public.create_board_column('a3000000-0000-4000-8000-000000000001','Local column')$$,'member admin creates column');
select lives_ok($$select public.rename_board_column('a4000000-0000-4000-8000-000000000002','Renamed')$$,'member admin renames column');
select throws_ok($$select public.delete_board_column('a4000000-0000-4000-8000-000000000001')$$,'23503',null::text,'column with tasks cannot be deleted');
select lives_ok($$select public.delete_board_column('a4000000-0000-4000-8000-000000000002')$$,'member admin deletes empty column');
select throws_ok($$select public.update_board('a3000000-0000-4000-8000-000000000001','Forbidden')$$,'42501',null::text,'member admin cannot edit board');
select throws_ok($$select public.delete_board('a3000000-0000-4000-8000-000000000001')$$,'42501',null::text,'member admin cannot delete board');
select throws_ok($$update public.boards set title='Forbidden' where id='a3000000-0000-4000-8000-000000000001'$$,'42501',null::text,'direct board update stays blocked');
select throws_ok($$select public.list_admin_team_members()$$,'42501',null::text,'member admin has no Administration access');
select throws_ok($$select public.list_admin_board_members('a3000000-0000-4000-8000-000000000001')$$,'42501',null::text,'member admin cannot use Administration participant API');
select is(public.can_manage_board_columns('a3000000-0000-4000-8000-000000000002'),false,'no capability on other board');
select throws_ok($$select public.create_board_column('a3000000-0000-4000-8000-000000000002','Forbidden')$$,'42501',null::text,'cannot create in another board');
select throws_ok($$select public.rename_board_column('a4000000-0000-4000-8000-000000000003','Forbidden')$$,'42501',null::text,'cannot rename in another board');
select throws_ok($$select public.delete_board_column('a4000000-0000-4000-8000-000000000003')$$,'42501',null::text,'cannot delete in another board');
reset role;
-- External fixture administrator, not the simulated employee.
select set_config('test.saved_actor',current_setting('request.jwt.claim.sub',true),true);
select set_config('request.jwt.claim.sub','',true);
update public.profiles set is_active=false where id='a1000000-0000-4000-8000-000000000004';
select set_config('request.jwt.claim.sub',current_setting('test.saved_actor'),true);
set local role authenticated;
select throws_ok($$select public.can_manage_board_columns('a3000000-0000-4000-8000-000000000001')$$,'42501',null::text,'inactive local admin has no capability');
select throws_ok($$select public.create_board_column('a3000000-0000-4000-8000-000000000001','Forbidden')$$,'42501',null::text,'inactive cannot create');
select throws_ok($$select public.rename_board_column('a4000000-0000-4000-8000-000000000001','Forbidden')$$,'42501',null::text,'inactive cannot rename');
select throws_ok($$select public.delete_board_column('a4000000-0000-4000-8000-000000000001')$$,'42501',null::text,'inactive cannot delete');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claims',jsonb_build_object('session_id','a1000000-0000-4000-8000-000000000005')::text,true);
select is(public.can_manage_board_columns('a3000000-0000-4000-8000-000000000001'),false,'common participant cannot manage columns');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('session_id','a1000000-0000-4000-8000-000000000002')::text,true);
select is(public.can_manage_board_columns('a3000000-0000-4000-8000-000000000001'),true,'manager retains column capability');
select lives_ok($$select public.update_board('a3000000-0000-4000-8000-000000000001','Manager title')$$,'manager retains board edit');
select lives_ok($$select public.create_board_column('a3000000-0000-4000-8000-000000000001','Manager column')$$,'manager retains column creation');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('session_id','a1000000-0000-4000-8000-000000000001')::text,true);
select is(public.can_manage_board_columns('a3000000-0000-4000-8000-000000000002'),true,'global administrator retains cross-board capability');
select lives_ok($$select public.rename_board_column('a4000000-0000-4000-8000-000000000003','Admin column')$$,'global administrator retains column rename');
select lives_ok($$select public.delete_board_column('a4000000-0000-4000-8000-000000000003')$$,'global administrator retains column deletion');
select lives_ok($$select public.delete_board('a3000000-0000-4000-8000-000000000002')$$,'global administrator retains board deletion');
reset role;
-- External fixture administrator, not the simulated employee.
select set_config('test.saved_actor',current_setting('request.jwt.claim.sub',true),true);
select set_config('request.jwt.claim.sub','',true);
update public.profiles set is_active=false where id in ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub',current_setting('test.saved_actor'),true);
set local role authenticated;
select throws_ok($$select public.can_manage_board_columns('a3000000-0000-4000-8000-000000000001')$$,'42501',null::text,'inactive global administrator has no column capability');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('session_id','a1000000-0000-4000-8000-000000000002')::text,true);
select throws_ok($$select public.can_manage_board_columns('a3000000-0000-4000-8000-000000000001')$$,'42501',null::text,'inactive manager has no column capability');
select * from finish();
rollback;
