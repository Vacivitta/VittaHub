-- Task 13: secure chat foundation. Local only.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select bool_and(relrowsecurity and relforcerowsecurity)
  from pg_class where oid in ('public.conversations'::regclass,
    'public.conversation_participants'::regclass, 'public.messages'::regclass)),
  'all chat tables have enabled and forced RLS');
select ok((select bool_and(has_table_privilege('authenticated', oid, 'SELECT'))
  from pg_class where oid in ('public.conversations'::regclass,
    'public.conversation_participants'::regclass, 'public.messages'::regclass)),
  'authenticated users have read-only table access');
select ok((select bool_and(not has_table_privilege('authenticated', oid, 'INSERT,UPDATE,DELETE,TRUNCATE'))
  from pg_class where oid in ('public.conversations'::regclass,
    'public.conversation_participants'::regclass, 'public.messages'::regclass)),
  'authenticated users have no direct chat write privileges');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""'])
  from pg_proc where oid in ('vittahub_private.can_access_conversation(uuid)'::regprocedure,
    'public.list_conversation_participants(uuid)'::regprocedure,
    'public.send_message(uuid,text)'::regprocedure)),
  'chat helper and RPCs are SECURITY DEFINER with empty search_path');
select ok(not has_function_privilege('anon','public.list_conversation_participants(uuid)','EXECUTE'),
  'anonymous users cannot list conversation participants');
select ok(not has_function_privilege('anon','public.send_message(uuid,text)','EXECUTE'),
  'anonymous users cannot send messages');
select is(pg_get_function_result('public.list_conversation_participants(uuid)'::regprocedure),
  'TABLE(user_id uuid, display_name text)', 'participant RPC exposes only user_id and display_name');

insert into public.departments(id,name) values
 ('d2000000-0000-4000-8000-000000000001','Chat test department');
insert into auth.users(id,raw_user_meta_data) values
 ('d1000000-0000-4000-8000-000000000001','{}'),
 ('d1000000-0000-4000-8000-000000000002','{}'),
 ('d1000000-0000-4000-8000-000000000003','{}'),
 ('d1000000-0000-4000-8000-000000000004','{}');
insert into public.profiles(id,department_id,display_name,role) values
 ('d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','Pessoa Chat Um','membro'),
 ('d1000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','Pessoa Chat Dois','membro'),
 ('d1000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','Pessoa Chat TrÃªs','gestor'),
 ('d1000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001','Pessoa Externa','membro');
insert into public.conversations(id,kind,title,created_at,last_activity_at) values
 ('d3000000-0000-4000-8000-000000000001','individual',null,'2026-09-28 10:00:00+00','2026-09-28 10:00:00+00'),
 ('d3000000-0000-4000-8000-000000000002','grupo','Grupo restrito','2026-09-28 11:00:00+00','2026-09-28 11:00:00+00');
insert into public.conversation_participants(conversation_id,user_id) values
 ('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001'),
 ('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002'),
 ('d3000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002'),
 ('d3000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000003');
insert into public.messages(id,conversation_id,author_id,content,created_at) values
 ('d4000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','Mensagem individual','2026-09-28 10:05:00+00'),
 ('d4000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000003','Mensagem do grupo','2026-09-28 11:05:00+00');

set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.conversations), 1,
  'participant sees their conversation');
select is((select id from public.conversations),
  'd3000000-0000-4000-8000-000000000001'::uuid, 'conversation B does not leak into conversation A');
select is((select count(*)::integer from public.conversation_participants), 2,
  'participant sees participants of their conversation');
select is((select count(*)::integer from public.conversation_participants
  where conversation_id='d3000000-0000-4000-8000-000000000002'), 0,
  'participant cannot enumerate another conversation membership');
select is((select count(*)::integer from public.messages), 1,
  'participant reads their conversation history only');
select is((select content from public.messages), 'Mensagem individual',
  'conversation A does not leak messages from conversation B');
select is((select count(*)::integer from public.list_conversation_participants(
  'd3000000-0000-4000-8000-000000000001')), 2,
  'participant RPC lists only the current conversation membership');
select throws_ok($$select * from public.list_conversation_participants(
  'd3000000-0000-4000-8000-000000000002')$$,
  '42501', null::text, 'participant cannot request names from another conversation');
select lives_ok($$select public.send_message(
  'd3000000-0000-4000-8000-000000000001','  Mensagem segura  ')$$,
  'participant sends a message');
select is((select content from public.messages where content='Mensagem segura'),
  'Mensagem segura', 'message content is trimmed');
select is((select author_id from public.messages where content='Mensagem segura'),
  'd1000000-0000-4000-8000-000000000001'::uuid, 'message author comes from auth.uid()');
select ok((select created_at=transaction_timestamp() from public.messages where content='Mensagem segura'),
  'message timestamp comes from the database');
select ok((select last_activity_at > '2026-09-28 10:00:00+00' from public.conversations
  where id='d3000000-0000-4000-8000-000000000001'),
  'sending updates conversation activity for ordering');
select throws_ok($$insert into public.messages(conversation_id,author_id,content) values
  ('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','Autor forjado')$$,
  '42501', null::text, 'client cannot forge a message author');
select throws_ok($$select public.send_message(
  'd3000000-0000-4000-8000-000000000001','   ')$$,
  '22023', null::text, 'blank message is rejected');
select throws_ok($$select public.send_message(
  'd3000000-0000-4000-8000-000000000002','Sem participaÃ§Ã£o')$$,
  '42501', null::text, 'user cannot send to another conversation');
select throws_ok($$delete from public.messages where conversation_id=
  'd3000000-0000-4000-8000-000000000001'$$,
  '42501', null::text, 'message deletion is blocked');
select is((select count(*)::integer from public.messages), 2,
  'previous messages are preserved after blocked deletion');

select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000004',true);
select is((select count(*)::integer from public.conversations), 0,
  'non-participant cannot see conversations');
select is((select count(*)::integer from public.conversation_participants), 0,
  'non-participant cannot enumerate participants');
select is((select count(*)::integer from public.messages), 0,
  'non-participant cannot read messages');
select throws_ok($$select * from public.list_conversation_participants(
  'd3000000-0000-4000-8000-000000000001')$$,
  '42501', null::text, 'non-participant cannot obtain participant names');
select throws_ok($$select public.send_message(
  'd3000000-0000-4000-8000-000000000001','Mensagem externa')$$,
  '42501', null::text, 'non-participant cannot send messages');

select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.conversations), 2,
  'user participating in both conversations sees both');
select is((select count(*)::integer from public.messages), 3,
  'user participating in both conversations sees both histories');
select is((select count(*)::integer from public.messages
  where conversation_id='d3000000-0000-4000-8000-000000000002'), 1,
  'message isolation preserves the correct conversation association');

reset role;
select * from finish();
rollback;
