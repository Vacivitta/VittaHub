begin;
create function vittahub_private.validate_master_designation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles where id=new.user_id and is_active and role='administrador' for share;
 if not found then raise exception 'Master must be an active administrator' using errcode='42501'; end if;
 return new;
end;
$$;
create trigger validate_master_designation before insert or update on vittahub_private.master_account
 for each row execute function vittahub_private.validate_master_designation();

-- Direct writes that remain intentionally available under RLS also lock the
-- caller profile so deactivation waits for an already authorized mutation.
create function vittahub_private.guard_direct_employee_write() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)='authenticated' then perform vittahub_private.require_active_user(); end if;
 if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
create trigger active_membership_write before insert or update or delete on public.board_memberships
 for each row execute function vittahub_private.guard_direct_employee_write();
create trigger active_authorization_write before insert or update or delete on public.board_creation_authorizations
 for each row execute function vittahub_private.guard_direct_employee_write();
revoke all on function vittahub_private.validate_master_designation(),vittahub_private.guard_direct_employee_write() from public,anon,authenticated;
commit;
