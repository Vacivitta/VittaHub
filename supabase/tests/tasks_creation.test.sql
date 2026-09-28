-- Task 09: controlled creation and bounded assignee lookup. Local only.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select attnotnull and atthasdef from pg_attribute
  where attrelid='public.profiles'::regclass and attname='is_active'),
  'profiles has a required active flag with a default');
select ok(has_function_privilege('authenticated', 'public.list_board_assignees(uuid)', 'EXECUTE'),
  'authenticated may execute bounded assignee lookup');
select ok(not has_function_privilege('anon', 'public.list_board_assignees(uuid)', 'EXECUTE'),
  'anon cannot list assignees');
select ok(has_function_privilege('authenticated',
  'public.create_task(uuid,uuid,text,uuid,timestamp with time zone,boolean,text)', 'EXECUTE'),
  'authenticated may execute controlled task creation');
select ok(not has_function_privilege('anon',
  'public.create_task(uuid,uuid,text,uuid,timestamp with time zone,boolean,text)', 'EXECUTE'),
  'anon cannot create tasks');
select ok(not has_table_privilege('authenticated','public.tasks','INSERT'),
  'direct task INSERT remains unavailable');
select ok(not has_table_privilege('authenticated','public.tasks','DELETE'),
  'task DELETE remains unavailable');
select ok((select prosecdef and proconfig @> array['search_path=""']
  from pg_proc where oid='public.list_board_assignees(uuid)'::regprocedure),
  'assignee lookup is SECURITY DEFINER with empty search_path');
select ok((select prosecdef and proconfig @> array['search_path=""']
  from pg_proc where oid='public.create_task(uuid,uuid,text,uuid,timestamp with time zone,boolean,text)'::regprocedure),
  'task creation is SECURITY DEFINER with empty search_path');
select is((select pronargs::integer from pg_proc
  where oid='public.create_task(uuid,uuid,text,uuid,timestamp with time zone,boolean,text)'::regprocedure),
  7, 'creation RPC has no created_by or business_state argument');

insert into public.departments(id,name) values
 ('92000000-0000-4000-8000-000000000001','Creation test department A'),
 ('92000000-0000-4000-8000-000000000002','Creation test department B');
insert into auth.users(id,raw_user_meta_data) values
 ('91000000-0000-4000-8000-000000000001','{}'),
 ('91000000-0000-4000-8000-000000000002','{}'),
 ('91000000-0000-4000-8000-000000000003','{}'),
 ('91000000-0000-4000-8000-000000000004','{}'),
 ('91000000-0000-4000-8000-000000000005','{}'),
 ('91000000-0000-4000-8000-000000000006','{}');
insert into public.profiles(id,department_id,display_name,role,is_active) values
 ('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Criador fictício','membro',true),
 ('91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','Responsável fictício','membro',true),
 ('91000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001','Observador fictício','membro',true),
 ('91000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000002','Pessoa externa','membro',true),
 ('91000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000002','Admin global','administrador',true),
 ('91000000-0000-4000-8000-000000000006','92000000-0000-4000-8000-000000000001','Pessoa inativa','membro',false);
insert into public.boards(id,title,department_id,created_by) values
 ('93000000-0000-4000-8000-000000000001','Creation board A','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001'),
 ('93000000-0000-4000-8000-000000000002','Creation board B','92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000004');
insert into public.board_memberships(board_id,user_id,added_by) values
 ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001'),
 ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000001'),
 ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000006','91000000-0000-4000-8000-000000000001');
insert into public.board_columns(id,board_id,title,position) values
 ('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Entrada',0),
 ('94000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','Outra entrada',0);

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);

select is((select count(*)::integer from public.list_board_assignees('93000000-0000-4000-8000-000000000001')),
  3, 'authorized participant lists only active current board participants');
select results_eq(
  $$select id from public.list_board_assignees('93000000-0000-4000-8000-000000000001') order by id$$,
  $$values ('91000000-0000-4000-8000-000000000001'::uuid),
           ('91000000-0000-4000-8000-000000000002'::uuid),
           ('91000000-0000-4000-8000-000000000003'::uuid)$$,
  'inactive participant is not returned');
select is((select count(*)::integer from jsonb_object_keys((
  select to_jsonb(x) from public.list_board_assignees('93000000-0000-4000-8000-000000000001') x limit 1
))),
  2, 'assignee lookup exposes exactly two fields');
