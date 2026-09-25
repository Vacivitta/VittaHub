-- REVIEW ONLY. Do not execute without separate authorization. Never run remotely.
-- pgTAP fixtures are synthetic, passwordless, transaction-scoped and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select is((select count(*)::integer from pg_tables where schemaname = 'public'
  and tablename in ('profiles','departments','boards','board_columns','board_memberships','board_creation_authorizations')),
  6, 'six foundation tables exist');
select ok(c.relrowsecurity and c.relforcerowsecurity, c.relname || ': enabled and forced RLS')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in
 ('profiles','departments','boards','board_columns','board_memberships','board_creation_authorizations');
select ok(not has_function_privilege('anon', 'public.create_board(text,uuid,text)', 'EXECUTE'), 'anon cannot execute creation RPC');
select ok(not has_function_privilege('authenticated', 'vittahub_private.add_board_creator()', 'EXECUTE'), 'trigger not callable by client');
select ok(not has_schema_privilege('authenticated', 'vittahub_private', 'CREATE'), 'client cannot replace helpers');
select ok(p.prosecdef and p.proconfig @> array['search_path=""'], p.proname || ': definer with empty search_path')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'vittahub_private' or (n.nspname = 'public' and p.proname in ('create_board', 'promote_board_member'));

-- Approved bootstrap order: department, identity, then profile. No login credentials.
insert into public.departments (id, name) values
 ('20000000-0000-4000-8000-000000000001', 'Departamento A ficticio'),
 ('20000000-0000-4000-8000-000000000002', 'Departamento B ficticio'),
 ('20000000-0000-4000-8000-000000000003', 'Departamento C ficticio');
insert into auth.users (id, raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001', '{}'),
 ('10000000-0000-4000-8000-000000000002', '{"role":"administrador"}'),
 ('10000000-0000-4000-8000-000000000003', '{}'),
 ('10000000-0000-4000-8000-000000000004', '{}'),
 ('10000000-0000-4000-8000-000000000005', '{}'),
 ('10000000-0000-4000-8000-000000000006', '{}');
insert into public.profiles (id, department_id, role) values
 ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'membro'),
 ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'membro'),
 ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'gestor'),
 ('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'administrador'),
 ('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', 'membro');
insert into public.boards (id, title, department_id, created_by) values
 ('30000000-0000-4000-8000-000000000001', 'Quadro A', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002', 'Quadro B', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005');
insert into public.board_columns (id, board_id, title, position) values
 ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Organizacional', 0),
 ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'Entrada', 0);
