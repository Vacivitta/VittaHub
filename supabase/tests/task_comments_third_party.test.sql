-- Task 12: manual comments and third-party waiting workflow. Local only.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select relrowsecurity and relforcerowsecurity from pg_class
  where oid='public.task_comments'::regclass), 'comments have enabled and forced RLS');
select ok(has_table_privilege('authenticated','public.task_comments','SELECT'),
  'authenticated may read visible comments');
select ok(not has_table_privilege('authenticated','public.task_comments','INSERT'),
  'comments cannot be inserted directly');
select ok(not has_table_privilege('authenticated','public.task_comments','UPDATE'),
  'comments cannot be edited');
select ok(not has_table_privilege('authenticated','public.task_comments','DELETE'),
  'comments cannot be deleted');
select ok(not has_function_privilege('anon','public.add_task_comment(uuid,text)','EXECUTE'),
  'anon cannot comment');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""'])
  from pg_proc where oid in ('public.add_task_comment(uuid,text)'::regprocedure,
    'public.wait_task_for_third_party(uuid,text)'::regprocedure,
    'public.resume_task(uuid)'::regprocedure)),
  'comment and transition RPCs are SECURITY DEFINER with empty search_path');

insert into public.departments(id,name) values
 ('b2000000-0000-4000-8000-000000000001','Comment test department');
insert into auth.users(id,raw_user_meta_data) values
 ('b1000000-0000-4000-8000-000000000001','{}'),
 ('b1000000-0000-4000-8000-000000000002','{}'),
 ('b1000000-0000-4000-8000-000000000003','{}'),
 ('b1000000-0000-4000-8000-000000000004','{}'),
 ('b1000000-0000-4000-8000-000000000005','{}');
insert into public.profiles(id,department_id,display_name,role) values
 ('b1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','Criador comments','membro'),
 ('b1000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','Responsável comments','membro'),
 ('b1000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001','Participante comments','membro'),
 ('b1000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000001','Externo comments','membro'),
 ('b1000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000001','Admin comments','administrador');
insert into public.boards(id,title,department_id,created_by) values
 ('b3000000-0000-4000-8000-000000000001','Comment board','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001');
insert into public.board_memberships(board_id,user_id,added_by) values
 ('b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001'),
 ('b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000001');
insert into public.board_columns(id,board_id,title,position) values
 ('b4000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','Comment column',0);
insert into public.tasks(id,board_id,column_id,title,created_by,assignee_id,due_at,business_state,is_private) values
 ('b5000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','Doing task','b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',now(),'fazendo',false),
 ('b5000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','Waiting task','b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',now(),'aguardando_terceiro',false),
 ('b5000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','Ready task','b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',now(),'a_fazer',false),
 ('b5000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','Awaiting task','b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',now(),'aguardando_aceite',false),
 ('b5000000-0000-4000-8000-000000000005','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','Completed task','b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',now(),'concluido',false),
 ('b5000000-0000-4000-8000-000000000006','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','Private task','b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',now(),'a_fazer',true),
 ('b5000000-0000-4000-8000-000000000007','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','Blank attempt task','b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',now(),'fazendo',false);

set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000003',true);
select lives_ok($$select public.add_task_comment('b5000000-0000-4000-8000-000000000001','  Comentário manual  ')$$,
  'authorized task viewer adds a comment');
select is((select content from public.task_comments where task_id='b5000000-0000-4000-8000-000000000001'),
  'Comentário manual', 'comment content is trimmed');
select is((select author_id from public.task_comments where task_id='b5000000-0000-4000-8000-000000000001'),
  'b1000000-0000-4000-8000-000000000003'::uuid, 'comment author comes from authenticated identity');
select ok((select created_at=transaction_timestamp() from public.task_comments
  where task_id='b5000000-0000-4000-8000-000000000001'), 'comment timestamp comes from database');
select throws_ok($$select public.add_task_comment('b5000000-0000-4000-8000-000000000001','   ')$$,
  '22023', null::text, 'blank manual comment is rejected');
select is((select count(*)::integer from public.task_comments where task_id='b5000000-0000-4000-8000-000000000001'),
  1, 'invalid comment creates no record');
