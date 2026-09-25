-- REVIEW ONLY. Do not execute until separately authorized; never run remotely.
-- Requires both foundation migrations. Synthetic fixtures, no login credentials.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(119);

-- Structure and grants. No queries below run unless this file is explicitly executed.

-- Test 1
select is((select count(*)::integer from pg_tables where schemaname='public' and tablename='tasks'), 1, 'tasks table exists');

-- Test 2
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.tasks'::regclass), 'tasks has enabled and forced RLS');

-- Test 3
select is((select count(*)::integer from pg_policies where schemaname='public' and tablename='tasks'), 1, 'only one task policy exists');

-- Test 4
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and cmd='SELECT' and roles=array['authenticated']::name[]), 'only authenticated SELECT policy');

-- Test 5
select ok(has_table_privilege('authenticated','public.tasks','SELECT'), 'authenticated may select under RLS');

-- Test 6
select ok(not has_table_privilege('anon','public.tasks','SELECT'), 'anon cannot select');

-- Test 7
select ok(not has_table_privilege('anon','public.tasks','INSERT'), 'anon lacks INSERT');

-- Test 8
select ok(not has_table_privilege('anon','public.tasks','UPDATE'), 'anon lacks UPDATE');

-- Test 9
select ok(not has_table_privilege('anon','public.tasks','DELETE'), 'anon lacks DELETE');

-- Test 10
select ok(not has_table_privilege('anon','public.tasks','TRUNCATE'), 'anon lacks TRUNCATE');

-- Test 11
select ok(not has_table_privilege('anon','public.tasks','REFERENCES'), 'anon lacks REFERENCES');

-- Test 12
select ok(not has_table_privilege('anon','public.tasks','TRIGGER'), 'anon lacks TRIGGER');

-- Test 13
select ok(not has_any_column_privilege('anon','public.tasks','INSERT'), 'anon lacks column-level INSERT');

-- Test 14
select ok(not has_any_column_privilege('anon','public.tasks','UPDATE'), 'anon lacks column-level UPDATE');

-- Test 15
select ok(not has_table_privilege('authenticated','public.tasks','INSERT'), 'authenticated lacks INSERT');

-- Test 16
select ok(not has_table_privilege('authenticated','public.tasks','UPDATE'), 'authenticated lacks UPDATE');

-- Test 17
select ok(not has_table_privilege('authenticated','public.tasks','DELETE'), 'authenticated lacks DELETE');

-- Test 18
select ok(not has_table_privilege('authenticated','public.tasks','TRUNCATE'), 'authenticated lacks TRUNCATE');

-- Test 19
select ok(not has_table_privilege('authenticated','public.tasks','REFERENCES'), 'authenticated lacks REFERENCES');

-- Test 20
select ok(not has_table_privilege('authenticated','public.tasks','TRIGGER'), 'authenticated lacks TRIGGER');

-- Test 21
select ok(not has_any_column_privilege('authenticated','public.tasks','INSERT'), 'authenticated lacks column-level INSERT');

-- Test 22
select ok(not has_any_column_privilege('authenticated','public.tasks','UPDATE'), 'authenticated lacks column-level UPDATE');

-- Test 23
select ok(not exists (select 1 from pg_class c cross join lateral aclexplode(c.relacl) a where c.oid='public.tasks'::regclass and a.grantee=0), 'PUBLIC has no task privileges');

-- Test 24
select ok(exists (select 1 from pg_constraint where conrelid='public.tasks'::regclass and conname='tasks_board_column_fkey' and contype='f' and confrelid='public.board_columns'::regclass and confdeltype='r' and array_length(conkey,1)=2), 'composite board-column FK restricts deletion');

-- Test 25
select ok(exists (select 1 from pg_constraint where conrelid='public.board_columns'::regclass and conname='board_columns_board_id_id_key' and contype='u' and not condeferrable), 'referenced composite key is non-deferrable');

-- Test 26
select is((select count(*)::integer from pg_constraint where conrelid='public.tasks'::regclass and contype='f' and confdeltype='r'), 4, 'four restrictive foreign keys');

-- Test 27
select ok(not exists (select 1 from pg_constraint where conrelid='public.tasks'::regclass and contype='f' and confrelid='public.board_memberships'::regclass), 'membership removal cannot delete or block on task FK');

