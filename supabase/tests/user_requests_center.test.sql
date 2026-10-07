begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.departments(id,name) values('24b00000-0000-4000-8000-000000000100','24B fictitious');
insert into auth.users(id,raw_user_meta_data) values ('24b00000-0000-4000-8000-000000000001','{}'),('24b00000-0000-4000-8000-000000000002','{}'),('24b00000-0000-4000-8000-000000000003','{}'),('24b00000-0000-4000-8000-000000000004','{}'),('24b00000-0000-4000-8000-000000000005','{}'),('24b00000-0000-4000-8000-000000000006','{}'),('24b00000-0000-4000-8000-000000000007','{}'),('24b00000-0000-4000-8000-000000000008','{}');
insert into public.profiles(id,department_id,display_name,role,is_active) values ('24b00000-0000-4000-8000-000000000001','24b00000-0000-4000-8000-000000000100','Pessoa central 1','membro',true),('24b00000-0000-4000-8000-000000000002','24b00000-0000-4000-8000-000000000100','Pessoa central 2','membro',true),('24b00000-0000-4000-8000-000000000003','24b00000-0000-4000-8000-000000000100','Pessoa central 3','membro',true),('24b00000-0000-4000-8000-000000000004','24b00000-0000-4000-8000-000000000100','Pessoa central 4','administrador',true),('24b00000-0000-4000-8000-000000000005','24b00000-0000-4000-8000-000000000100','Pessoa central 5','gestor',true),('24b00000-0000-4000-8000-000000000006','24b00000-0000-4000-8000-000000000100','Pessoa central 6','membro',true),('24b00000-0000-4000-8000-000000000007','24b00000-0000-4000-8000-000000000100','Pessoa central 7','membro',false),('24b00000-0000-4000-8000-000000000008','24b00000-0000-4000-8000-000000000100','Pessoa central 8','membro',true);
insert into public.boards(id,title,department_id,created_by) values
('24b00000-0000-4000-8000-000000000101','Quadro A','24b00000-0000-4000-8000-000000000100','24b00000-0000-4000-8000-000000000003'),('24b00000-0000-4000-8000-000000000102','Quadro B','24b00000-0000-4000-8000-000000000100','24b00000-0000-4000-8000-000000000008');
insert into public.board_memberships(board_id,user_id,added_by) values ('24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000001','24b00000-0000-4000-8000-000000000003'),('24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000002','24b00000-0000-4000-8000-000000000003'),('24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000005','24b00000-0000-4000-8000-000000000003'),('24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000006','24b00000-0000-4000-8000-000000000003'),('24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000007','24b00000-0000-4000-8000-000000000003');
insert into public.board_columns(id,board_id,title,position) values
('24b00000-0000-4000-8000-000000000201','24b00000-0000-4000-8000-000000000101','Entrada',0),('24b00000-0000-4000-8000-000000000202','24b00000-0000-4000-8000-000000000102','Entrada',0);
insert into public.tasks(id,board_id,column_id,title,created_by,assignee_id,due_at,business_state,is_private,awaiting_reassignment,refused_assignee_id) values
('24b00000-0000-4000-8000-000000000301','24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000201','Pendência 301','24b00000-0000-4000-8000-000000000001','24b00000-0000-4000-8000-000000000002','2030-01-01Z','aguardando_aceite',false,false,null),('24b00000-0000-4000-8000-000000000302','24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000201','Pendência 302','24b00000-0000-4000-8000-000000000001',null,'2030-01-01Z','aguardando_aceite',true,true,'24b00000-0000-4000-8000-000000000002'),('24b00000-0000-4000-8000-000000000303','24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000201','Pendência 303','24b00000-0000-4000-8000-000000000001','24b00000-0000-4000-8000-000000000002','2030-01-01Z','fazendo',true,false,null),('24b00000-0000-4000-8000-000000000304','24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000201','Pendência 304','24b00000-0000-4000-8000-000000000001','24b00000-0000-4000-8000-000000000001','2030-01-01Z','a_fazer',false,false,null),('24b00000-0000-4000-8000-000000000305','24b00000-0000-4000-8000-000000000102','24b00000-0000-4000-8000-000000000202','Pendência 305','24b00000-0000-4000-8000-000000000008','24b00000-0000-4000-8000-000000000008','2030-01-01Z','a_fazer',true,false,null),('24b00000-0000-4000-8000-000000000306','24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000201','Pendência 306','24b00000-0000-4000-8000-000000000006','24b00000-0000-4000-8000-000000000006','2030-01-01Z','aguardando_terceiro',false,false,null);
insert into public.task_events(task_id,event_type,content,actor_id,details) values('24b00000-0000-4000-8000-000000000302','assignment_refused','Recusa teste','24b00000-0000-4000-8000-000000000002','{"justification":"Sem disponibilidade"}');
insert into public.task_postponement_requests(id,task_id,requested_by,previous_due_at,requested_due_at,justification) values ('24b00000-0000-4000-8000-000000000403','24b00000-0000-4000-8000-000000000303','24b00000-0000-4000-8000-000000000002','2030-01-01Z','2030-02-01Z','Motivo 303'),('24b00000-0000-4000-8000-000000000404','24b00000-0000-4000-8000-000000000304','24b00000-0000-4000-8000-000000000001','2030-01-01Z','2030-02-01Z','Motivo 304'),('24b00000-0000-4000-8000-000000000405','24b00000-0000-4000-8000-000000000305','24b00000-0000-4000-8000-000000000008','2030-01-01Z','2030-02-01Z','Motivo 305'),('24b00000-0000-4000-8000-000000000406','24b00000-0000-4000-8000-000000000306','24b00000-0000-4000-8000-000000000006','2030-01-01Z','2030-02-01Z','Motivo 306');
select ok(not has_function_privilege('anon','public.list_my_requests()','EXECUTE'),'anonymous cannot call central');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.list_my_requests()'::regprocedure),'bounded definer has fixed search path');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.list_my_requests() where area='decide'),2::bigint,'creator decides reassignment and other requester postponement');
select is((select count(*) from public.list_my_requests() where area='waiting'),2::bigint,'creator awaits other assignee acceptance and own postponement');
select ok(exists(select 1 from public.list_my_requests() where item_key='reassignment-24b00000-0000-4000-8000-000000000302' and area='decide'),'refusal requires reassignment');
select ok(exists(select 1 from public.list_my_requests() where item_key='postponement-24b00000-0000-4000-8000-000000000403' and area='decide'),'creator can decide postponement');
select ok(exists(select 1 from public.list_my_requests() where item_key='acceptance-24b00000-0000-4000-8000-000000000301' and area='waiting'),'creator waits for acceptance');
select ok(exists(select 1 from public.list_my_requests() where item_key='postponement-24b00000-0000-4000-8000-000000000404' and area='waiting'),'creator never decides own request');
select ok(exists(select 1 from public.list_my_requests() where kind='reassignment' and justification='Sem disponibilidade' and refused_assignee_name='Pessoa central 2'),'refusal reason and involved person included');
select ok(exists(select 1 from public.list_my_requests() where kind='postponement' and requester_name='Pessoa central 2' and creator_name='Pessoa central 1' and (task->>'due_at')::timestamptz='2030-01-01Z' and (request->>'requested_due_at')::timestamptz='2030-02-01Z'),'useful authorized names and deadlines');
select ok(not exists(select 1 from public.list_my_requests() where task->>'id' in ('24b00000-0000-4000-8000-000000000305','24b00000-0000-4000-8000-000000000306')),'unrelated decisions and other board excluded');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.list_my_requests() where area='decide'),1::bigint,'assignee has one acceptance');
select is((select count(*) from public.list_my_requests() where area='waiting'),1::bigint,'assignee awaits own postponement');
select ok(exists(select 1 from public.list_my_requests() where item_key='acceptance-24b00000-0000-4000-8000-000000000301' and area='decide'),'assignee acceptance');
select ok(not exists(select 1 from public.list_my_requests() where task->>'id'='24b00000-0000-4000-8000-000000000302'),'refuser loses private refused-task access');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.list_my_requests() where area='decide'),4::bigint,'member local administrator has authority in board only');
select is((select count(*) from public.list_my_requests() where area='waiting'),0::bigint,'local administrator does not wait for unrelated acceptance');
select ok(not exists(select 1 from public.list_my_requests() where task->>'id'='24b00000-0000-4000-8000-000000000305'),'local administration cannot cross boards');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000004',true);
-- Global admins also see pre-existing local data, including pending postponements
-- on completed tasks. Assert the exact fixture items, not a database-wide count.
select results_eq(
  $$select item_key from public.list_my_requests() where area='decide'
    and task->>'board_id' in ('24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000102')
    order by item_key$$,
  $$values ('postponement-24b00000-0000-4000-8000-000000000403'),
    ('postponement-24b00000-0000-4000-8000-000000000404'),
    ('postponement-24b00000-0000-4000-8000-000000000405'),
    ('postponement-24b00000-0000-4000-8000-000000000406'),
    ('reassignment-24b00000-0000-4000-8000-000000000302')$$,
  'global administration across boards without membership');