select is((select count(*)::integer from public.board_memberships where is_board_admin
 and board_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')),
 2, 'creator trigger provisions both administrators');
select throws_ok($$insert into public.profiles (id, role) values ('10000000-0000-4000-8000-000000000006','membro')$$,
 '23502', null::text, 'profile requires primary department');
select throws_ok($$insert into public.profiles (id, department_id, role) values
 ('10000000-0000-4000-8000-000000000099','20000000-0000-4000-8000-000000000001','membro')$$,
 '23503', null::text, 'profile requires Auth identity');
select throws_ok($$insert into public.profiles (id, department_id, role) values
 ('10000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000099','membro')$$,
 '23503', null::text, 'profile department must exist');
select throws_ok($$insert into public.boards (title, created_by) values ('Invalid','10000000-0000-4000-8000-000000000001')$$,
 '23502', null::text, 'board requires department');
select throws_ok($$insert into public.departments (name) values (' ')$$, '23514', null::text, 'blank name rejected');
select throws_ok($$select 'superadmin'::public.application_role$$, '22P02', null::text, 'invalid application role rejected');
select throws_ok($$select 'recusado'::public.kanban_business_state$$, '22P02', null::text, 'unapproved state rejected');
select throws_ok($$insert into public.board_columns (board_id,title,position) values
 ('30000000-0000-4000-8000-000000000001','Duplicate',0)$$, '23505', null::text, 'duplicate column position rejected');
select throws_ok($$insert into public.board_columns (board_id,title,position) values
 ('30000000-0000-4000-8000-000000000001','Negative',-1)$$, '23514', null::text, 'negative position rejected');
select throws_ok($$insert into public.board_columns (board_id,title,position) values
 ('30000000-0000-4000-8000-000000000099','Orphan',0)$$, '23503', null::text, 'orphan column rejected');

set local role anon;
select throws_ok('select * from public.' || t, '42501', null::text, 'anon cannot read ' || t)
from unnest(array['profiles','departments','boards','board_columns','board_memberships','board_creation_authorizations']) as t;
select throws_ok($$select public.create_board('Anon','20000000-0000-4000-8000-000000000001')$$,
 '42501', null::text, 'anon creation denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.profiles), 1, 'only own profile visible');
select is((select role::text from public.profiles), 'membro', 'editable metadata cannot promote role');
select is((select count(*)::integer from public.boards), 0, 'same department gives no board access');
select is((select count(*)::integer from public.board_columns), 0, 'same department gives no column access');
select is((select count(*)::integer from public.board_memberships), 0, 'outsider cannot enumerate memberships');
select is((select count(*)::integer from public.departments), 1, 'only organizational context visible');
select throws_ok($$update public.profiles set role = 'administrador' where id = auth.uid()$$,
 '42501', null::text, 'self promotion denied');
select throws_ok($$update public.profiles set department_id = '20000000-0000-4000-8000-000000000002'$$,
 '42501', null::text, 'self department reassignment denied');
select throws_ok($$insert into public.profiles(id,department_id,role) values
 (auth.uid(),'20000000-0000-4000-8000-000000000001','administrador')
 on conflict(id) do update set role = excluded.role$$, '42501', null::text, 'upsert cannot promote');
select throws_ok($$insert into public.board_creation_authorizations(user_id) values(auth.uid())$$,
 '42501', null::text, 'common user cannot authorize creation');
select throws_ok($$select public.create_board('Forbidden','20000000-0000-4000-8000-000000000001')$$,
 '42501', null::text, 'RPC denies unauthorized creation');
select throws_ok($$insert into public.board_memberships(board_id,user_id) values
 ('30000000-0000-4000-8000-000000000001',auth.uid())$$, '42501', null::text, 'cannot self-enroll');
select results_eq($$update public.boards set title='Hacked' where id='30000000-0000-4000-8000-000000000001' returning id$$,
 $$select null::uuid where false$$, 'guessed UUID cannot edit hidden board');
select results_eq($$delete from public.board_memberships where board_id='30000000-0000-4000-8000-000000000001' returning user_id$$,
 $$select null::uuid where false$$, 'outsider cannot remove participants');

-- Gestor is not a system administrator and gains no implicit access.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.boards), 0, 'gestor has no implicit access');
select throws_ok($$insert into public.board_creation_authorizations(user_id) values(auth.uid())$$,
 '42501', null::text, 'gestor cannot self-authorize');
select throws_ok($$select public.create_board('Gestor denied','20000000-0000-4000-8000-000000000002')$$,
 '42501', null::text, 'gestor needs creation authorization');

-- System administrator: global visibility, explicit creation authorization management.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.boards
 where id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')),
 2, 'system administrator sees all boards without membership');
select is((select count(*)::integer from public.board_columns
 where id in ('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002')),
 2, 'system administrator sees all columns');
select is((select count(*)::integer from public.departments
 where id in ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003')),
 3, 'system administrator sees departments');
select lives_ok($$insert into public.board_creation_authorizations(user_id) values
 ('10000000-0000-4000-8000-000000000001')$$, 'system administrator authorizes creator');
select is((select granted_by from public.board_creation_authorizations where user_id='10000000-0000-4000-8000-000000000001'),
 '10000000-0000-4000-8000-000000000004'::uuid, 'grantor comes from authenticated identity');
select throws_ok($$insert into public.board_creation_authorizations(user_id,granted_by) values
 ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002')$$,
 '42501', null::text, 'even administrator cannot forge grantor');
select lives_ok($$insert into public.board_creation_authorizations(user_id) values(auth.uid())$$,
 'system administrator can explicitly authorize own creation');
select lives_ok($$select public.create_board('Admin created','20000000-0000-4000-8000-000000000002')$$,
 'authorized system administrator creates board');
select lives_ok($$insert into public.board_memberships(board_id,user_id) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003')$$,
 'system administrator adds participant from other department');
select results_eq($$update public.boards set description='Global admin edit'
 where id='30000000-0000-4000-8000-000000000002' returning id$$,
 $$select '30000000-0000-4000-8000-000000000002'::uuid$$, 'global administrator edits without membership');

-- Creator administers own board and uses the atomic creation RPC.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.board_creation_authorizations), 1, 'user sees own creation authorization only');
select lives_ok($$select public.create_board('Created via RPC','20000000-0000-4000-8000-000000000001')$$,
 'authorized member creates board');
