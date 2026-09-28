-- VittaHub Task 11. Essential assignee workflow and immutable system history.
begin;

alter table public.tasks
  add column accepted_at timestamptz,
  add column completed_at timestamptz;

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete restrict,
  event_type text not null check (length(btrim(event_type)) > 0),
  content text not null check (length(btrim(content)) > 0),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create index task_events_task_created_idx
  on public.task_events (task_id, created_at, id);

alter table public.task_events enable row level security;
alter table public.task_events force row level security;
revoke all on table public.task_events from public, anon, authenticated;
grant select on public.task_events to authenticated;

create policy task_events_select on public.task_events for select to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_events.task_id
      and (
        (select vittahub_private.is_system_admin())
        or (
          vittahub_private.can_view_board(t.board_id)
          and (
            not t.is_private
            or t.created_by = (select auth.uid())
            or t.assignee_id = (select auth.uid())
            or vittahub_private.can_manage_board(t.board_id)
          )
        )
      )
  )
);

create function public.accept_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Task transition is not allowed' using errcode = '42501';
  end if;

  update public.tasks t
  set business_state = 'a_fazer', accepted_at = statement_timestamp()
  where t.id = p_task_id
    and t.assignee_id = caller_id
    and t.business_state = 'aguardando_aceite'
    and vittahub_private.can_view_board(t.board_id);

  if not found then
    raise exception 'Task transition is not allowed' using errcode = '42501';
  end if;

  insert into public.task_events (task_id, event_type, content, actor_id, is_system)
  values (p_task_id, 'accepted', 'Pendência aceita', caller_id, true);
end;
$$;

create function public.start_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Task transition is not allowed' using errcode = '42501';
  end if;

  update public.tasks t
  set business_state = 'fazendo'
  where t.id = p_task_id
    and t.assignee_id = caller_id
    and t.business_state = 'a_fazer'
    and vittahub_private.can_view_board(t.board_id);

  if not found then
    raise exception 'Task transition is not allowed' using errcode = '42501';
  end if;

  insert into public.task_events (task_id, event_type, content, actor_id, is_system)
  values (p_task_id, 'started', 'Pendência iniciada', caller_id, true);
end;
$$;

create function public.complete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Task transition is not allowed' using errcode = '42501';
  end if;

  update public.tasks t
  set business_state = 'concluido', completed_at = statement_timestamp()
  where t.id = p_task_id
    and t.assignee_id = caller_id
    and t.business_state = 'fazendo'
    and vittahub_private.can_view_board(t.board_id);

  if not found then
    raise exception 'Task transition is not allowed' using errcode = '42501';
  end if;

  insert into public.task_events (task_id, event_type, content, actor_id, is_system)
  values (p_task_id, 'completed', 'Pendência concluída', caller_id, true);
end;
$$;

alter function public.accept_task(uuid) owner to postgres;
alter function public.start_task(uuid) owner to postgres;
alter function public.complete_task(uuid) owner to postgres;
revoke all on function public.accept_task(uuid), public.start_task(uuid),
  public.complete_task(uuid) from public, anon, authenticated;
grant execute on function public.accept_task(uuid), public.start_task(uuid),
  public.complete_task(uuid) to authenticated;

comment on table public.task_events is
  'Immutable task timeline. The application currently creates only controlled system events through workflow RPCs.';
comment on column public.tasks.accepted_at is
  'Database timestamp set only when the assignee accepts an awaiting task.';
comment on column public.tasks.completed_at is
  'Database timestamp set only when the assignee completes an in-progress task.';

commit;