select is((select count(*) from public.list_my_requests() where area='waiting'
  and task->>'board_id' in ('24b00000-0000-4000-8000-000000000101','24b00000-0000-4000-8000-000000000102')),
  0::bigint,'global admin does not await others requests');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000005',true);
select is((select count(*) from public.list_my_requests() ),0::bigint,'ordinary manager receives no decision authority');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000006',true);
select is((select count(*) from public.list_my_requests() where area='decide'),0::bigint,'ordinary creator cannot approve own request');
select is((select count(*) from public.list_my_requests() where area='waiting'),1::bigint,'own request returned');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000008',true);
select is((select count(*) from public.list_my_requests() where area='decide'),0::bigint,'second board admin does not access first board');
select is((select count(*) from public.list_my_requests() where area='waiting'),1::bigint,'second board requester awaits response');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000007',true);
select throws_ok($$select * from public.list_my_requests()$$,'42501',null::text,'inactive user receives no data');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select * from public.list_my_requests()$$,'42501',null::text,'missing identity receives no data');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.accept_task('24b00000-0000-4000-8000-000000000301')$$,'accept using existing RPC');
select is((select count(*) from public.list_my_requests() where area='decide'),0::bigint,'accepted item removed from decision count');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.list_my_requests() where area='waiting'),1::bigint,'accepted item removed from creator waiting');
select lives_ok($$select public.decide_task_postponement('24b00000-0000-4000-8000-000000000303','24b00000-0000-4000-8000-000000000403',true,null)$$,'approve using 24A');
select ok(not exists(select 1 from public.list_my_requests() where item_key='postponement-24b00000-0000-4000-8000-000000000403'),'approved request removed');
select lives_ok($$select public.reassign_refused_task('24b00000-0000-4000-8000-000000000302','24b00000-0000-4000-8000-000000000002')$$,'reassign using 24A');
select ok(not exists(select 1 from public.list_my_requests() where item_key='reassignment-24b00000-0000-4000-8000-000000000302'),'resolved reassignment removed');
select ok(exists(select 1 from public.list_my_requests() where item_key='acceptance-24b00000-0000-4000-8000-000000000302' and area='waiting'),'reassignment to another now awaits return');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000002',true);
select ok(exists(select 1 from public.list_my_requests() where item_key='acceptance-24b00000-0000-4000-8000-000000000302' and area='decide'),'new assignee receives acceptance');
select lives_ok($$select public.refuse_task_assignment('24b00000-0000-4000-8000-000000000302','Ainda indisponível')$$,'refuse using 24A');
select ok(not exists(select 1 from public.list_my_requests() where item_key='acceptance-24b00000-0000-4000-8000-000000000302'),'refusal removes acceptance');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000001',true);
select ok(exists(select 1 from public.list_my_requests() where item_key='reassignment-24b00000-0000-4000-8000-000000000302' and area='decide'),'refusal creates actionable reassignment');
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000003',true);
select lives_ok($$select public.decide_task_postponement('24b00000-0000-4000-8000-000000000304','24b00000-0000-4000-8000-000000000404',false,'Manter prazo')$$,'reject using 24A');
select ok(not exists(select 1 from public.list_my_requests() where item_key='postponement-24b00000-0000-4000-8000-000000000404'),'rejected request removed');
select lives_ok($$select public.reassign_refused_task('24b00000-0000-4000-8000-000000000302','24b00000-0000-4000-8000-000000000002')$$,
  'local admin reassigns another creator task');