select is((select created_by from public.boards where title='Created via RPC'), auth.uid(), 'RPC fixes creator identity');
select ok((select m.is_board_admin from public.board_memberships m join public.boards b on b.id=m.board_id
 where b.title='Created via RPC' and m.user_id=auth.uid()), 'RPC returns with creator admin membership already present');
select throws_ok($$insert into public.boards(title,department_id) values('Bypass','20000000-0000-4000-8000-000000000001')$$,
 '42501', null::text, 'even authorized creator cannot bypass RPC');
select throws_ok($$insert into public.boards(title,department_id,created_by) values
 ('Forged','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004')$$,
 '42501', null::text, 'forged board authorship denied');
select throws_ok($$update public.boards set created_by='10000000-0000-4000-8000-000000000004'$$,
 '42501', null::text, 'creator cannot transfer authorship');
select throws_ok($$update public.boards set department_id='20000000-0000-4000-8000-000000000002'$$,
 '42501', null::text, 'board department transfer not exposed');
select results_eq($$update public.boards set description='Creator edit'
 where id='30000000-0000-4000-8000-000000000001' returning id$$,
 $$select '30000000-0000-4000-8000-000000000001'::uuid$$, 'creator can edit own board');
select lives_ok($$insert into public.board_memberships(board_id,user_id) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')$$,
 'board administrator can add participant');
select throws_ok($$insert into public.board_memberships(board_id,user_id) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')$$,
 '23505', null::text, 'duplicate participation rejected');
select throws_ok($$insert into public.board_memberships(board_id,user_id,added_by) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000004')$$,
 '42501', null::text, 'cannot forge membership grantor');
select throws_ok($$insert into public.board_memberships(board_id,user_id,is_board_admin) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005',true)$$,
 '42501', null::text, 'direct admin assignment bypassing RPC blocked');
select lives_ok($$insert into public.board_columns(board_id,title,position,business_state) values
 ('30000000-0000-4000-8000-000000000001','A fazer',1,'a_fazer')$$, 'creator creates linked column');
select results_eq($$update public.board_columns set title='Revised',business_state=null
 where id='40000000-0000-4000-8000-000000000001' returning id$$,
 $$select '40000000-0000-4000-8000-000000000001'::uuid$$, 'creator edits organizational column');
select throws_ok($$update public.board_columns set board_id='30000000-0000-4000-8000-000000000002'$$,
 '42501', null::text, 'column cannot be moved between boards');
select throws_ok($$insert into public.board_columns(board_id,title,position) values
 ('30000000-0000-4000-8000-000000000002','Forbidden',1)$$, '42501', null::text, 'creator cannot administer unrelated board');
select throws_ok('delete from public.boards', '42501', null::text, 'board deletion not exposed');
select throws_ok('delete from public.board_columns', '42501', null::text, 'column deletion not exposed');

-- Participation grants view, not administration, even for a gestor.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.boards), 1, 'authorized cross-department participant sees board');
select is((select count(*)::integer from public.board_columns), 2, 'cross-department participant sees columns');
select is((select count(*)::integer from public.departments), 2, 'own and accessible board departments visible');
select results_eq($$update public.boards set title='Forbidden edit' where id='30000000-0000-4000-8000-000000000001' returning id$$,
 $$select null::uuid where false$$, 'participant cannot edit board');
select results_eq($$update public.board_columns set title='Forbidden edit' where board_id='30000000-0000-4000-8000-000000000001' returning id$$,
 $$select null::uuid where false$$, 'participant cannot edit columns');
