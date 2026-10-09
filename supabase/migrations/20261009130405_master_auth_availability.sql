begin;
create or replace function vittahub_private.valid_master() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from vittahub_private.master_account m
 join public.profiles p on p.id=m.user_id join auth.users u on u.id=p.id
 where p.is_active and p.role='administrador' and u.deleted_at is null
   and (u.banned_until is null or u.banned_until<=statement_timestamp()));
$$;
create or replace function vittahub_private.validate_master_designation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles p join auth.users u on u.id=p.id
 where p.id=new.user_id and p.is_active and p.role='administrador' and u.deleted_at is null
   and (u.banned_until is null or u.banned_until<=statement_timestamp()) for share of p,u;
 if not found then raise exception 'Master must be an available active administrator' using errcode='42501'; end if;
 return new;
end;
$$;
commit;
