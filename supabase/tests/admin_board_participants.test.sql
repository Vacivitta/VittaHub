-- Task 22C.1: fictional fixtures, local transactional tests.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into public.departments(id,name) values ('f2000000-0000-4000-8000-000000000001','Directory A'),('f2000000-0000-4000-8000-000000000002','Directory B');
insert into auth.users(id) values ('f1000000-0000-4000-8000-000000000001'),('f1000000-0000-4000-8000-000000000002'),('f1000000-0000-4000-8000-000000000003'),('f1000000-0000-4000-8000-000000000004'),('f1000000-0000-4000-8000-000000000005'),('f1000000-0000-4000-8000-000000000006'),('f1000000-0000-4000-8000-000000000007'),('f1000000-0000-4000-8000-000000000008'),('f1000000-0000-4000-8000-000000000009'),('f1000000-0000-4000-8000-000000000010');
insert into public.profiles(id,department_id,display_name,role,is_active) values
('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','Manager A','gestor',true),
('f1000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','Member A','membro',true),
('f1000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000001','Inactive A','membro',false),
('f1000000-0000-4000-8000-000000000004','f2000000-0000-4000-8000-000000000002','Manager B','gestor',true),
('f1000000-0000-4000-8000-000000000005','f2000000-0000-4000-8000-000000000002','Cross B','membro',true),
('f1000000-0000-4000-8000-000000000006','f2000000-0000-4000-8000-000000000002','Excluded B','membro',true),
('f1000000-0000-4000-8000-000000000007','f2000000-0000-4000-8000-000000000002','Admin B','administrador',true),
('f1000000-0000-4000-8000-000000000008','f2000000-0000-4000-8000-000000000002','Inactive manager','gestor',false),
('f1000000-0000-4000-8000-000000000010','f2000000-0000-4000-8000-000000000002','Inactive cross','membro',false);
insert into public.boards(id,department_id,title,created_by) values
('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','Managed cross department','f1000000-0000-4000-8000-000000000001'),
('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','Managed second','f1000000-0000-4000-8000-000000000001'),
('f3000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000001','Authored but only participant','f1000000-0000-4000-8000-000000000001');
update public.board_memberships set is_board_admin=false where board_id='f3000000-0000-4000-8000-000000000003';
insert into public.board_memberships(board_id,user_id,is_board_admin,added_by) values
('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000005',false,'f1000000-0000-4000-8000-000000000001'),
('f3000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000005',false,'f1000000-0000-4000-8000-000000000001'),
('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002',false,'f1000000-0000-4000-8000-000000000001'),
('f3000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002',false,'f1000000-0000-4000-8000-000000000001'),
('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000010',false,'f1000000-0000-4000-8000-000000000001'),
('f3000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000004',true,'f1000000-0000-4000-8000-000000000001'),
('f3000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000006',false,'f1000000-0000-4000-8000-000000000001');