select throws_ok($$insert into public.board_columns(board_id,title,position) values
 ('30000000-0000-4000-8000-000000000001','Forbidden',2)$$, '42501', null::text, 'participant cannot create columns');
select throws_ok($$insert into public.board_memberships(board_id,user_id) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005')$$,
 '42501', null::text, 'participant cannot invite another user');
select throws_ok('update public.board_memberships set is_board_admin=true where user_id=auth.uid()',
 '42501', null::text, 'participant cannot promote self');
select results_eq($$delete from public.board_memberships where board_id='30000000-0000-4000-8000-000000000001' returning user_id$$,
 $$select null::uuid where false$$, 'participant cannot remove participants');

-- Ordinary membership has a positive read path but no directory expansion.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.boards), 1, 'authorized same-department participant sees board');
select is((select count(*)::integer from public.board_memberships), 1, 'ordinary participant sees only own membership');

-- Removal by board administrator; then removal by system administrator.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select results_eq($$delete from public.board_memberships where board_id='30000000-0000-4000-8000-000000000001'
 and user_id='10000000-0000-4000-8000-000000000003' returning user_id$$,
 $$select '10000000-0000-4000-8000-000000000003'::uuid$$, 'board administrator removes cross-department member');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.boards), 0, 'revocation immediately removes board visibility');
select is((select count(*)::integer from public.board_columns), 0, 'revocation immediately removes column visibility');
select throws_ok($$insert into public.board_memberships(board_id,user_id) values
 ('30000000-0000-4000-8000-000000000001',auth.uid())$$, '42501', null::text, 'removed member cannot rejoin');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select results_eq($$delete from public.board_memberships where board_id='30000000-0000-4000-8000-000000000001'
 and user_id='10000000-0000-4000-8000-000000000002' returning user_id$$,
 $$select '10000000-0000-4000-8000-000000000002'::uuid$$, 'system administrator removes participant');
select results_eq($$delete from public.board_creation_authorizations where user_id='10000000-0000-4000-8000-000000000001' returning user_id$$,
 $$select '10000000-0000-4000-8000-000000000001'::uuid$$, 'system administrator revokes creation authorization');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.create_board('Revoked','20000000-0000-4000-8000-000000000001')$$,
 '42501', null::text, 'revoked creation denied');
select ok(exists(select 1 from public.boards where id='30000000-0000-4000-8000-000000000001'),
 'creation revocation does not delete independent board membership');
select results_eq($$delete from public.board_creation_authorizations where user_id='10000000-0000-4000-8000-000000000004' returning user_id$$,
 $$select null::uuid where false$$, 'common user cannot revoke another creation authorization');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000006', true);
select is((select count(*)::integer from public.profiles), 0, 'Auth identity alone has no profile');
select is((select count(*)::integer from public.boards), 0, 'Auth identity alone has no boards');
select throws_ok($$select public.create_board('No profile','20000000-0000-4000-8000-000000000001')$$,
 '42501', null::text, 'unprovisioned account cannot create');
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*)::integer from public.boards), 0, 'missing identity exposes no boards');
select throws_ok($$select public.create_board('No identity','20000000-0000-4000-8000-000000000001')$$,
 '42501', null::text, 'missing identity cannot create');
reset role;

-- Fault injection proves board + creator membership roll back as one operation.
create function pg_temp.fail_creator_membership() returns trigger language plpgsql as $$
begin
  if exists(select 1 from public.boards where id=new.board_id and title='Atomic failure') then
    raise exception 'Simulated membership failure' using errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger test_membership_failure before insert on public.board_memberships
 for each row execute function pg_temp.fail_creator_membership();
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select throws_ok($$select public.create_board('Atomic failure','20000000-0000-4000-8000-000000000001')$$,
 'P0001', 'Simulated membership failure', 'creator failure aborts whole RPC');
select is((select count(*)::integer from public.boards where title='Atomic failure'), 0, 'no orphan board after creator failure');
reset role;
select is((select count(*)::integer from public.board_memberships m left join public.boards b on b.id=m.board_id where b.id is null),
 0, 'no orphan memberships after failed transaction');
