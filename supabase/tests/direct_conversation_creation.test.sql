-- Task 17: safe direct conversation lookup/creation.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'public.list_direct_chat_candidates()', 'EXECUTE'), 'anon cannot list direct candidates');
select ok(not has_function_privilege('anon', 'public.get_or_create_direct_conversation(uuid)', 'EXECUTE'), 'anon cannot create direct conversations');
select ok(p.prosecdef and p.proconfig @> array['search_path=""'], p.proname || ': secured definer')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('list_direct_chat_candidates', 'get_or_create_direct_conversation');

insert into public.departments (id, name) values
  ('c2000000-0000-4000-8000-000000000001', 'Chat direto');
insert into auth.users (id) values
  ('c1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000002'),
  ('c1000000-0000-4000-8000-000000000003'),
  ('c1000000-0000-4000-8000-000000000004');
insert into public.profiles (id, department_id, display_name, role, is_active) values
  ('c1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'Ana Ativa', 'membro', true),
  ('c1000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 'Bruno Ativo', 'gestor', true),
  ('c1000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000001', 'Carla Ativa', 'administrador', true),
  ('c1000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000001', 'Davi Inativo', 'membro', false);
insert into public.conversations (id, kind) values
  ('c3000000-0000-4000-8000-000000000001', 'individual');
insert into public.conversation_participants (conversation_id, user_id) values
  ('c3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001'),
  ('c3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002');

set local role anon;
select throws_ok($$select public.get_or_create_direct_conversation('c1000000-0000-4000-8000-000000000002')$$,
  '42501', null::text, 'anon call is rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.list_direct_chat_candidates()
  where user_id in ('c1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000004')), 2,
  'candidate list includes only other active fixture users');
select ok(not exists(select 1 from public.list_direct_chat_candidates() where user_id = auth.uid()), 'candidate list excludes caller');
select ok(not exists(select 1 from public.list_direct_chat_candidates() where user_id = 'c1000000-0000-4000-8000-000000000004'), 'inactive user is excluded');
select is((select public.get_or_create_direct_conversation('c1000000-0000-4000-8000-000000000002')),
  'c3000000-0000-4000-8000-000000000001'::uuid, 'A to B returns existing conversation');
select is((select public.get_or_create_direct_conversation('c1000000-0000-4000-8000-000000000002')),
  'c3000000-0000-4000-8000-000000000001'::uuid, 'repeated A to B call is idempotent');

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000002', true);
select is((select public.get_or_create_direct_conversation('c1000000-0000-4000-8000-000000000001')),
  'c3000000-0000-4000-8000-000000000001'::uuid, 'B to A returns same conversation');
select is((select count(*)::integer from public.conversations where kind = 'individual'), 1, 'reverse call creates no duplicate');

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.get_or_create_direct_conversation('c1000000-0000-4000-8000-000000000003')$$, 'active user creates a direct conversation');
select is((select count(*)::integer from public.conversations where kind = 'individual'), 2, 'one new conversation is created');
select is((select count(*)::integer from public.conversation_participants cp
  join public.conversations c on c.id = cp.conversation_id
  where c.kind = 'individual' and cp.user_id in ('c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000003')
  and c.id <> 'c3000000-0000-4000-8000-000000000001'), 2, 'both participants are inserted');
select throws_ok($$select public.get_or_create_direct_conversation('c1000000-0000-4000-8000-000000000001')$$,
  '22023', null::text, 'self chat is rejected');
select throws_ok($$select public.get_or_create_direct_conversation('c1000000-0000-4000-8000-000000000099')$$,
  '22023', null::text, 'unknown target is rejected');
select throws_ok($$select public.get_or_create_direct_conversation('c1000000-0000-4000-8000-000000000004')$$,
  '22023', null::text, 'inactive target is rejected');

select * from finish();
rollback;
