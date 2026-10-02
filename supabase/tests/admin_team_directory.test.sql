-- Task 22B. Fictional fixtures; every change is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select ok(not has_function_privilege('anon', 'public.list_admin_team_members()', 'EXECUTE'), 'anon has no execute');
select ok(not exists(select 1 from pg_proc p, lateral aclexplode(p.proacl) a where p.oid = 'public.list_admin_team_members()'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'), 'PUBLIC has no execute');
select ok(has_function_privilege('authenticated', 'public.list_admin_team_members()', 'EXECUTE'), 'authenticated has execute');
select ok(p.prosecdef and p.provolatile = 's' and p.proconfig @> array['search_path=""'] and pg_get_userbyid(p.proowner) = 'postgres' and p.pronargs = 0, 'read-only stable definer, empty search path, postgres owner, no caller parameters') from pg_proc p where p.oid = 'public.list_admin_team_members()'::regprocedure;
select ok(not has_function_privilege('authenticated', 'vittahub_private.can_manage_board_structure(uuid)', 'EXECUTE'), 'private helper remains private');
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
create temporary table directory_before as select jsonb_agg(to_jsonb(p) order by id) as profiles from public.profiles p;
create temporary table directory_count as select count(*)::integer as total from public.profiles;
grant select on directory_count to authenticated;
set local role anon;
select throws_ok($$select public.list_admin_team_members()$$,'42501',null::text,'anonymous rejected');
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.list_admin_team_members()$$,'42501',null::text,'no session rejected');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.list_admin_team_members()$$,'42501',null::text,'member rejected');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000009',true);
select throws_ok($$select public.list_admin_team_members()$$,'42501',null::text,'missing profile rejected');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000008',true);
select throws_ok($$select public.list_admin_team_members()$$,'42501',null::text,'inactive manager rejected');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
select results_eq($$select id from public.list_admin_team_members() order by id$$, $$values ('f1000000-0000-4000-8000-000000000001'::uuid),('f1000000-0000-4000-8000-000000000002'::uuid),('f1000000-0000-4000-8000-000000000003'::uuid),('f1000000-0000-4000-8000-000000000005'::uuid),('f1000000-0000-4000-8000-000000000010'::uuid)$$, 'manager sees own department plus actual managed participants, not board department, authorship or common membership');
select is((select count(*)::integer from public.list_admin_team_members() where id='f1000000-0000-4000-8000-000000000005'),1,'cross-department person in multiple boards appears once');
select is((select count(*)::integer from public.list_admin_team_members() where id='f1000000-0000-4000-8000-000000000002'),1,'department plus multiple memberships appears once');
select is((select is_active from public.list_admin_team_members() where id='f1000000-0000-4000-8000-000000000010'),false,'inactive cross-department target is visible');
select is((select department_name from public.list_admin_team_members() where id='f1000000-0000-4000-8000-000000000005'),'Directory B','department metadata returned by RPC');
select is((select count(*)::integer from public.profiles),1,'direct profiles RLS remains self-only');
select set_config('request.jwt.claims','{"role":"authenticated","user_metadata":{"role":"administrador","department_id":"f2000000-0000-4000-8000-000000000002","caller_id":"f1000000-0000-4000-8000-000000000007"},"app_metadata":{"role":"administrador"}}',true);
select results_eq($$select id from public.list_admin_team_members() order by id$$, $$values ('f1000000-0000-4000-8000-000000000001'::uuid),('f1000000-0000-4000-8000-000000000002'::uuid),('f1000000-0000-4000-8000-000000000003'::uuid),('f1000000-0000-4000-8000-000000000005'::uuid),('f1000000-0000-4000-8000-000000000010'::uuid)$$, 'forged metadata cannot expand scope');
select throws_ok($$select public.list_admin_team_members(caller_id => 'forged')$$,'42883',null::text,'no forged caller_id parameter');
select throws_ok($$select public.list_admin_team_members(role => 'forged')$$,'42883',null::text,'no forged role parameter');
select throws_ok($$select public.list_admin_team_members(department_id => 'forged')$$,'42883',null::text,'no forged department_id parameter');
select throws_ok($$update public.list_admin_team_members() set is_active=false$$,'42601',null::text,'listing cannot be an update target');
reset role;
select is((select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),(select profiles from directory_before),'listing did not modify profiles');
update public.board_memberships set is_board_admin=false where board_id='f3000000-0000-4000-8000-000000000001' and user_id='f1000000-0000-4000-8000-000000000001';
set local role authenticated;
select results_eq($$select id from public.list_admin_team_members() order by id$$, $$values ('f1000000-0000-4000-8000-000000000001'::uuid),('f1000000-0000-4000-8000-000000000002'::uuid),('f1000000-0000-4000-8000-000000000003'::uuid),('f1000000-0000-4000-8000-000000000005'::uuid)$$, 'revoked management removes inactive cross target while second board still grants access');
reset role;
delete from public.board_memberships where board_id='f3000000-0000-4000-8000-000000000002' and user_id='f1000000-0000-4000-8000-000000000005';
set local role authenticated;
select results_eq($$select id from public.list_admin_team_members() order by id$$, $$values ('f1000000-0000-4000-8000-000000000001'::uuid),('f1000000-0000-4000-8000-000000000002'::uuid),('f1000000-0000-4000-8000-000000000003'::uuid)$$, 'removing target membership revokes cross-department access');
reset role;
update public.profiles set department_id='f2000000-0000-4000-8000-000000000002' where id='f1000000-0000-4000-8000-000000000002';
set local role authenticated;
select results_eq($$select id from public.list_admin_team_members() order by id$$, $$values ('f1000000-0000-4000-8000-000000000001'::uuid),('f1000000-0000-4000-8000-000000000002'::uuid),('f1000000-0000-4000-8000-000000000003'::uuid)$$, 'target moving department remains visible through managed board');
reset role;
delete from public.board_memberships where board_id='f3000000-0000-4000-8000-000000000002' and user_id='f1000000-0000-4000-8000-000000000001';
set local role authenticated;
select results_eq($$select id from public.list_admin_team_members() order by id$$, $$values ('f1000000-0000-4000-8000-000000000001'::uuid),('f1000000-0000-4000-8000-000000000003'::uuid)$$, 'removing caller administrative membership revokes access despite authorship');
reset role;
update public.profiles set department_id='f2000000-0000-4000-8000-000000000002' where id='f1000000-0000-4000-8000-000000000001';
set local role authenticated;
select results_eq($$select id from public.list_admin_team_members() order by id$$, $$values ('f1000000-0000-4000-8000-000000000001'::uuid),('f1000000-0000-4000-8000-000000000002'::uuid),('f1000000-0000-4000-8000-000000000004'::uuid),('f1000000-0000-4000-8000-000000000005'::uuid),('f1000000-0000-4000-8000-000000000006'::uuid),('f1000000-0000-4000-8000-000000000007'::uuid),('f1000000-0000-4000-8000-000000000008'::uuid),('f1000000-0000-4000-8000-000000000010'::uuid)$$, 'caller department change is effective on next call');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000007',true);
select is((select count(*)::integer from public.list_admin_team_members()),(select total from directory_count),'active administrator sees every provisioned profile');
select is((select count(*)::integer from public.list_admin_team_members() where id in ('f1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000008','f1000000-0000-4000-8000-000000000010') and not is_active),3,'administrator includes inactive targets');
reset role;
update public.profiles set is_active=false where id='f1000000-0000-4000-8000-000000000007';
set local role authenticated;
select throws_ok($$select public.list_admin_team_members()$$,'42501',null::text,'inactive administrator rejected');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
reset role;
update public.profiles set role='membro' where id='f1000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.list_admin_team_members()$$,'42501',null::text,'role revocation effective despite forged claims');
reset role;
select * from finish();
rollback;