-- Global administration includes columns; creator removal has no authorship bypass.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select lives_ok($$insert into public.board_columns(board_id,title,position) values
 ('30000000-0000-4000-8000-000000000002','Global admin column',1)$$,
 'system administrator creates column without membership');
select results_eq($$update public.board_columns set title='Global edit'
 where id='40000000-0000-4000-8000-000000000002' returning id$$,
 $$select '40000000-0000-4000-8000-000000000002'::uuid$$, 'system administrator edits column without membership');
select throws_ok($$insert into public.board_memberships(board_id,user_id) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006')$$,
 '23503', null::text, 'participant requires provisioned profile');
select results_eq($$delete from public.board_memberships where board_id='30000000-0000-4000-8000-000000000001'
 and user_id='10000000-0000-4000-8000-000000000001' returning user_id$$,
 $$select '10000000-0000-4000-8000-000000000001'::uuid$$, 'authorized removal also applies to creator');
select ok(exists(select 1 from public.boards where id='30000000-0000-4000-8000-000000000001'),
 'system administrator retains global access after last local admin removal');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.boards where id='30000000-0000-4000-8000-000000000001'),
 0, 'removed creator has no perpetual authorship access');
select results_eq($$update public.boards set title='Removed creator edit'
 where id='30000000-0000-4000-8000-000000000001' returning id$$,
 $$select null::uuid where false$$, 'removed creator cannot administer');
select throws_ok($$insert into public.board_memberships(board_id,user_id) values
 ('30000000-0000-4000-8000-000000000001',auth.uid())$$, '42501', null::text, 'removed creator cannot restore own membership');
reset role;
-- Task 04: append independent scenarios after the original suite's row-count checks.
select throws_ok($$select 'admin'::public.application_role$$, '22P02', null::text,
 'application role is administrador, not admin');
select ok(not has_function_privilege('anon', 'public.promote_board_member(uuid,uuid)', 'EXECUTE'),
 'anon has no promotion RPC privilege');
select ok(not has_column_privilege('authenticated','public.board_memberships','is_board_admin','UPDATE'),
 'no direct UPDATE grant on board admin flag');

set local role anon;
select throws_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000002')$$, '42501', null::text, 'anon cannot promote');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000002')$$, '42501', null::text, 'missing caller cannot promote');

-- Owner of board B adds two ordinary participants from different departments.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
insert into public.board_memberships(board_id,user_id) values
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002'),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');
select throws_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000001')$$, 'P0002', null::text, 'promotion requires existing participation, not just profile');
select is((select count(*)::integer from public.board_memberships where board_id='30000000-0000-4000-8000-000000000002'
 and user_id='10000000-0000-4000-8000-000000000001'), 0, 'promotion never enrolls absent target');
select throws_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000002',auth.uid())$$,
 '42501', null::text, 'operation targets another participant even for local admin');
select throws_ok($$update public.board_memberships set is_board_admin=true where board_id='30000000-0000-4000-8000-000000000002'$$,
 '42501', null::text, 'local administrator cannot bypass controlled promotion');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000002',auth.uid())$$,
 '42501', null::text, 'ordinary participant cannot self-promote through RPC');
select throws_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000003')$$, '42501', null::text, 'ordinary participant cannot promote third party');
select is((select is_board_admin from public.board_memberships where board_id='30000000-0000-4000-8000-000000000002'
 and user_id=auth.uid()), false, 'failed promotion preserves ordinary participation');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000002')$$, '42501', null::text, 'admin of another board cannot promote here');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select lives_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000002')$$, 'local administrator promotes existing cross-department participant');
select ok((select is_board_admin from public.board_memberships where board_id='30000000-0000-4000-8000-000000000002'
 and user_id='10000000-0000-4000-8000-000000000002'), 'promotion stored');
select lives_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000002')$$, 'repeated promotion is harmless');
select is((select added_by from public.board_memberships where board_id='30000000-0000-4000-8000-000000000002'
 and user_id='10000000-0000-4000-8000-000000000002'), auth.uid(), 'promotion preserves original membership grantor');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select role::text from public.profiles), 'membro', 'local promotion does not change application role');
