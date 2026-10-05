begin;

-- Column capability is deliberately separate from board editing and task permissions.
create function vittahub_private.can_manage_board_columns(target_board_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
    and exists (select 1 from public.boards b where b.id = target_board_id)
    and vittahub_private.can_manage_board(target_board_id);
$$;
alter function vittahub_private.can_manage_board_columns(uuid) owner to postgres;
revoke all on function vittahub_private.can_manage_board_columns(uuid) from public, anon, authenticated;

create function public.can_manage_board_columns(p_board_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select vittahub_private.can_manage_board_columns(p_board_id);
$$;
alter function public.can_manage_board_columns(uuid) owner to postgres;
revoke all on function public.can_manage_board_columns(uuid) from public, anon, authenticated;
grant execute on function public.can_manage_board_columns(uuid) to authenticated;

create or replace function public.create_board_column(p_board_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_column_id uuid;
  next_position integer;
begin
  if auth.uid() is null
    or not vittahub_private.can_manage_board_columns(p_board_id) then
    raise exception 'Board management is required' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Column name is required' using errcode = '22023';
  end if;

  -- Serializes position allocation per board without introducing ordering features.
  perform 1 from public.boards b where b.id = p_board_id for update;
  select coalesce(max(c.position), -1) + 1
  into next_position
  from public.board_columns c
  where c.board_id = p_board_id;

  insert into public.board_columns (board_id, title, position, business_state)
  values (p_board_id, btrim(p_name), next_position, null)
  returning id into new_column_id;

  return new_column_id;
end;
$$;

create or replace function public.rename_board_column(p_column_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_board_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Column name is required' using errcode = '22023';
  end if;

  select c.board_id into target_board_id
  from public.board_columns c
  where c.id = p_column_id;

  if target_board_id is null
    or not vittahub_private.can_manage_board_columns(target_board_id) then
    raise exception 'Board management is required' using errcode = '42501';
  end if;

  update public.board_columns set title = btrim(p_name) where id = p_column_id;
end;
$$;

create or replace function public.delete_board_column(p_column_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_board_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select c.board_id into target_board_id
  from public.board_columns c
  where c.id = p_column_id
  for update;

  if target_board_id is null
    or not vittahub_private.can_manage_board_columns(target_board_id) then
    raise exception 'Board management is required' using errcode = '42501';
  end if;
  if exists (select 1 from public.tasks t where t.column_id = p_column_id) then
    raise exception 'Column has linked tasks' using errcode = '23503';
  end if;

  delete from public.board_columns where id = p_column_id;
end;
$$;

commit;
