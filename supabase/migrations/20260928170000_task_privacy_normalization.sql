-- Normalize privacy when a task is assigned to another participant.
begin;

create or replace function public.create_task(
  p_board_id uuid,
  p_column_id uuid,
  p_title text,
  p_assignee_id uuid,
  p_due_at timestamptz,
  p_is_private boolean,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_task_id uuid;
  initial_state public.kanban_business_state;
begin
  if caller_id is null or not vittahub_private.can_view_board(p_board_id) then
    raise exception 'Board access is required' using errcode = '42501';
  end if;
  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'Task title is required' using errcode = '22023';
  end if;
  if p_assignee_id is null then
    raise exception 'Task assignee is required' using errcode = '22023';
  end if;
  if p_due_at is null then
    raise exception 'Task deadline is required' using errcode = '22023';
  end if;
  if p_is_private is null then
    raise exception 'Task privacy is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.board_columns c
    where c.id = p_column_id and c.board_id = p_board_id
  ) then
    raise exception 'Task column must belong to the board' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.board_memberships m
    join public.profiles p on p.id = m.user_id
    where m.board_id = p_board_id
      and m.user_id = p_assignee_id
      and p.is_active
  ) then
    raise exception 'Task assignee must be an active board participant' using errcode = '22023';
  end if;

  initial_state := case
    when caller_id = p_assignee_id then 'a_fazer'::public.kanban_business_state
    else 'aguardando_aceite'::public.kanban_business_state
  end;

  insert into public.tasks (
    board_id, column_id, title, description, created_by, assignee_id,
    due_at, business_state, is_private
  ) values (
    p_board_id, p_column_id, btrim(p_title), nullif(btrim(p_description), ''), caller_id,
    p_assignee_id, p_due_at, initial_state, p_is_private and p_assignee_id = caller_id
  )
  returning id into new_task_id;

  return new_task_id;
end;
$$;

comment on function public.create_task(uuid, uuid, text, uuid, timestamptz, boolean, text) is
  'Creates a task with server-derived creator/state and forces shared visibility when creator and assignee differ.';

commit;
