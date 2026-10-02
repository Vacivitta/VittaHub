begin;

create function public.list_admin_team_members()
returns table (
  id uuid, display_name text, role public.application_role, is_active boolean,
  department_id uuid, department_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller public.profiles%rowtype;
begin
  select p.* into caller from public.profiles p where p.id = caller_id;
  if caller_id is null or not found or not caller.is_active
    or caller.role not in ('gestor', 'administrador') then
    raise exception 'Administrative access required' using errcode = '42501';
  end if;

  return query
  select p.id, p.display_name, p.role, p.is_active, p.department_id, d.name
  from public.profiles p
  join public.departments d on d.id = p.department_id
  where caller.role = 'administrador'
    or p.department_id = caller.department_id
    or exists (
      select 1 from public.board_memberships m
      where m.user_id = p.id
        and vittahub_private.can_manage_board_structure(m.board_id)
    )
  order by p.display_name nulls last, p.id;
end;
$$;

alter function public.list_admin_team_members() owner to postgres;
revoke all on function public.list_admin_team_members() from public, anon, authenticated;
grant execute on function public.list_admin_team_members() to authenticated;

commit;
