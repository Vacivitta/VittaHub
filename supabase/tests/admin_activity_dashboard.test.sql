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

update public.tasks set business_state='concluido'
where id in ('a5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002');
insert into public.tasks(id,board_id,column_id,title,created_by,assignee_id,due_at,business_state,is_private) values
('a5000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000003','Private B','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','2030-01-01','concluido',true),
('a5000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','In progress','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000005','2030-01-01','aguardando_terceiro',false);
insert into public.board_memberships(board_id,user_id,added_by) values ('a3000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003'),('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002');
insert into public.task_events(task_id,event_type,content,actor_id,created_at) values
('a5000000-0000-4000-8000-000000000001','accepted','Accepted','a1000000-0000-4000-8000-000000000004','2026-10-01 19:00Z'),
('a5000000-0000-4000-8000-000000000001','started','Started','a1000000-0000-4000-8000-000000000004','2026-10-01 20:00Z'),
('a5000000-0000-4000-8000-000000000001','column_moved','Moved','a1000000-0000-4000-8000-000000000005','2026-10-02 02:00Z'),
('a5000000-0000-4000-8000-000000000001','waiting_third_party','Waiting','a1000000-0000-4000-8000-000000000004','2026-10-02 03:00Z'),
('a5000000-0000-4000-8000-000000000001','resumed','Resumed','a1000000-0000-4000-8000-000000000004','2026-10-02 03:30Z'),
('a5000000-0000-4000-8000-000000000001','completed','Completed','a1000000-0000-4000-8000-000000000004','2026-10-02 04:00Z'),
('a5000000-0000-4000-8000-000000000002','completed','No start','a1000000-0000-4000-8000-000000000004','2026-10-02 05:00Z'),
('a5000000-0000-4000-8000-000000000003','started','Secret start','a1000000-0000-4000-8000-000000000003','2026-10-02 01:00Z'),
('a5000000-0000-4000-8000-000000000003','completed','Secret completion','a1000000-0000-4000-8000-000000000003','2026-10-02 06:00Z');
select ok(not has_function_privilege('anon','public.get_admin_activity(timestamptz,timestamptz,uuid,uuid)','EXECUTE'),'anon denied execute');
select ok(not exists(select 1 from pg_proc p,lateral aclexplode(p.proacl) a where p.oid='public.get_admin_activity(timestamptz,timestamptz,uuid,uuid)'::regprocedure and a.grantee=0),'no PUBLIC grant');
select ok(p.prosecdef and p.proconfig @> array['search_path=""'] and p.provolatile='s' and pg_get_userbyid(p.proowner)='postgres','secured read-only definer') from pg_proc p where p.oid='public.get_admin_activity(timestamptz,timestamptz,uuid,uuid)'::regprocedure;
set local role anon;
select throws_ok($$select public.get_admin_activity('2026-10-02','2026-10-03',null,null)$$,'42501',null::text,'anonymous rejected');
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.get_admin_activity('2026-10-02','2026-10-03',null,null)$$,'42501',null::text,'reject caller 0');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000099',true);
select set_config('request.jwt.claims',jsonb_build_object('session_id','a1000000-0000-4000-8000-000000000099')::text,true);
select throws_ok($$select public.get_admin_activity('2026-10-02','2026-10-03',null,null)$$,'42501',null::text,'reject caller 99');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims',jsonb_build_object('session_id','a1000000-0000-4000-8000-000000000004')::text,true);
select throws_ok($$select public.get_admin_activity('2026-10-02','2026-10-03',null,null)$$,'42501',null::text,'reject caller 4');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('session_id','a1000000-0000-4000-8000-000000000002')::text,true);
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,null)->>'completed')::numeric,2::numeric,'manager A counts only managed tasks including authorized private');
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,null)->>'in_progress')::numeric,1::numeric,'current in progress includes third party waiting');
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,null)->>'average_seconds')::numeric,28800::numeric,'duration uses start before period and includes waiting');
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,null)->>'duration_samples')::numeric,1::numeric,'missing start excluded from average');
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,null)->>'total_events')::numeric,5::numeric,'scope excludes other manager even with common participation');
select is(jsonb_array_length(public.get_admin_activity('2026-10-02','2026-10-03',null,null)->'boards'),1,'board options scoped');
select ok(not (public.get_admin_activity('2026-10-02','2026-10-03',null,null)->'people' @> '[{"id":"a1000000-0000-4000-8000-000000000003"}]'::jsonb),'people options do not disclose other board actor');
select is((select e->>'elapsed_seconds' from jsonb_array_elements(public.get_admin_activity('2026-10-02','2026-10-03',null,null)->'events') e where e->>'task_id'='a5000000-0000-4000-8000-000000000002'),null::text,'missing start duration is null');
select is((select e->>'actor_name' from jsonb_array_elements(public.get_admin_activity('2026-10-02','2026-10-03',null,null)->'events') e where e->>'event_type'='column_moved'),'Observador','event identifies actual actor');
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,'a3000000-0000-4000-8000-000000000002')->>'total_events')::numeric,0::numeric,'board filter cannot expand scope');
select is((public.get_admin_activity('2026-10-02','2026-10-03','a1000000-0000-4000-8000-000000000003',null)->>'total_events')::numeric,0::numeric,'actor filter cannot expand scope');
select is((public.get_admin_activity('2026-10-02','2026-10-03','a1000000-0000-4000-8000-000000000005',null)->>'total_events')::numeric,1::numeric,'actor filter applies to event actor');
select is((public.get_admin_activity('2026-10-02','2026-10-03','a1000000-0000-4000-8000-000000000005',null)->>'in_progress')::numeric,1::numeric,'current indicator filters assignee');
select is((public.get_admin_activity('2026-10-02','2026-10-03','a1000000-0000-4000-8000-000000000005',null)->>'completed')::numeric,0::numeric,'actor with only movement has zero completions');
select is((public.get_admin_activity('2026-10-02 04:00Z','2026-10-02 05:00Z',null,null)->>'total_events')::numeric,1::numeric,'period is inclusive start exclusive end');
select throws_ok($$select public.get_admin_activity('2026-10-03','2026-10-02',null,null)$$,'22023',null::text,'invalid period rejected');
select throws_ok($$select public.get_admin_activity('-infinity','infinity',null,null)$$,'22023',null::text,'infinite period rejected');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims',jsonb_build_object('session_id','a1000000-0000-4000-8000-000000000003')::text,true);
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,null)->>'completed')::numeric,1::numeric,'manager B isolated from A private tasks');
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,null)->>'total_events')::numeric,2::numeric,'manager B isolated from A shared tasks too');
select ok(not (public.get_admin_activity('2026-10-02','2026-10-03',null,null)::text like '%No start%'),'private activity description not leaked');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('session_id','a1000000-0000-4000-8000-000000000001')::text,true);
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,'a3000000-0000-4000-8000-000000000002')->>'completed')::numeric,1::numeric,'active global admin sees board B without membership');
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,'a3000000-0000-4000-8000-000000000001')->>'in_progress')::numeric,1::numeric,'global in-progress count for board A without membership');
reset role;
-- External fixture administrator, not the simulated employee.
select set_config('test.saved_actor',current_setting('request.jwt.claim.sub',true),true);
select set_config('request.jwt.claim.sub','',true);
update public.profiles set is_active=false where id='a1000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub',current_setting('test.saved_actor'),true);
set local role authenticated;
select throws_ok($$select public.get_admin_activity('2026-10-02','2026-10-03',null,null)$$,'42501',null::text,'inactive global administrator rejected');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('session_id','a1000000-0000-4000-8000-000000000002')::text,true);
select set_config('request.jwt.claims','{"user_metadata":{"role":"administrador"}}',true);
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,null)->>'completed')::numeric,2::numeric,'forged role metadata does not broaden scope');
reset role;
update public.board_memberships set is_board_admin=false where user_id='a1000000-0000-4000-8000-000000000002' and board_id='a3000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((public.get_admin_activity('2026-10-02','2026-10-03',null,null)->>'completed')::numeric,0::numeric,'revocation reflected next call');
select is(jsonb_array_length(public.get_admin_activity('2026-10-02','2026-10-03',null,null)->'people'),0,'revocation clears people options too');
reset role;
-- External fixture administrator, not the simulated employee.
select set_config('test.saved_actor',current_setting('request.jwt.claim.sub',true),true);
select set_config('request.jwt.claim.sub','',true);
update public.profiles set is_active=false where id='a1000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub',current_setting('test.saved_actor'),true);
set local role authenticated;
select throws_ok($$select public.get_admin_activity('2026-10-02','2026-10-03',null,null)$$,'42501',null::text,'inactive manager rejected');
reset role;
select * from finish();
rollback;
