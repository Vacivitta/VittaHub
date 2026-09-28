-- Task 11: essential assignee workflow and immutable history. Local only.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select attnotnull = false from pg_attribute
  where attrelid='public.tasks'::regclass and attname='accepted_at'),
  'tasks has nullable accepted_at');
select ok((select attnotnull = false from pg_attribute
  where attrelid='public.tasks'::regclass and attname='completed_at'),
  'tasks has nullable completed_at');
select ok((select relrowsecurity and relforcerowsecurity from pg_class
  where oid='public.task_events'::regclass), 'task history has enabled and forced RLS');
select ok(has_table_privilege('authenticated','public.task_events','SELECT'),
  'authenticated may read visible history');
select ok(not has_table_privilege('authenticated','public.task_events','INSERT'),
  'authenticated cannot insert history directly');
select ok(not has_table_privilege('authenticated','public.task_events','UPDATE'),
  'authenticated cannot update history');
select ok(not has_table_privilege('authenticated','public.task_events','DELETE'),
  'authenticated cannot delete history');
select ok(not has_table_privilege('authenticated','public.tasks','UPDATE'),
  'generic task UPDATE remains unavailable');
select ok(not has_table_privilege('authenticated','public.tasks','DELETE'),
  'task DELETE remains unavailable');
select ok(not has_function_privilege('anon','public.accept_task(uuid)','EXECUTE'),
  'anon cannot accept tasks');
select ok(has_function_privilege('authenticated','public.accept_task(uuid)','EXECUTE'),
  'authenticated may call controlled acceptance');
select ok(has_function_privilege('authenticated','public.start_task(uuid)','EXECUTE'),
  'authenticated may call controlled start');
select ok(has_function_privilege('authenticated','public.complete_task(uuid)','EXECUTE'),
  'authenticated may call controlled completion');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""'])
  from pg_proc where oid in ('public.accept_task(uuid)'::regprocedure,
    'public.start_task(uuid)'::regprocedure, 'public.complete_task(uuid)'::regprocedure)),
  'workflow RPCs are SECURITY DEFINER with empty search_path');

insert into public.departments(id,name) values
 ('a2000000-0000-4000-8000-000000000001','Workflow department');
insert into auth.users(id,raw_user_meta_data) values
 ('a1000000-0000-4000-8000-000000000001','{}'),
 ('a1000000-0000-4000-8000-000000000002','{}'),
 ('a1000000-0000-4000-8000-000000000003','{}'),
 ('a1000000-0000-4000-8000-000000000004','{}');
insert into public.profiles(id,department_id,display_name,role) values
 ('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Criador workflow','membro'),
 ('a1000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','Responsável workflow','membro'),
 ('a1000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000001','Outro participante','membro'),
 ('a1000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000001','Admin global workflow','administrador');
insert into public.boards(id,title,department_id,created_by) values
 ('a3000000-0000-4000-8000-000000000001','Workflow board','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001');
insert into public.board_memberships(board_id,user_id,added_by) values
 ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001'),
 ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001');
insert into public.board_columns(id,board_id,title,position) values
 ('a4000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','Workflow column',0);
insert into public.tasks(id,board_id,column_id,title,created_by,assignee_id,due_at,business_state,is_private) values
 ('a5000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','Awaiting acceptance','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',now(),'aguardando_aceite',false),
 ('a5000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','Ready to start','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',now(),'a_fazer',false),
 ('a5000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','In progress','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',now(),'fazendo',true),
 ('a5000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','Already complete','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',now(),'concluido',false),
 ('a5000000-0000-4000-8000-000000000005','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','Awaiting skip attempt','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',now(),'aguardando_aceite',false),
 ('a5000000-0000-4000-8000-000000000006','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','Ready skip attempt','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',now(),'a_fazer',false);

set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.accept_task('a5000000-0000-4000-8000-000000000001')$$,
  '42501', null::text, 'another participant cannot accept the task');