-- Test 28
select is((select atttypid::regtype::text from pg_attribute where attrelid='public.tasks'::regclass and attname='business_state'), 'kanban_business_state', 'uses existing business state enum');

-- Test 29
select is((select atttypid::regtype::text from pg_attribute where attrelid='public.tasks'::regclass and attname='due_at'), 'timestamp with time zone', 'deadline is an instant with timezone');

-- Test 30
select is((select count(*)::integer from pg_indexes where schemaname='public' and tablename='tasks' and indexname in ('tasks_board_column_created_idx','tasks_assignee_due_idx','tasks_created_by_idx')), 3, 'query and FK indexes exist');


-- Synthetic, passwordless identities; all fixtures are rolled back.
insert into public.departments(id,name) values
 ('82000000-0000-4000-8000-000000000001','Task test department A'),('82000000-0000-4000-8000-000000000002','Task test department B');
insert into auth.users(id,raw_user_meta_data) values
 ('81000000-0000-4000-8000-000000000001','{}'),
 ('81000000-0000-4000-8000-000000000002','{}'),
 ('81000000-0000-4000-8000-000000000003','{}'),
 ('81000000-0000-4000-8000-000000000004','{"role":"administrador","is_board_admin":true}'),
 ('81000000-0000-4000-8000-000000000005','{}'),
 ('81000000-0000-4000-8000-000000000006','{}'),
 ('81000000-0000-4000-8000-000000000007','{}'),
 ('81000000-0000-4000-8000-000000000008','{}'),
 ('81000000-0000-4000-8000-000000000009','{}');
insert into public.profiles(id,department_id,role) values
 ('81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','membro'),
 ('81000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','membro'),
 ('81000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','membro'),
 ('81000000-0000-4000-8000-000000000004','82000000-0000-4000-8000-000000000001','membro'),
 ('81000000-0000-4000-8000-000000000005','82000000-0000-4000-8000-000000000001','membro'),
 ('81000000-0000-4000-8000-000000000006','82000000-0000-4000-8000-000000000002','administrador'),
 ('81000000-0000-4000-8000-000000000007','82000000-0000-4000-8000-000000000002','membro'),
 ('81000000-0000-4000-8000-000000000009','82000000-0000-4000-8000-000000000001','gestor');
insert into public.boards(id,title,department_id,created_by) values
 ('83000000-0000-4000-8000-000000000001','Task test board A','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003'),
 ('83000000-0000-4000-8000-000000000002','Task test board B','82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000007');
-- Board creators 3 and 7 receive local administration via the existing trigger.
insert into public.board_memberships(board_id,user_id,added_by) values
 ('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003'),
 ('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003'),
 ('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000003'),
 ('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000009','81000000-0000-4000-8000-000000000003');
insert into public.board_columns(id,board_id,title,position,business_state) values
 ('84000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','Organizational',0,null),
 ('84000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000001','Doing',1,'fazendo'),
 ('84000000-0000-4000-8000-000000000003','83000000-0000-4000-8000-000000000002','Other board',0,null);
insert into public.tasks(id,board_id,column_id,title,created_by,assignee_id,due_at,is_private) values
 ('85000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','Shared A','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','2030-01-01 12:00:00+00',false),
 ('85000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','Private A','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','2030-01-01 12:00:00+00',true),
 ('85000000-0000-4000-8000-000000000003','83000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000003','Shared B','81000000-0000-4000-8000-000000000007','81000000-0000-4000-8000-000000000007','2030-01-01 12:00:00+00',false),
 ('85000000-0000-4000-8000-000000000004','83000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000003','Private B','81000000-0000-4000-8000-000000000007','81000000-0000-4000-8000-000000000007','2030-01-01 12:00:00+00',true);

-- Constraint tests use the trusted fixture role, not an application identity.
-- Successful constraint fixtures are cleaned up below without rewinding pgTAP state.

