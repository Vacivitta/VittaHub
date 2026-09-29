-- VittaHub Task 16. Controlled board/column management and column-only task movement.
begin;

create function vittahub_private.can_manage_board_structure(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('gestor', 'administrador')
  ) and vittahub_private.can_manage_board(target_board_id);
$$;

alter function vittahub_private.can_manage_board_structure(uuid) owner to postgres;
revoke all on function vittahub_private.can_manage_board_structure(uuid)
  from public, anon, authenticated;

create function public.get_board_creation_context()
returns table (
  role public.application_role,
  department_id uuid,
  can_create boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  return query
  select p.role, p.department_id,
    p.role in ('gestor', 'administrador') and exists (
      select 1 from public.board_creation_authorizations a where a.user_id = caller_id
    )
  from public.profiles p
  where p.id = caller_id;
end;
$$;

create function public.can_manage_board_structure(p_board_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  return vittahub_private.can_manage_board_structure(p_board_id);
end;
$$;

-- Replace the foundation RPC with the same contract and stricter approved roles.
create or replace function public.create_board(
  p_title text,
  p_department_id uuid,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role public.application_role;
  caller_department_id uuid;
  new_board_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'Board title is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.board_creation_authorizations a where a.user_id = caller_id
  ) then
    raise exception 'Board creation requires an explicit authorization' using errcode = '42501';
  end if;

  select p.role, p.department_id
  into caller_role, caller_department_id
  from public.profiles p
  where p.id = caller_id;

  if caller_role not in ('gestor', 'administrador') then
    raise exception 'Board creation requires a manager role' using errcode = '42501';
  end if;
  if p_department_id is null
    or (caller_role = 'gestor' and p_department_id <> caller_department_id)
    or not exists (select 1 from public.departments d where d.id = p_department_id) then
    raise exception 'Board department is not allowed for this user' using errcode = '42501';
  end if;

  insert into public.boards (title, department_id, description, created_by)
  values (
    btrim(p_title),
    p_department_id,
    nullif(btrim(coalesce(p_description, '')), ''),
    caller_id
  )
  returning id into new_board_id;

  return new_board_id;
end;
$$;

create function public.create_board_column(p_board_id uuid, p_name text)
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
    or not vittahub_private.can_manage_board_structure(p_board_id) then
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

create function public.rename_board_column(p_column_id uuid, p_name text)
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
    or not vittahub_private.can_manage_board_structure(target_board_id) then
    raise exception 'Board management is required' using errcode = '42501';
  end if;

  update public.board_columns set title = btrim(p_name) where id = p_column_id;
end;
$$;

create function public.move_task_to_column(p_task_id uuid, p_target_column_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_task public.tasks%rowtype;
  source_column_name text;
  target_column_name text;
begin
  if caller_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select t.* into current_task
  from public.tasks t
  where t.id = p_task_id
  for update;

  if current_task.id is null
    or not vittahub_private.can_view_board(current_task.board_id)
    or not (
      current_task.assignee_id = caller_id
      or current_task.created_by = caller_id
      or vittahub_private.can_manage_board_structure(current_task.board_id)
    ) then
    raise exception 'Task movement is not allowed' using errcode = '42501';
  end if;

  select c.title into target_column_name
  from public.board_columns c
  where c.id = p_target_column_id and c.board_id = current_task.board_id;

  if target_column_name is null then
    raise exception 'Target column must belong to the task board' using errcode = '22023';
  end if;
  if current_task.column_id = p_target_column_id then
    return;
  end if;

  select c.title into source_column_name
  from public.board_columns c
  where c.id = current_task.column_id;

  update public.tasks
  set column_id = p_target_column_id
  where id = current_task.id;

  insert into public.task_events (task_id, event_type, content, actor_id, is_system)
  values (
    current_task.id,
    'column_moved',
    format('Pendência movida de "%s" para "%s".', source_column_name, target_column_name),
    caller_id,
    true
  );
end;
$$;

alter function public.get_board_creation_context() owner to postgres;
alter function public.can_manage_board_structure(uuid) owner to postgres;
alter function public.create_board(text, uuid, text) owner to postgres;
alter function public.create_board_column(uuid, text) owner to postgres;
alter function public.rename_board_column(uuid, text) owner to postgres;
alter function public.move_task_to_column(uuid, uuid) owner to postgres;

revoke all on function public.get_board_creation_context(),
  public.can_manage_board_structure(uuid), public.create_board(text, uuid, text),
  public.create_board_column(uuid, text), public.rename_board_column(uuid, text),
  public.move_task_to_column(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_board_creation_context(),
  public.can_manage_board_structure(uuid), public.create_board(text, uuid, text),
  public.create_board_column(uuid, text), public.rename_board_column(uuid, text),
  public.move_task_to_column(uuid, uuid) to authenticated;

-- Structure mutations are now exclusively exposed through the checked RPCs.
revoke insert (board_id, title, position, business_state)
  on public.board_columns from authenticated;
revoke update (title, position, business_state)
  on public.board_columns from authenticated;

comment on function public.move_task_to_column(uuid, uuid) is
  'Moves a visible task within its board by changing only column_id and recording a system event.';

commit;
