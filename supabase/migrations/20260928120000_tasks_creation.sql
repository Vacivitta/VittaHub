-- VittaHub Task 09. Controlled task creation and bounded assignee lookup.
begin;

alter table public.profiles
  add column is_active boolean not null default true;

create function public.list_board_assignees(p_board_id uuid)
returns table (id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not vittahub_private.can_view_board(p_board_id) then
    raise exception 'Board access is required' using errcode = '42501';
  end if;

  return query
    select p.id, p.display_name
    from public.board_memberships m
    join public.profiles p on p.id = m.user_id
    where m.board_id = p_board_id
      and p.is_active
    order by p.display_name nulls last, p.id;
end;
$$;

create function public.create_task(
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
    select 1
    from public.board_columns c
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
    p_assignee_id, p_due_at, initial_state, p_is_private
  )
  returning id into new_task_id;

  return new_task_id;
end;
$$;

alter function public.list_board_assignees(uuid) owner to postgres;
alter function public.create_task(uuid, uuid, text, uuid, timestamptz, boolean, text) owner to postgres;

revoke all on function public.list_board_assignees(uuid) from public, anon, authenticated;
revoke all on function public.create_task(uuid, uuid, text, uuid, timestamptz, boolean, text)
  from public, anon, authenticated;
grant execute on function public.list_board_assignees(uuid) to authenticated;
grant execute on function public.create_task(uuid, uuid, text, uuid, timestamptz, boolean, text)
  to authenticated;

comment on column public.profiles.is_active is
  'Administrative lifecycle flag. Task assignment is limited to active current board participants.';
comment on function public.list_board_assignees(uuid) is
  'Returns only id and display_name for active current participants of a board visible to the caller.';
comment on function public.create_task(uuid, uuid, text, uuid, timestamptz, boolean, text) is
  'Creates a task for an authorized caller; creator and initial state are always derived by the database.';

commit;