-- Test 31
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values (null, '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '23502', null::text, 'board_id is mandatory');

-- Test 32
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', null, 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '23502', null::text, 'column_id is mandatory');

-- Test 33
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', null, null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '23502', null::text, 'title is mandatory');

-- Test 34
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, null, '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '23502', null::text, 'created_by is mandatory');

-- Test 35
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', null, '2030-01-01 12:00:00+00', false)$$, '23502', null::text, 'assignee_id is mandatory');

-- Test 36
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', null, false)$$, '23502', null::text, 'due_at is mandatory');

-- Test 37
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private, business_state) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false, null)$$, '23502', null::text, 'business_state is mandatory');

-- Test 38
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', null)$$, '23502', null::text, 'is_private is mandatory');

-- Test 39
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private, created_at) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false, null)$$, '23502', null::text, 'created_at is mandatory');

-- Test 40
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', '   ', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '23514', null::text, 'blank title rejected');

-- Test 41
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000099', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '23503', null::text, 'board must exist');

-- Test 42
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000099', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '23503', null::text, 'column must exist');

-- Test 43
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000003', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '23503', null::text, 'column from another board rejected');

-- Test 44
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000099', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '23503', null::text, 'creator must exist');

-- Test 45
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000099', '2030-01-01 12:00:00+00', false)$$, '23503', null::text, 'assignee must exist');

-- Test 46
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000008', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '23503', null::text, 'Auth identity without profile cannot be creator');

-- Test 47
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000008', '2030-01-01 12:00:00+00', false)$$, '23503', null::text, 'Auth identity without profile cannot be assignee');

-- Test 48
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private, business_state) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false, 'recusado')$$, '22P02', null::text, 'unapproved refused state rejected');

-- Test 49
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private, id) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false, '85000000-0000-4000-8000-000000000001')$$, '23505', null::text, 'duplicate task ID rejected');

-- Test 50
select lives_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2000-01-01 00:00:00+00', false)$$, 'overdue deadline is valid');

-- Test 51
select lives_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, 'description is optional');

-- Test 52
select lives_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private, business_state) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false, 'aguardando_aceite')$$, 'existing state aguardando_aceite is storable independently of an organizational column');

-- Test 53
select lives_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private, business_state) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false, 'a_fazer')$$, 'existing state a_fazer is storable independently of an organizational column');

-- Test 54
select lives_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private, business_state) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false, 'fazendo')$$, 'existing state fazendo is storable independently of an organizational column');

-- Test 55
select lives_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private, business_state) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false, 'aguardando_terceiro')$$, 'existing state aguardando_terceiro is storable independently of an organizational column');

-- Test 56
select lives_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private, business_state) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false, 'concluido')$$, 'existing state concluido is storable independently of an organizational column');

-- Test 57
select lives_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private, id) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000002', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false, '85000000-0000-4000-8000-000000000010')$$, 'associated column does not automatically set task state');

-- Test 58
select is((select business_state::text from public.tasks where id='85000000-0000-4000-8000-000000000010'), 'aguardando_aceite', 'initial state remains awaiting acceptance');

select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);

-- Test 59
select lives_ok($$insert into public.tasks(id,board_id,column_id,title,assignee_id,due_at,is_private) values ('85000000-0000-4000-8000-000000000011','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','Default author','81000000-0000-4000-8000-000000000002','2030-01-01 12:00:00+00',false)$$, 'trusted fixture insert can use auth.uid author default');

-- Test 60
select is((select created_by from public.tasks where id='85000000-0000-4000-8000-000000000011'), '81000000-0000-4000-8000-000000000001'::uuid, 'default author comes from authenticated identity');

-- Test 61
select ok((select created_at = transaction_timestamp() from public.tasks where id='85000000-0000-4000-8000-000000000011'), 'creation timestamp is generated');

-- Test 62
select throws_ok($$delete from public.board_columns where id='84000000-0000-4000-8000-000000000001'$$, '23503', null::text, 'referenced column deletion restricted');

-- Test 63
select throws_ok($$delete from public.profiles where id='81000000-0000-4000-8000-000000000001'$$, '23503', null::text, 'creator deletion restricted');

-- Test 64
select throws_ok($$delete from public.profiles where id='81000000-0000-4000-8000-000000000002'$$, '23503', null::text, 'assignee deletion restricted');

-- Test 65
select throws_ok($$update public.tasks set column_id='84000000-0000-4000-8000-000000000003' where id='85000000-0000-4000-8000-000000000001'$$, '23503', null::text, 'cross-board column reassignment rejected');

