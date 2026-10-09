begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.departments(id,name) values('27100000-0000-4000-8000-000000000001','Inactive fixtures');
insert into auth.users(id) select ('27100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(11,13) i;
insert into public.profiles(id,department_id,display_name,role,is_active)
select ('27100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'27100000-0000-4000-8000-000000000001','Inactive fixture',
 case i when 11 then 'membro'::public.application_role when 12 then 'gestor'::public.application_role else 'administrador'::public.application_role end,false
from generate_series(11,13) i;
-- Enumerate application RPCs, excluding the deliberately minimal access-status endpoint.
create temp table tested_rpcs as
select p.proname,format('select public.%I(%s)',p.proname,
 (select string_agg('null::'||t::regtype::text,',') from unnest(p.proargtypes::oid[]) t)) as call
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' and p.proname<>'employee_access_status'
and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e');
create temp table tested_tables as select tablename from pg_tables where schemaname='public';
grant select on tested_rpcs,tested_tables to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','27100000-0000-4000-8000-000000000011',true);
select is(public.employee_access_status(),false,'inactive member status');
select throws_ok(call,'42501',null::text,'inactive member denied '||proname) from tested_rpcs;
select results_eq(format('select count(*)::int from public.%I',tablename),'select 0::int','inactive member cannot read '||tablename) from tested_tables;
select set_config('request.jwt.claim.sub','27100000-0000-4000-8000-000000000012',true);
select is(public.employee_access_status(),false,'inactive manager status');
select results_eq(format('select count(*)::int from public.%I',tablename),'select 0::int','inactive manager cannot read '||tablename) from tested_tables;
select throws_ok(call,'42501',null::text,'inactive manager denied '||proname) from tested_rpcs;
select set_config('request.jwt.claim.sub','27100000-0000-4000-8000-000000000013',true);
select is(public.employee_access_status(),false,'inactive administrator status');
select results_eq(format('select count(*)::int from public.%I',tablename),'select 0::int','inactive administrator cannot read '||tablename) from tested_tables;
select throws_ok(call,'42501',null::text,'inactive administrator denied '||proname) from tested_rpcs;
select is(vittahub_private.is_system_admin(),false,'inactive admin helper denied');
select throws_ok($$insert into public.board_creation_authorizations(user_id) values('27100000-0000-4000-8000-000000000011')$$,'42501',null::text,'inactive admin cannot grant creation');
reset role;
select * from finish();
rollback;
