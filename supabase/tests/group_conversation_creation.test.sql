-- Task 18: safe group conversation creation using the existing chat access model.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'public.create_group_conversation(text,uuid[])', 'EXECUTE'),
  'anon has no EXECUTE grant for group creation');
select ok(p.prosecdef and p.proconfig @> array['search_path=""'],
  'group creation is a secured definer')
from pg_proc p
where p.oid = 'public.create_group_conversation(text,uuid[])'::regprocedure;

insert into public.departments (id, name) values
  ('e2000000-0000-4000-8000-000000000001', 'Grupos de chat');
insert into auth.users (id) values
  ('e1000000-0000-4000-8000-000000000001'),
  ('e1000000-0000-4000-8000-000000000002'),
  ('e1000000-0000-4000-8000-000000000003'),
  ('e1000000-0000-4000-8000-000000000004'),
  ('e1000000-0000-4000-8000-000000000005');
insert into public.profiles (id, department_id, display_name, role, is_active) values
  ('e1000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'Membro Grupo', 'membro', true),
  ('e1000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'Gestora Grupo', 'gestor', true),
  ('e1000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000001', 'Admin Grupo', 'administrador', true),
  ('e1000000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000001', 'Pessoa Externa', 'membro', true),
  ('e1000000-0000-4000-8000-000000000005', 'e2000000-0000-4000-8000-000000000001', 'Pessoa Inativa', 'membro', false);

set local role anon;
select throws_ok($$select public.create_group_conversation('Grupo anônimo', array['e1000000-0000-4000-8000-000000000001'::uuid])$$,
  '42501', null::text, 'anon cannot create a group');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.create_group_conversation('Grupo membro', array['e1000000-0000-4000-8000-000000000002'::uuid])$$,
  '42501', null::text, 'member cannot create a group');

select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.create_group_conversation(
  '  Operação da Unidade  ',
  array[
    'e1000000-0000-4000-8000-000000000001'::uuid,
    'e1000000-0000-4000-8000-000000000001'::uuid,
    'e1000000-0000-4000-8000-000000000002'::uuid,
    'e1000000-0000-4000-8000-000000000002'::uuid,
    'e1000000-0000-4000-8000-000000000003'::uuid
  ])$$, 'manager creates a group');
select is((select count(*)::integer from public.conversations where kind = 'grupo' and title = 'Operação da Unidade'),
  1, 'group title is trimmed and persisted');
select is((select count(*)::integer from public.conversation_participants cp
  join public.conversations c on c.id = cp.conversation_id
  where c.kind = 'grupo' and c.title = 'Operação da Unidade'), 3,
  'creator, selected users, duplicates and repeated self produce one membership each');
select ok(exists(select 1 from public.conversation_participants cp
  join public.conversations c on c.id = cp.conversation_id
  where c.title = 'Operação da Unidade' and cp.user_id = 'e1000000-0000-4000-8000-000000000002'),
  'creator is included automatically');
select ok(exists(select 1 from public.conversation_participants cp
  join public.conversations c on c.id = cp.conversation_id
  where c.title = 'Operação da Unidade' and cp.user_id = 'e1000000-0000-4000-8000-000000000001'),
  'selected participant is included');

select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000003', true);
select lives_ok($$select public.create_group_conversation('Equipe Administrativa',
  array['e1000000-0000-4000-8000-000000000001'::uuid])$$,
  'administrator creates a group');

select throws_ok($$select public.create_group_conversation('   ',
  array['e1000000-0000-4000-8000-000000000001'::uuid])$$,
  '22023', null::text, 'blank group name is rejected');
select throws_ok($$select public.create_group_conversation('Sem outra pessoa', '{}'::uuid[])$$,
  '22023', null::text, 'group without another participant is rejected');
select throws_ok($$select public.create_group_conversation('Somente o criador',
  array['e1000000-0000-4000-8000-000000000003'::uuid])$$,
  '22023', null::text, 'self input does not satisfy the other participant requirement');
select throws_ok($$select public.create_group_conversation('Pessoa inexistente',
  array['e1000000-0000-4000-8000-000000000099'::uuid])$$,
  '22023', null::text, 'unknown participant is rejected');
select throws_ok($$select public.create_group_conversation('Pessoa inativa',
  array['e1000000-0000-4000-8000-000000000005'::uuid])$$,
  '22023', null::text, 'inactive participant is rejected');
select is((select count(*)::integer from public.conversations where title in ('Pessoa inexistente', 'Pessoa inativa')),
  0, 'failed validation leaves no partial conversation');

select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.conversations where kind = 'grupo'), 2,
  'participant lists their groups');
select lives_ok($$select public.send_message((select id from public.conversations
  where title = 'Operação da Unidade'), 'Mensagem no grupo')$$,
  'participant sends through the existing message flow');
select is((select count(*)::integer from public.messages where content = 'Mensagem no grupo'), 1,
  'participant reads the persisted group message');

select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.conversations where kind = 'grupo'), 0,
  'non-participant cannot see groups');
select is((select count(*)::integer from public.messages where content = 'Mensagem no grupo'), 0,
  'non-participant cannot read group messages');
select throws_ok($$select public.send_message((select id from public.conversations
  where title = 'Operação da Unidade'), 'Mensagem externa')$$,
  '42501', null::text, 'non-participant cannot send to a group');

reset role;
insert into public.conversations (id, kind) values
  ('e3000000-0000-4000-8000-000000000001', 'individual');
insert into public.conversation_participants (conversation_id, user_id) values
  ('e3000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001'),
  ('e3000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
select is(public.get_or_create_direct_conversation('e1000000-0000-4000-8000-000000000002'),
  'e3000000-0000-4000-8000-000000000001'::uuid,
  'existing direct conversation behavior remains unchanged');
select is((select count(*)::integer from public.conversations where kind = 'individual'), 1,
  'group creation does not participate in direct deduplication');

select * from finish();
rollback;