-- Remove only extra fixtures from the constraint checks; keep pgTAP result state intact.
delete from public.tasks
where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')
  and id not in ('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002',
                 '85000000-0000-4000-8000-000000000003','85000000-0000-4000-8000-000000000004');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

-- Test 66
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 2, 'creator sees shared and private tasks in authorized board');

-- Test 67
select is((select count(*)::integer from public.tasks where id='85000000-0000-4000-8000-000000000004'), 0, 'creator cannot see another board private task');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);

-- Test 68
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 2, 'cross-department assignee sees own private task with active membership');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);

-- Test 69
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 2, 'local board administrator sees private task without being creator or assignee');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);

-- Test 70
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 1, 'ordinary participant sees only shared task');

-- Test 71
select is((select count(*)::integer from public.tasks where id='85000000-0000-4000-8000-000000000002'), 0, 'editable Auth metadata grants no private access');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000005', true);

-- Test 72
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 0, 'same department alone grants no task access');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000007', true);

-- Test 73
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 2, 'other board administrator sees only own board tasks');

-- Test 74
select is((select count(*)::integer from public.tasks where id='85000000-0000-4000-8000-000000000002'), 0, 'administration of another board grants no private access');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000009', true);

-- Test 75
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 1, 'gestor participant has no implicit private-task privilege');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000006', true);

-- Test 76
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 4, 'global administrator sees all tasks without membership');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000008', true);

-- Test 77
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 0, 'Auth identity without profile cannot read tasks');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);

-- Test 78
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 0, 'missing authenticated identity cannot read tasks');

reset role;
set local role anon;

-- Test 79
select throws_ok($$select * from public.tasks$$, '42501', null::text, 'anonymous task read denied');

-- Test 80
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '42501', null::text, 'anonymous task insert denied');


-- No API writes, even for a visible task's author, a local admin, or a global admin.

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

-- Test 81
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000007', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '42501', null::text, 'user 1 cannot insert or forge authorship');

-- Test 82
select throws_ok($$update public.tasks set created_by='81000000-0000-4000-8000-000000000001' where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 1 cannot take ownership');

-- Test 83
select throws_ok($$update public.tasks set is_private=false where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 1 cannot expose private task');

-- Test 84
select throws_ok($$update public.tasks set assignee_id='81000000-0000-4000-8000-000000000001',business_state='concluido',column_id='84000000-0000-4000-8000-000000000002' where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 1 cannot assign, move or transition a task');

-- Test 85
select throws_ok($$delete from public.tasks where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 1 cannot delete tasks');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);

-- Test 86
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000007', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '42501', null::text, 'user 3 cannot insert or forge authorship');

-- Test 87
select throws_ok($$update public.tasks set created_by='81000000-0000-4000-8000-000000000003' where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 3 cannot take ownership');

-- Test 88
select throws_ok($$update public.tasks set is_private=false where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 3 cannot expose private task');

-- Test 89
select throws_ok($$update public.tasks set assignee_id='81000000-0000-4000-8000-000000000003',business_state='concluido',column_id='84000000-0000-4000-8000-000000000002' where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 3 cannot assign, move or transition a task');

-- Test 90
select throws_ok($$delete from public.tasks where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 3 cannot delete tasks');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000006', true);

-- Test 91
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000007', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '42501', null::text, 'user 6 cannot insert or forge authorship');

-- Test 92
select throws_ok($$update public.tasks set created_by='81000000-0000-4000-8000-000000000006' where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 6 cannot take ownership');

-- Test 93
select throws_ok($$update public.tasks set is_private=false where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 6 cannot expose private task');

-- Test 94
select throws_ok($$update public.tasks set assignee_id='81000000-0000-4000-8000-000000000006',business_state='concluido',column_id='84000000-0000-4000-8000-000000000002' where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 6 cannot assign, move or transition a task');

-- Test 95
select throws_ok($$delete from public.tasks where id='85000000-0000-4000-8000-000000000002'$$, '42501', null::text, 'user 6 cannot delete tasks');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);

-- Test 96
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private, id) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false, '85000000-0000-4000-8000-000000000002') on conflict(id) do update set created_by=excluded.created_by$$, '42501', null::text, 'upsert cannot bypass write prohibition');

-- Test 97
select throws_ok($$update public.tasks set title='Guessed UUID' where id='85000000-0000-4000-8000-000000000004'$$, '42501', null::text, 'guessed UUID grants no write path');

-- Test 98
select throws_ok($$truncate public.tasks$$, '42501', null::text, 'truncate denied');


-- Defense in depth: even hypothetical DML grants have no write policies.
reset role;
grant insert,update,delete on public.tasks to authenticated;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

-- Test 99
select throws_ok($$insert into public.tasks (board_id, column_id, title, description, created_by, assignee_id, due_at, is_private) values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'Fixture task', null, '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', '2030-01-01 12:00:00+00', false)$$, '42501', null::text, 'RLS rejects INSERT even if table INSERT is accidentally granted');

-- Test 100
select results_eq($$update public.tasks set title='Changed' where id='85000000-0000-4000-8000-000000000001' returning id$$, $$select null::uuid where false$$, 'RLS UPDATE has no visible writable rows');

-- Test 101
select results_eq($$delete from public.tasks where id='85000000-0000-4000-8000-000000000001' returning id$$, $$select null::uuid where false$$, 'RLS DELETE has no visible writable rows');

reset role;
revoke insert,update,delete on public.tasks from authenticated;


-- Remove memberships through the existing authorized application path.

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);

-- Test 102
select lives_ok($$delete from public.board_memberships where board_id='83000000-0000-4000-8000-000000000001' and user_id='81000000-0000-4000-8000-000000000001'$$, 'local admin removes task creator participation');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

-- Test 103
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 0, 'removed creator loses shared and private task access');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);

-- Test 104
select lives_ok($$delete from public.board_memberships where board_id='83000000-0000-4000-8000-000000000001' and user_id='81000000-0000-4000-8000-000000000002'$$, 'local admin removes assignee participation');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);

-- Test 105
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 0, 'removed assignee loses shared and private task access');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);