create temporary table profiles_before as select jsonb_agg(to_jsonb(p) order by id) as snapshot from public.profiles p;
select ok(not has_function_privilege('anon','public.list_admin_board_members(uuid)','EXECUTE'), 'anon cannot list');
select ok(not has_function_privilege('anon','public.manage_admin_board_member(uuid,uuid,text)','EXECUTE'), 'anon cannot mutate');
select ok(p.prosecdef and p.proconfig @> array['search_path=""'] and pg_get_userbyid(p.proowner) = 'postgres', 'secured function owner and search path') from pg_proc p where p.oid in ('public.list_admin_board_members(uuid)'::regprocedure,'public.manage_admin_board_member(uuid,uuid,text)'::regprocedure);
select ok(not exists(select 1 from pg_proc p, lateral aclexplode(p.proacl) a where p.oid in ('public.list_admin_board_members(uuid)'::regprocedure,'public.manage_admin_board_member(uuid,uuid,text)'::regprocedure) and a.grantee=0 and a.privilege_type='EXECUTE'), 'PUBLIC has no execution');
set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
select is((select count(*)::int from public.list_admin_board_members('f3000000-0000-4000-8000-000000000001')),4,'manager lists managed cross-department board');
select throws_ok($$select public.list_admin_board_members('f3000000-0000-4000-8000-000000000003')$$,'42501',null::text,'authorship and common membership do not grant management');
select throws_ok(format('select public.manage_admin_board_member(%L,%L,%L)','f3000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000006',a),'42501',null::text,'forged board rejected for '||a) from unnest(array['add','remove','promote']) a;
select throws_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000006','add')$$,'22023',null::text,'forged out-of-directory target rejected');
select throws_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000003','add')$$,'22023',null::text,'inactive target cannot gain membership');
select throws_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000010','promote')$$,'22023',null::text,'inactive member cannot be promoted');
select throws_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','remove')$$,'22023',null::text,'cannot remove board administrator');
select throws_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','demote')$$,'22023',null::text,'no demotion action');
select lives_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','remove')$$,'remove common participant');
select ok(not exists(select 1 from public.board_memberships where board_id='f3000000-0000-4000-8000-000000000001' and user_id='f1000000-0000-4000-8000-000000000002'),'membership removed');
select throws_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','promote')$$,'22023',null::text,'promotion cannot create participation');
select lives_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','add')$$,'add eligible participant');
select is((select is_board_admin from public.board_memberships where board_id='f3000000-0000-4000-8000-000000000001' and user_id='f1000000-0000-4000-8000-000000000002'),false,'addition is always common');
select is((select added_by from public.board_memberships where board_id='f3000000-0000-4000-8000-000000000001' and user_id='f1000000-0000-4000-8000-000000000002'),auth.uid(),'actor derived from session');
select throws_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','add')$$,'23505',null::text,'duplicate addition fails');
select lives_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','promote')$$,'promote existing participant');
select is((select is_board_admin from public.board_memberships where board_id='f3000000-0000-4000-8000-000000000001' and user_id='f1000000-0000-4000-8000-000000000002'),true,'promotion persisted');
select is((select is_board_admin from public.board_memberships where board_id='f3000000-0000-4000-8000-000000000002' and user_id='f1000000-0000-4000-8000-000000000002'),false,'other board unaffected');
select lives_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000010','remove')$$,'inactive common participant may be removed');
select is((select count(*)::int from public.profiles),1,'profile RLS unchanged');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.list_admin_board_members('f3000000-0000-4000-8000-000000000001')$$,'42501',null::text,'global member even as local admin cannot access Administration API');
select throws_ok(format('select public.manage_admin_board_member(%L,%L,%L)','f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000005',a),'42501',null::text,'member rejected for '||a) from unnest(array['add','remove','promote']) a;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000008',true);
select throws_ok($$select public.list_admin_board_members('f3000000-0000-4000-8000-000000000001')$$,'42501',null::text,'inactive manager listing denied');
select throws_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000005','remove')$$,'42501',null::text,'inactive manager mutation denied');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.list_admin_board_members('f3000000-0000-4000-8000-000000000001')$$,'42501',null::text,'no session listing denied');
select throws_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000005','add')$$,'42501',null::text,'no session mutation denied');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000007',true);
select lives_ok($$select public.list_admin_board_members('f3000000-0000-4000-8000-000000000003')$$,'global admin lists without participation');
select lives_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000006','add')$$,'global admin adds across departments');
select lives_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000006','promote')$$,'global admin promotes without membership');
select throws_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000006','remove')$$,'22023',null::text,'even global admin cannot remove administrator via new API');
reset role;
select is((select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),(select snapshot from profiles_before),'profiles roles departments and active status unchanged');
delete from public.board_memberships where board_id='f3000000-0000-4000-8000-000000000001' and user_id='f1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.list_admin_board_members('f3000000-0000-4000-8000-000000000001')$$,'42501',null::text,'revoked manager loses list access immediately');
select throws_ok($$select public.manage_admin_board_member('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000005','remove')$$,'42501',null::text,'revoked manager loses mutation access immediately');
select * from finish();
rollback;