select ok((select bool_and(to_jsonb(x) ? 'id' and to_jsonb(x) ? 'display_name'
  and not (to_jsonb(x) ?| array['email','role','department_id','is_active','created_at']))
  from public.list_board_assignees('93000000-0000-4000-8000-000000000001') x),
  'assignee lookup exposes only id and display_name');
select is((select count(*)::integer from public.profiles), 1,
  'general profiles RLS remains limited to the caller');

select lives_ok($$select public.create_task(
  '93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001',
  '  Pendência própria  ','91000000-0000-4000-8000-000000000001','2030-01-10 12:00+00',false,'  Descrição  ')$$,
  'valid self-assigned task is created');
select is((select business_state::text from public.tasks where title='Pendência própria'),
  'a_fazer', 'self-assigned task starts in a_fazer');
select is((select created_by from public.tasks where title='Pendência própria'),
  '91000000-0000-4000-8000-000000000001'::uuid, 'created_by comes from authenticated identity');
select is((select description from public.tasks where title='Pendência própria'),
  'Descrição', 'optional description is stored after trimming');

select lives_ok($$select public.create_task(
  '93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001',
  'Pendência atribuída','91000000-0000-4000-8000-000000000002','2030-01-11 12:00+00',true,null)$$,
  'valid task assigned to another active participant is created');
select is((select business_state::text from public.tasks where title='Pendência atribuída'),
  'aguardando_aceite', 'task assigned to another user starts awaiting acceptance');
select is((select created_by from public.tasks where title='Pendência atribuída'),
  '91000000-0000-4000-8000-000000000001'::uuid, 'other assignment cannot forge creator');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='create_task' and p.pronargs <> 7),
  'no overload permits choosing creator or initial state');
select throws_ok($$insert into public.tasks(board_id,column_id,title,created_by,assignee_id,due_at,is_private,business_state)
  values('93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','Forjada',
  '91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002',now(),false,'concluido')$$,
  '42501', null::text, 'direct INSERT cannot forge creator or initial state');
select throws_ok($$select public.create_task(
  '93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001',
  '   ','91000000-0000-4000-8000-000000000001',now(),false,null)$$,
  '22023', null::text, 'blank title is rejected');
select throws_ok($$select public.create_task(
  '93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001',
  'Sem responsável',null,now(),false,null)$$,
  '22023', null::text, 'missing assignee is rejected');
select throws_ok($$select public.create_task(
  '93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001',
  'Sem prazo','91000000-0000-4000-8000-000000000001',null,false,null)$$,
  '22023', null::text, 'missing deadline is rejected');
select throws_ok($$select public.create_task(
  '93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002',
  'Coluna errada','91000000-0000-4000-8000-000000000001',now(),false,null)$$,
  '22023', null::text, 'column from another board is rejected');
select throws_ok($$select public.create_task(
  '93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001',
  'Inativa','91000000-0000-4000-8000-000000000006',now(),false,null)$$,
  '22023', null::text, 'inactive assignee is rejected');
select throws_ok($$delete from public.tasks where title='Pendência própria'$$,
  '42501', null::text, 'DELETE remains blocked');

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
select is((select count(*)::integer from public.tasks where title='Pendência própria'), 1,
  'existing RLS still shows a public task to a board participant');
select is((select count(*)::integer from public.tasks where title='Pendência atribuída'), 0,
  'existing privacy RLS hides a private task from an unrelated participant');

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000004',true);
select throws_ok($$select * from public.list_board_assignees('93000000-0000-4000-8000-000000000001')$$,
  '42501', null::text, 'user without board access cannot enumerate participants');
select throws_ok($$select public.create_task(
  '93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001',
  'Sem acesso','91000000-0000-4000-8000-000000000001',now(),false,null)$$,
  '42501', null::text, 'user without board access cannot create a task');

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000005',true);
select is((select count(*)::integer from public.list_board_assignees('93000000-0000-4000-8000-000000000001')),
  3, 'global administrator can use bounded lookup without membership');
select is((select count(*)::integer from public.tasks where title='Pendência atribuída'), 1,
  'global administrator retains approved private task access');

reset role;
delete from public.board_memberships
where board_id='93000000-0000-4000-8000-000000000001'
  and user_id='91000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.list_board_assignees('93000000-0000-4000-8000-000000000001')),
  2, 'removed participant no longer appears in lookup');
select ok(not exists(select 1 from public.list_board_assignees('93000000-0000-4000-8000-000000000001')
  where id='91000000-0000-4000-8000-000000000003'),
  'removed participant cannot be enumerated by id');

reset role;
select * from finish();
rollback;