-- Test 106
select is((select count(*)::integer from public.tasks where id='85000000-0000-4000-8000-000000000002'), 1, 'local admin still reads private task after creator and assignee removal');

-- Test 107
select lives_ok($$delete from public.board_memberships where board_id='83000000-0000-4000-8000-000000000001' and user_id=auth.uid()$$, 'last local admin may remove own participation despite existing tasks');

-- Test 108
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 0, 'removed local admin loses private and shared access');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);

-- Test 109
select is((select count(*)::integer from public.tasks where id='85000000-0000-4000-8000-000000000002'), 0, 'remaining ordinary participant cannot read private task after removals');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000006', true);

-- Test 110
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 4, 'global admin retains access after all local privileged readers are removed');

-- Test 111
select lives_ok($$insert into public.board_memberships(board_id,user_id) values ('83000000-0000-4000-8000-000000000001',auth.uid())$$, 'global admin may participate via existing membership API');

-- Test 112
select lives_ok($$delete from public.board_memberships where board_id='83000000-0000-4000-8000-000000000001' and user_id=auth.uid()$$, 'global admin may remove own membership');

-- Test 113
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 4, 'global admin still reads tasks after own membership removal');

reset role;

-- Test 114
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 4, 'membership removal preserves all task records');

-- Test 115
select is((select created_by from public.tasks where id='85000000-0000-4000-8000-000000000002'), '81000000-0000-4000-8000-000000000001'::uuid, 'removed creator remains recorded');

-- Test 116
select is((select assignee_id from public.tasks where id='85000000-0000-4000-8000-000000000002'), '81000000-0000-4000-8000-000000000002'::uuid, 'removed assignee remains recorded');

-- Test 117
select ok((select created_at=transaction_timestamp() from public.tasks where id='85000000-0000-4000-8000-000000000002'), 'membership removal preserves creation audit timestamp');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000006', true);

-- Test 118
select lives_ok($$insert into public.board_memberships(board_id,user_id) values ('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001')$$, 'global admin can restore creator membership');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

-- Test 119
select is((select count(*)::integer from public.tasks where board_id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002')), 2, 'restored participant creator regains private and shared access');

reset role;
select * from finish();
rollback;
