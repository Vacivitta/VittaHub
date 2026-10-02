-- Task 23A: shared movement and task-scoped history names.
begin;

create or replace function public.move_task_to_column(p_task_id uuid, p_target_column_id uuid)
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
  if caller_id is null or not exists (
    select 1 from public.profiles p where p.id = caller_id and p.is_active
  ) then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select t.* into current_task
  from public.tasks t
  where t.id = p_task_id
  for update;

  if current_task.id is null
    or not vittahub_private.can_view_board(current_task.board_id)
    or not (
      not current_task.is_private
      or current_task.assignee_id = caller_id
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

create function public.list_task_history(p_task_id uuid)
returns table (
  id uuid, task_id uuid, event_type text, content text, actor_id uuid,
  is_system boolean, created_at timestamptz, actor_display_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  ) or not vittahub_private.can_view_task(p_task_id) then
    raise exception 'Task access is required' using errcode = '42501';
  end if;
  return query
  select e.id, e.task_id, e.event_type, e.content, e.actor_id,
    e.is_system, e.created_at, p.display_name
  from public.task_events e
  join public.profiles p on p.id = e.actor_id
  where e.task_id = p_task_id
  order by e.created_at, e.id;
end;
$$;

alter function public.move_task_to_column(uuid, uuid) owner to postgres;
alter function public.list_task_history(uuid) owner to postgres;
revoke all on function public.move_task_to_column(uuid, uuid), public.list_task_history(uuid)
  from public, anon, authenticated;
grant execute on function public.move_task_to_column(uuid, uuid), public.list_task_history(uuid)
  to authenticated;

commit;
