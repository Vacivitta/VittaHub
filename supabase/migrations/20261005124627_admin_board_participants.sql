begin;

-- Administration-specific API. Existing RLS and legacy membership APIs are unchanged.
create function public.list_admin_board_members(p_board_id uuid)
returns table (id uuid, display_name text, is_active boolean, is_board_admin boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  ) or not vittahub_private.can_manage_board_structure(p_board_id)
    or not exists (select 1 from public.boards b where b.id = p_board_id) then
    raise exception 'Board administration required' using errcode = '42501';
  end if;
  return query select p.id, p.display_name, p.is_active, m.is_board_admin
    from public.board_memberships m join public.profiles p on p.id = m.user_id
    where m.board_id = p_board_id order by p.display_name nulls last, p.id;
end;
$$;

create function public.manage_admin_board_member(p_board_id uuid, p_user_id uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller public.profiles%rowtype;
  target public.profiles%rowtype;
  membership public.board_memberships%rowtype;
begin
  -- Lock profile and administrative membership so revocation cannot race this operation.
  select p.* into caller from public.profiles p where p.id = auth.uid() for share;
  if auth.uid() is null or not found or not caller.is_active
    or caller.role not in ('gestor', 'administrador') then
    raise exception 'Administrative access required' using errcode = '42501';
  end if;
  perform 1 from public.boards b where b.id = p_board_id for key share;
  if not found then
    raise exception 'Board administration required' using errcode = '42501';
  end if;
  if caller.role <> 'administrador' then
    perform 1 from public.board_memberships m
      where m.board_id = p_board_id and m.user_id = caller.id and m.is_board_admin for share;
    if not found then
      raise exception 'Board administration required' using errcode = '42501';
    end if;
  end if;
  if p_action is null or p_action not in ('add', 'remove', 'promote') then
    raise exception 'Unsupported membership operation' using errcode = '22023';
  end if;
  select p.* into target from public.profiles p where p.id = p_user_id for share;
  if not found then
    raise exception 'Participant unavailable' using errcode = '22023';
  end if;
  if p_action in ('add', 'promote') and not target.is_active then
    raise exception 'Participant unavailable' using errcode = '22023';
  end if;
  if p_action = 'add' then
    -- Reuse the existing directory scope, including authorized cross-department people.
    if not exists (select 1 from public.list_admin_team_members() p where p.id = p_user_id and p.is_active) then
      raise exception 'Participant unavailable' using errcode = '22023';
    end if;
    insert into public.board_memberships(board_id, user_id, is_board_admin, added_by)
      values (p_board_id, p_user_id, false, caller.id);
  else
    select m.* into membership from public.board_memberships m
      where m.board_id = p_board_id and m.user_id = p_user_id for update;
    if not found or membership.is_board_admin then
      raise exception 'Ordinary participant required' using errcode = '22023';
    end if;
    if p_action = 'remove' then
      delete from public.board_memberships where board_id = p_board_id and user_id = p_user_id and not is_board_admin;
    else
      perform public.promote_board_member(p_board_id, p_user_id);
    end if;
  end if;
end;
$$;

alter function public.list_admin_board_members(uuid) owner to postgres;
alter function public.manage_admin_board_member(uuid, uuid, text) owner to postgres;
revoke all on function public.list_admin_board_members(uuid) from public, anon, authenticated;
revoke all on function public.manage_admin_board_member(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.list_admin_board_members(uuid) to authenticated;
grant execute on function public.manage_admin_board_member(uuid, uuid, text) to authenticated;
commit;
