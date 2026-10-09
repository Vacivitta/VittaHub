begin;
-- Read RPCs retain their STABLE contract; only mutations need the transaction
-- serialization/profile lock. RLS and read helpers use the current statement snapshot.
do $$ declare f record; source text; begin
 for f in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 join pg_proc i on i.proname='impl_'||p.proname and i.proargtypes=p.proargtypes
 join pg_namespace ni on ni.oid=i.pronamespace
 where n.nspname='public' and ni.nspname='vittahub_private' and i.provolatile='s'
 loop
   source:=pg_get_functiondef(f.oid);
   source:=replace(source,'perform pg_catalog.pg_advisory_xact_lock(2727,1); perform vittahub_private.require_active_user();',
     'if not vittahub_private.is_active_user() then raise exception ''Operational access denied'' using errcode=''42501''; end if;');
   execute source;
   execute format('alter function public.%I(%s) stable',f.proname,f.args);
 end loop;
end $$;
commit;