select throws_ok($$select public.start_task('a5000000-0000-4000-8000-000000000006')$$,
  '42501', null::text, 'unauthorized participant cannot start the task');

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.complete_task('a5000000-0000-4000-8000-000000000003')$$,
  '42501', null::text, 'board administrator cannot complete without being assignee');

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.complete_task('a5000000-0000-4000-8000-000000000003')$$,
  '42501', null::text, 'global administrator gets no invented completion permission');

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.accept_task('a5000000-0000-4000-8000-000000000001')$$,
  'assignee accepts an awaiting task');
select is((select business_state::text from public.tasks where id='a5000000-0000-4000-8000-000000000001'),
  'a_fazer', 'acceptance changes state to a_fazer');
select ok((select accepted_at is not null from public.tasks where id='a5000000-0000-4000-8000-000000000001'),
  'acceptance timestamp comes from database');
select is((select count(*)::integer from public.task_events
  where task_id='a5000000-0000-4000-8000-000000000001' and event_type='accepted'),
  1, 'acceptance creates one history event');
select is((select actor_id from public.task_events
  where task_id='a5000000-0000-4000-8000-000000000001'),
  'a1000000-0000-4000-8000-000000000002'::uuid, 'history actor comes from auth identity');
select ok((select is_system from public.task_events
  where task_id='a5000000-0000-4000-8000-000000000001'), 'acceptance event is a system event');
select throws_ok($$select public.accept_task('a5000000-0000-4000-8000-000000000001')$$,
  '42501', null::text, 'duplicate acceptance is rejected');
select throws_ok($$select public.accept_task('a5000000-0000-4000-8000-000000000002')$$,
  '42501', null::text, 'task in incorrect state cannot be accepted');

select lives_ok($$select public.start_task('a5000000-0000-4000-8000-000000000002')$$,
  'assignee starts an a_fazer task');
select is((select business_state::text from public.tasks where id='a5000000-0000-4000-8000-000000000002'),
  'fazendo', 'start changes state to fazendo');
select is((select count(*)::integer from public.task_events
  where task_id='a5000000-0000-4000-8000-000000000002' and event_type='started'),
  1, 'start creates history');
select throws_ok($$select public.start_task('a5000000-0000-4000-8000-000000000005')$$,
  '42501', null::text, 'awaiting acceptance cannot skip to fazendo');
select throws_ok($$select public.start_task('a5000000-0000-4000-8000-000000000004')$$,
  '42501', null::text, 'completed task cannot return to fazendo');

select lives_ok($$select public.complete_task('a5000000-0000-4000-8000-000000000003')$$,
  'assignee completes an in-progress task');
select is((select business_state::text from public.tasks where id='a5000000-0000-4000-8000-000000000003'),
  'concluido', 'completion changes state to concluido');
select ok((select completed_at is not null from public.tasks where id='a5000000-0000-4000-8000-000000000003'),
  'completion timestamp comes from database');
select is((select count(*)::integer from public.task_events
  where task_id='a5000000-0000-4000-8000-000000000003' and event_type='completed'),
  1, 'completion creates history');
select throws_ok($$select public.complete_task('a5000000-0000-4000-8000-000000000003')$$,
  '42501', null::text, 'duplicate completion is rejected');
select throws_ok($$select public.complete_task('a5000000-0000-4000-8000-000000000006')$$,
  '42501', null::text, 'a_fazer cannot skip to concluido');
select throws_ok($$select public.complete_task('a5000000-0000-4000-8000-000000000005')$$,
  '42501', null::text, 'awaiting acceptance cannot skip to concluido');
select is((select column_id from public.tasks where id='a5000000-0000-4000-8000-000000000003'),
  'a4000000-0000-4000-8000-000000000001'::uuid, 'state transition does not move Kanban column');
select throws_ok($$delete from public.tasks where id='a5000000-0000-4000-8000-000000000003'$$,
  '42501', null::text, 'task DELETE remains blocked');
select throws_ok($$delete from public.task_events where task_id='a5000000-0000-4000-8000-000000000003'$$,
  '42501', null::text, 'history DELETE is blocked');
select throws_ok($$insert into public.task_events(task_id,event_type,content,actor_id)
  values('a5000000-0000-4000-8000-000000000001','forged','Forjado','a1000000-0000-4000-8000-000000000003')$$,
  '42501', null::text, 'history actor and event cannot be forged directly');

reset role;
select * from finish();
rollback;
