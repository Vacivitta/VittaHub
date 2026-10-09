begin;

create table vittahub_private.employee_session_cutoffs (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  login_after timestamptz not null
);
create table vittahub_private.master_account (
  singleton boolean primary key default true check(singleton),
  user_id uuid not null unique references public.profiles(id) on delete restrict
);
create table vittahub_private.employee_delegations (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz
);
create table vittahub_private.employee_security_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  target_id uuid not null references public.profiles(id),
  action text not null,
  occurred_at timestamptz not null default clock_timestamp(),
  details jsonb not null default '{}'
);
alter table vittahub_private.employee_session_cutoffs enable row level security;
alter table vittahub_private.master_account enable row level security;
alter table vittahub_private.employee_delegations enable row level security;
alter table vittahub_private.employee_security_events enable row level security;
revoke all on all tables in schema vittahub_private from public, anon, authenticated;
revoke all on all sequences in schema vittahub_private from public, anon, authenticated;

create function vittahub_private.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active
    and not exists(select 1 from vittahub_private.employee_session_cutoffs c
      where c.user_id=p.id and not exists(select 1 from auth.sessions s
        where s.id::text=auth.jwt()->>'session_id' and s.user_id=p.id
          and s.created_at>c.login_after)));
$$;
create function vittahub_private.require_active_user() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id=auth.uid() for share;
  if not vittahub_private.is_active_user() then
    raise exception 'Operational access denied' using errcode='42501';
  end if;
end;
$$;
revoke all on function vittahub_private.is_active_user(), vittahub_private.require_active_user() from public,anon,authenticated;
grant execute on function vittahub_private.is_active_user() to authenticated;

-- One mandatory AND barrier, independent of existing permissive OR policies.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('create policy active_employee_required on public.%I as restrictive for all to authenticated using (vittahub_private.is_active_user()) with check (vittahub_private.is_active_user())',t.tablename);
  end loop;
end $$;

