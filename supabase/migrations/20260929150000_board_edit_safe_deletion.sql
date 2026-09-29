-- VittaHub Task 16.1. Controlled board editing and conservative structural deletion.
begin;

create function public.update_board(
  p_board_id uuid,
  p_title text,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not vittahub_private.can_manage_board_structure(p_board_id) then
    raise exception 'Board management is required' using errcode = '42501';
  end if;
  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'Board title is required' using errcode = '22023';
  end if;

  update public.boards
  set title = btrim(p_title),
      description = nullif(btrim(coalesce(p_description, '')), '')
  where id = p_board_id;

  if not found then
    raise exception 'Board management is required' using errcode = '42501';
  end if;
end;
$$;

create function public.delete_board_column(p_column_id uuid)
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
    or not vittahub_private.can_manage_board_structure(target_board_id) then
    raise exception 'Board management is required' using errcode = '42501';
  end if;
  if exists (select 1 from public.tasks t where t.column_id = p_column_id) then
    raise exception 'Column has linked tasks' using errcode = '23503';
  end if;

  delete from public.board_columns where id = p_column_id;
end;
$$;

create function public.delete_board(p_board_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform 1 from public.boards b where b.id = p_board_id for update;
  if not found or not vittahub_private.can_manage_board_structure(p_board_id) then
    raise exception 'Board management is required' using errcode = '42501';
  end if;
  if exists (select 1 from public.tasks t where t.board_id = p_board_id) then
    raise exception 'Board has linked tasks' using errcode = '23503';
  end if;

  delete from public.board_columns where board_id = p_board_id;
  delete from public.board_memberships where board_id = p_board_id;
  delete from public.boards where id = p_board_id;
end;
$$;

alter function public.update_board(uuid, text, text) owner to postgres;
alter function public.delete_board_column(uuid) owner to postgres;
alter function public.delete_board(uuid) owner to postgres;

revoke all on function public.update_board(uuid, text, text),
  public.delete_board_column(uuid), public.delete_board(uuid)
  from public, anon, authenticated;
grant execute on function public.update_board(uuid, text, text),
  public.delete_board_column(uuid), public.delete_board(uuid)
  to authenticated;

-- Board edits now use the role-aware RPC instead of the older generic table policy.
revoke update (title, description) on public.boards from authenticated;

comment on function public.delete_board_column(uuid) is
  'Deletes an authorized board column only when it has no linked task.';
comment on function public.delete_board(uuid) is
  'Deletes an authorized task-free board and only its empty columns and memberships.';

commit;