select throws_ok($$insert into public.task_comments(task_id,author_id,content)
  values('b5000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Forjado')$$,
  '42501', null::text, 'client cannot forge comment author');
select throws_ok($$delete from public.task_comments where task_id='b5000000-0000-4000-8000-000000000001'$$,
  '42501', null::text, 'comment DELETE is blocked');

select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.add_task_comment('b5000000-0000-4000-8000-000000000006','Comentário privado')$$,
  'private task creator comments');

select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000003',true);
select is((select count(*)::integer from public.task_comments where task_id='b5000000-0000-4000-8000-000000000006'),
  0, 'user without private task access cannot read its comments');
select throws_ok($$select public.add_task_comment('b5000000-0000-4000-8000-000000000006','Sem acesso')$$,
  '42501', null::text, 'user without private task access cannot comment');

select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000004',true);
select is((select count(*)::integer from public.task_comments), 0,
  'user without board access cannot enumerate comments');
select throws_ok($$select public.add_task_comment('b5000000-0000-4000-8000-000000000001','Sem quadro')$$,
  '42501', null::text, 'user without board access cannot comment');

select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.wait_task_for_third_party('b5000000-0000-4000-8000-000000000001','Fornecedor externo')$$,
  '42501', null::text, 'different participant cannot move task to awaiting third party');

select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.wait_task_for_third_party('b5000000-0000-4000-8000-000000000007','   ')$$,
  '22023', null::text, 'third-party explanation is mandatory');
select is((select business_state::text from public.tasks where id='b5000000-0000-4000-8000-000000000007'),
  'fazendo', 'blank explanation changes no state');
select is((select count(*)::integer from public.task_comments where task_id='b5000000-0000-4000-8000-000000000007'),
  0, 'blank explanation creates no comment');
select throws_ok($$select public.wait_task_for_third_party('b5000000-0000-4000-8000-000000000003','Dependência')$$,
  '42501', null::text, 'a_fazer cannot move to awaiting third party');
select throws_ok($$select public.wait_task_for_third_party('b5000000-0000-4000-8000-000000000004','Dependência')$$,
  '42501', null::text, 'awaiting acceptance cannot move to awaiting third party');
select throws_ok($$select public.wait_task_for_third_party('b5000000-0000-4000-8000-000000000005','Dependência')$$,
  '42501', null::text, 'completed task cannot move to awaiting third party');
select lives_ok($$select public.wait_task_for_third_party('b5000000-0000-4000-8000-000000000001','  Fornecedor X entregar confirmação  ')$$,
  'assignee moves doing task to awaiting third party');
select is((select business_state::text from public.tasks where id='b5000000-0000-4000-8000-000000000001'),
  'aguardando_terceiro', 'third-party transition updates state');
select is((select count(*)::integer from public.task_comments
  where task_id='b5000000-0000-4000-8000-000000000001' and content='Fornecedor X entregar confirmação'),
  1, 'transition stores required explanation as a comment');
select is((select count(*)::integer from public.task_comments
  where task_id='b5000000-0000-4000-8000-000000000001' and content='Comentário manual'),
  1, 'transition preserves previous comments');
select is((select count(*)::integer from public.task_events
  where task_id='b5000000-0000-4000-8000-000000000001' and event_type='waiting_third_party'),
  1, 'third-party transition creates system history');
select is((select column_id from public.tasks where id='b5000000-0000-4000-8000-000000000001'),
  'b4000000-0000-4000-8000-000000000001'::uuid, 'third-party transition does not move Kanban column');

select lives_ok($$select public.resume_task('b5000000-0000-4000-8000-000000000002')$$,
  'assignee resumes task from awaiting third party');
select is((select business_state::text from public.tasks where id='b5000000-0000-4000-8000-000000000002'),
  'fazendo', 'resume changes state back to fazendo');
select is((select count(*)::integer from public.task_events
  where task_id='b5000000-0000-4000-8000-000000000002' and event_type='resumed'),
  1, 'resume creates system history');
select is((select column_id from public.tasks where id='b5000000-0000-4000-8000-000000000002'),
  'b4000000-0000-4000-8000-000000000001'::uuid, 'resume does not move Kanban column');

reset role;
select * from finish();
rollback;