create or replace function vittahub_private.is_system_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select vittahub_private.is_active_user() and exists(select 1 from public.profiles where id=auth.uid() and role='administrador');
$$;
create or replace function vittahub_private.can_view_board(target_board_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select vittahub_private.is_active_user() and (vittahub_private.is_system_admin() or exists(select 1 from public.board_memberships where board_id=target_board_id and user_id=auth.uid()));
$$;
create or replace function vittahub_private.can_manage_board(target_board_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select vittahub_private.is_active_user() and (vittahub_private.is_system_admin() or exists(select 1 from public.board_memberships where board_id=target_board_id and user_id=auth.uid() and is_board_admin));
$$;
create or replace function vittahub_private.can_access_conversation(target_conversation_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select vittahub_private.is_active_user() and exists(select 1 from public.conversation_participants where conversation_id=target_conversation_id and user_id=auth.uid());
$$;

-- Preserve existing implementations and contracts behind a single checked entry.
-- Shared transaction lock serializes RPCs with security mutations (four-user MVP).
do $$ declare f record; args text; invocation text; body text; begin
 for f in select p.oid,p.proname,p.proretset,p.prorettype,p.proargnames,
   pg_get_function_arguments(p.oid) declaration,pg_get_function_identity_arguments(p.oid) identity_args,
   pg_get_function_result(p.oid) result
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prokind='f'
     and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
 loop
   select string_agg(format('$%s',i),',') into args from generate_series(1,(select pronargs from pg_proc where oid=f.oid)) i;
   execute format('alter function public.%I(%s) rename to %I',f.proname,f.identity_args,'impl_'||f.proname);
   execute format('alter function public.%I(%s) set schema vittahub_private','impl_'||f.proname,f.identity_args);
   execute format('revoke all on function vittahub_private.%I(%s) from public,anon,authenticated','impl_'||f.proname,f.identity_args);
   invocation:=format('vittahub_private.%I(%s)','impl_'||f.proname,coalesce(args,''));
   body:='begin perform pg_catalog.pg_advisory_xact_lock(2727,1); perform vittahub_private.require_active_user(); ';
   if f.proretset then body:=body||'return query select * from '||invocation||';';
   elsif f.prorettype='void'::regtype then body:=body||'perform '||invocation||'; return;';
   else body:=body||'return '||invocation||';'; end if;
   execute format('create function public.%I(%s) returns %s language plpgsql security definer set search_path=%L as %L',f.proname,f.declaration,f.result,'',body||' end;');
   execute format('revoke all on function public.%I(%s) from public,anon,authenticated',f.proname,f.identity_args);
   execute format('grant execute on function public.%I(%s) to authenticated',f.proname,f.identity_args);
 end loop;
end $$;

create function vittahub_private.valid_master() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from vittahub_private.master_account m join public.profiles p on p.id=m.user_id where p.is_active and p.role='administrador');
$$;
create function vittahub_private.is_master() returns boolean language sql stable security definer set search_path='' as $$
 select vittahub_private.is_active_user() and vittahub_private.valid_master() and exists(select 1 from vittahub_private.master_account where user_id=auth.uid());
$$;
create function vittahub_private.activation_manager() returns boolean language sql stable security definer set search_path='' as $$
 select vittahub_private.is_master() or (vittahub_private.is_active_user() and vittahub_private.valid_master()
 and exists(select 1 from vittahub_private.employee_delegations d join public.profiles p on p.id=d.user_id
 where d.user_id=auth.uid() and d.revoked_at is null and p.role in ('gestor','administrador')));
$$;

create function vittahub_private.protect_employee_security() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from vittahub_private.master_account where user_id=old.id)
   and (not new.is_active or new.role<>'administrador') then
   raise exception 'Transfer the master designation first' using errcode='42501';
 end if;
 if old.is_active is distinct from new.is_active then
   if not new.is_active and old.id=auth.uid() then raise exception 'Self deactivation denied' using errcode='42501'; end if;
   insert into vittahub_private.employee_session_cutoffs values(old.id,clock_timestamp())
     on conflict(user_id) do update set login_after=excluded.login_after;
   insert into vittahub_private.employee_security_events(actor_id,target_id,action,details)
     values(auth.uid(),old.id,case when new.is_active then 'activated' else 'deactivated' end,
       jsonb_build_object('before',old.is_active,'after',new.is_active,'database_operator',session_user));
 end if;
 if not new.is_active or new.role not in ('gestor','administrador') then
   update vittahub_private.employee_delegations set revoked_at=clock_timestamp() where user_id=old.id and revoked_at is null;
   if found then insert into vittahub_private.employee_security_events(actor_id,target_id,action,details)
     values(auth.uid(),old.id,'delegation_revoked','{"reason":"eligibility_lost"}'); end if;
 end if;
 return new;
end;
$$;
create trigger protect_employee_security before update of is_active,role on public.profiles
 for each row execute function vittahub_private.protect_employee_security();

create function public.employee_access_status() returns boolean language sql stable security definer set search_path='' as $$
 select vittahub_private.is_active_user();
$$;
create function public.employee_security_context() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform vittahub_private.require_active_user();
 return jsonb_build_object('is_master',vittahub_private.is_master(),'can_manage',vittahub_private.activation_manager());
end;
$$;
create function public.list_employee_security() returns table(id uuid,display_name text,role public.application_role,is_active boolean,delegated boolean,is_master boolean,can_toggle boolean)
language plpgsql security definer set search_path='' as $$
begin
 perform vittahub_private.require_active_user();
 if not vittahub_private.activation_manager() then raise exception 'Employee management denied' using errcode='42501'; end if;
 return query select p.id,p.display_name,p.role,p.is_active,d.user_id is not null,m.user_id is not null,
   p.id<>auth.uid() and m.user_id is null and (vittahub_private.is_master() or (p.role in ('membro','gestor') and d.user_id is null))
 from public.profiles p left join vittahub_private.employee_delegations d on d.user_id=p.id and d.revoked_at is null
 left join vittahub_private.master_account m on m.user_id=p.id
 where vittahub_private.is_master() or (p.role in ('membro','gestor') and d.user_id is null and m.user_id is null)
 order by p.display_name,p.id;
end;
$$;
create function public.change_employee_security(p_target_id uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare target public.profiles; master boolean; delegated boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(2727,1);
 perform vittahub_private.require_active_user();
 master:=vittahub_private.is_master();
 if not vittahub_private.activation_manager() then raise exception 'Employee management denied' using errcode='42501'; end if;
 select * into target from public.profiles where id=p_target_id for update;
 if not found then raise exception 'Employee unavailable' using errcode='42501'; end if;
 select exists(select 1 from vittahub_private.employee_delegations where user_id=p_target_id and revoked_at is null) into delegated;
 if p_action in ('grant','revoke') then
   if not master then raise exception 'Master required' using errcode='42501'; end if;
   if p_action='grant' then
     if not target.is_active or target.role not in ('gestor','administrador') or p_target_id=auth.uid() then
       raise exception 'Ineligible employee' using errcode='42501'; end if;
     if delegated then return; end if;
     insert into vittahub_private.employee_delegations(user_id,granted_by) values(p_target_id,auth.uid())
       on conflict(user_id) do update set granted_by=auth.uid(),granted_at=clock_timestamp(),revoked_at=null;
   else
     if not delegated then return; end if;
     update vittahub_private.employee_delegations set revoked_at=clock_timestamp() where user_id=p_target_id;
   end if;
   insert into vittahub_private.employee_security_events(actor_id,target_id,action)
     values(auth.uid(),p_target_id,case when p_action='grant' then 'delegation_granted' else 'delegation_revoked' end);
 elsif p_action in ('activate','deactivate') then
   if p_target_id=auth.uid() or exists(select 1 from vittahub_private.master_account where user_id=p_target_id)
     or (not master and (target.role='administrador' or delegated)) then
     raise exception 'Employee change denied' using errcode='42501'; end if;
   update public.profiles set is_active=(p_action='activate') where id=p_target_id and is_active is distinct from (p_action='activate');
 else raise exception 'Unsupported action' using errcode='22023'; end if;
end;
$$;
create function public.list_employee_security_history() returns setof vittahub_private.employee_security_events
language plpgsql security definer set search_path='' as $$
begin
 perform vittahub_private.require_active_user();
 if not vittahub_private.activation_manager() then raise exception 'Employee management denied' using errcode='42501'; end if;
 return query select e.* from vittahub_private.employee_security_events e
 where vittahub_private.is_master() or e.actor_id=auth.uid() order by e.id desc limit 100;
end;
$$;
revoke all on function vittahub_private.valid_master(),vittahub_private.is_master(),vittahub_private.activation_manager(),vittahub_private.protect_employee_security() from public,anon,authenticated;
revoke all on function public.employee_access_status(),public.employee_security_context(),public.list_employee_security(),public.change_employee_security(uuid,text),public.list_employee_security_history() from public,anon,authenticated;
grant execute on function public.employee_access_status(),public.employee_security_context(),public.list_employee_security(),public.change_employee_security(uuid,text),public.list_employee_security_history() to authenticated;
commit;