select results_eq($$update public.boards set description='Promoted admin edit'
 where id='30000000-0000-4000-8000-000000000002' returning id$$,
 $$select '30000000-0000-4000-8000-000000000002'::uuid$$, 'promoted admin can administer board');
select lives_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000003')$$, 'promoted administrator can promote another participant');
select throws_ok('update public.board_memberships set is_board_admin=false', '42501', null::text,
 'local administrator cannot demote via direct UPDATE');

-- Board A has no local administrator after the original removal tests.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.board_memberships where board_id='30000000-0000-4000-8000-000000000001'
 and is_board_admin), 0, 'removing last local administrator is allowed');
select throws_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000002')$$, 'P0002', null::text, 'global recovery still requires existing participant');
select lives_ok($$insert into public.board_memberships(board_id,user_id) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')$$,
 'global administrator enrolls recovery participant in empty board');
select lives_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000002')$$, 'global administrator restores local administration');
select ok((select is_board_admin from public.board_memberships where board_id='30000000-0000-4000-8000-000000000001'
 and user_id='10000000-0000-4000-8000-000000000002'), 'recovered board has local administrator');
select throws_ok('update public.board_memberships set is_board_admin=false', '42501', null::text,
 'global administrator cannot use unapproved demotion');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select results_eq($$update public.boards set description='Recovered admin edit'
 where id='30000000-0000-4000-8000-000000000001' returning id$$,
 $$select '30000000-0000-4000-8000-000000000001'::uuid$$, 'recovered admin has effective authority');
select results_eq($$delete from public.board_memberships where board_id='30000000-0000-4000-8000-000000000001'
 and user_id=auth.uid() returning user_id$$, $$select '10000000-0000-4000-8000-000000000002'::uuid$$,
 'last local administrator may remove own participation');
select throws_ok($$select public.promote_board_member('30000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000003')$$, '42501', null::text, 'removed administrator cannot promote');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.board_memberships where board_id='30000000-0000-4000-8000-000000000001'
 and is_board_admin), 0, 'no automatic last-administrator protection');
select ok(vittahub_private.can_manage_board('30000000-0000-4000-8000-000000000001'),
 'global administration survives last administrator self-removal');

-- Explicit creation authorization is required even for global administrators.
delete from public.board_creation_authorizations where user_id=auth.uid();
select throws_ok($$select public.create_board('Global without grant','20000000-0000-4000-8000-000000000001')$$,
 '42501', null::text, 'global department exception does not bypass creation authorization');
insert into public.board_creation_authorizations(user_id) values
 ('10000000-0000-4000-8000-000000000004'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003');
select lives_ok($$select public.create_board('Global other department','20000000-0000-4000-8000-000000000001')$$,
 'authorized global administrator creates in other department');
select is((select department_id from public.boards where title='Global other department'),
 '20000000-0000-4000-8000-000000000001'::uuid, 'global department choice preserved');
select is((select created_by from public.boards where title='Global other department'), auth.uid(), 'global exception preserves authorship');
select throws_ok($$select public.create_board('Invalid department','20000000-0000-4000-8000-000000000099')$$,
 '23503', null::text, 'global department must exist');
select throws_ok($$select public.create_board('Null department',null)$$,
 '42501', null::text, 'null department rejected');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.create_board('Member own department','20000000-0000-4000-8000-000000000001')$$,
 'authorized member creates in own department');
select throws_ok($$select public.create_board('Member wrong department','20000000-0000-4000-8000-000000000002')$$,
 '42501', null::text, 'board admin status and forged metadata do not grant cross-department creation');
select is((select count(*)::integer from public.boards where title='Member wrong department'), 0, 'rejected creation leaves no board');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select lives_ok($$select public.create_board('Gestor own department','20000000-0000-4000-8000-000000000002')$$,
 'authorized gestor creates in own department');
select throws_ok($$select public.create_board('Gestor wrong department','20000000-0000-4000-8000-000000000001')$$,
 '42501', null::text, 'authorized gestor cannot create in another department');
reset role;
select * from finish();
rollback;