reset role;
update public.task_events set created_at=statement_timestamp()
  where task_id='24b00000-0000-4000-8000-000000000302' and event_type='assignment_reassigned'
    and actor_id='24b00000-0000-4000-8000-000000000003';
set local role authenticated;
select ok(exists(select 1 from public.list_my_requests() where item_key='acceptance-24b00000-0000-4000-8000-000000000302' and area='waiting'),
  'last assigning local admin awaits acceptance even when not creator');
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.refuse_task_assignment('24b00000-0000-4000-8000-000000000302','Outra recusa')$$,'assignee refuses local assignment');
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000004',true);
select lives_ok($$select public.reassign_refused_task('24b00000-0000-4000-8000-000000000302','24b00000-0000-4000-8000-000000000002')$$,
  'global admin reassigns another creator task');
-- Fixture actions share a transaction timestamp; order this last audit event explicitly.
reset role;
update public.task_events set created_at=statement_timestamp() + interval '1 second'
  where task_id='24b00000-0000-4000-8000-000000000302' and event_type='assignment_reassigned'
    and actor_id='24b00000-0000-4000-8000-000000000004';
set local role authenticated;
select ok(exists(select 1 from public.list_my_requests() where item_key='acceptance-24b00000-0000-4000-8000-000000000302' and area='waiting'),
  'last assigning global admin awaits acceptance without membership');
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000003',true);
select ok(not exists(select 1 from public.list_my_requests() where item_key='acceptance-24b00000-0000-4000-8000-000000000302'),
  'superseded assigner does not await acceptance of someone else assignment');
reset role;
delete from public.board_memberships where board_id='24b00000-0000-4000-8000-000000000101' and user_id='24b00000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.list_my_requests() ),0::bigint,'removed creator loses all board items');
reset role;
update public.profiles set is_active=false where id='24b00000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','24b00000-0000-4000-8000-000000000004',true);
select throws_ok($$select * from public.list_my_requests()$$,'42501',null::text,'inactive global admin denied');
reset role;
select * from finish();
rollback;
