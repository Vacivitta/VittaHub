begin;

-- Null assignee means no active assignment, only in the refused-assignment flow.
alter table public.tasks alter column assignee_id drop not null;
alter table public.tasks add column refused_assignee_id uuid references public.profiles(id) on delete restrict;
alter table public.tasks add column awaiting_reassignment boolean not null default false;
alter table public.tasks add constraint tasks_assignment_consistency check (
  (awaiting_reassignment and assignee_id is null and refused_assignee_id is not null
    and business_state = 'aguardando_aceite')
  or (not awaiting_reassignment and assignee_id is not null)
);
alter table public.task_events add column details jsonb not null default '{}'::jsonb;

create table public.task_postponement_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  previous_due_at timestamptz not null,
  requested_due_at timestamptz not null check (isfinite(requested_due_at)),
  justification text not null check (justification ~ '\S'),
  created_at timestamptz not null default statement_timestamp(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  decision_justification text,
  check (requested_due_at > previous_due_at),
  check ((status = 'pending' and decided_by is null and decided_at is null and decision_justification is null)
    or (status in ('approved', 'rejected') and decided_by is not null and decided_at is not null
      and decided_by <> requested_by)),
  check (status <> 'rejected' or (decision_justification is not null and decision_justification ~ '\S'))
);
create unique index task_postponement_one_pending on public.task_postponement_requests(task_id) where status = 'pending';
create index task_postponement_task_created on public.task_postponement_requests(task_id, created_at);
alter table public.task_postponement_requests enable row level security;
alter table public.task_postponement_requests force row level security;
revoke all on public.task_postponement_requests from public, anon, authenticated;
grant select on public.task_postponement_requests to authenticated;
create policy task_postponement_select on public.task_postponement_requests for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
  and vittahub_private.can_view_task(task_id));

-- All mutations lock the task first, including decisions and direct deadline edits.
create function vittahub_private.lock_task_for_assignment_action(p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  ) then raise exception 'Task action is not allowed' using errcode = '42501'; end if;
  select * into t from public.tasks where id = p_task_id for update;
  if not found or not vittahub_private.can_view_task(p_task_id) then
    raise exception 'Task action is not allowed' using errcode = '42501';
  end if;
  return t;
end;
$$;

create function public.task_assignment_capabilities(p_task_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'can_manage', t.created_by = auth.uid() or vittahub_private.can_manage_board(t.board_id),
    'can_change_due_at', vittahub_private.is_system_admin())
  from public.tasks t where t.id = p_task_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
    and vittahub_private.can_view_task(t.id);
$$;

create function public.refuse_task_assignment(p_task_id uuid, p_justification text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
  t := vittahub_private.lock_task_for_assignment_action(p_task_id);
  if t.assignee_id is distinct from auth.uid() or t.business_state <> 'aguardando_aceite'
    or t.awaiting_reassignment then
    raise exception 'Assignment refusal is not allowed' using errcode = '42501';
  end if;
  if p_justification is null or p_justification !~ '\S' then
    raise exception 'Justification is required' using errcode = '22023';
  end if;
  update public.tasks set assignee_id = null, refused_assignee_id = t.assignee_id,
    awaiting_reassignment = true where id = t.id;
  insert into public.task_events(task_id, event_type, content, actor_id, details)
  values(t.id, 'assignment_refused', 'Atribuição recusada. Justificativa: ' || btrim(p_justification), auth.uid(),
    jsonb_build_object('refused_assignee_id', t.assignee_id, 'justification', btrim(p_justification)));
end;
$$;

create function public.reassign_refused_task(p_task_id uuid, p_assignee_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
  t := vittahub_private.lock_task_for_assignment_action(p_task_id);
  if not (t.created_by = auth.uid() or vittahub_private.can_manage_board(t.board_id)) then
    raise exception 'Reassignment is not allowed' using errcode = '42501';
  end if;
  if not t.awaiting_reassignment then
    raise exception 'Only refused assignments can be reassigned' using errcode = '22023';
  end if;
  perform 1 from public.profiles p join public.board_memberships m on m.user_id = p.id
    where p.id = p_assignee_id and p.is_active and m.board_id = t.board_id for share of p, m;
  if not found then raise exception 'Active board participant is required' using errcode = '22023'; end if;
  update public.tasks set assignee_id = p_assignee_id, awaiting_reassignment = false,
    business_state = case when p_assignee_id = auth.uid() then 'a_fazer'::public.kanban_business_state
      else 'aguardando_aceite'::public.kanban_business_state end,
    accepted_at = case when p_assignee_id = auth.uid() then statement_timestamp() else null end
    where id = t.id;
  insert into public.task_events(task_id, event_type, content, actor_id, details)
  values(t.id, 'assignment_reassigned', format('Pendência reatribuída de %s para %s.',
    (select display_name from public.profiles where id = t.refused_assignee_id),
    (select display_name from public.profiles where id = p_assignee_id)), auth.uid(),
    jsonb_build_object('refused_assignee_id', t.refused_assignee_id, 'new_assignee_id', p_assignee_id));
end;
$$;

create function public.request_task_postponement(p_task_id uuid, p_due_at timestamptz, p_justification text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.tasks; request_id uuid;
begin
  t := vittahub_private.lock_task_for_assignment_action(p_task_id);
  if t.assignee_id is distinct from auth.uid() or t.awaiting_reassignment
    or t.business_state not in ('a_fazer', 'fazendo', 'aguardando_terceiro') then
    raise exception 'Postponement request is not allowed' using errcode = '42501';
  end if;
  if p_due_at is null or not isfinite(p_due_at) or p_due_at <= t.due_at then
    raise exception 'A later deadline is required' using errcode = '22023';
  end if;
  if p_justification is null or p_justification !~ '\S' then
    raise exception 'Justification is required' using errcode = '22023';
  end if;
  if exists (select 1 from public.task_postponement_requests where task_id = t.id and status = 'pending') then
    raise exception 'A pending request already exists' using errcode = '22023';
  end if;
  insert into public.task_postponement_requests(task_id, requested_by, previous_due_at, requested_due_at, justification)
    values(t.id, auth.uid(), t.due_at, p_due_at, btrim(p_justification)) returning id into request_id;
  insert into public.task_events(task_id, event_type, content, actor_id, details)
  values(t.id, 'postponement_requested', format('Adiamento solicitado de %s para %s. Justificativa: %s',
    t.due_at, p_due_at, btrim(p_justification)), auth.uid(),
    jsonb_build_object('request_id', request_id, 'requested_by', auth.uid(), 'previous_due_at', t.due_at,
      'requested_due_at', p_due_at, 'justification', btrim(p_justification)));
  return request_id;
end;
$$;

create function public.decide_task_postponement(p_task_id uuid, p_request_id uuid, p_approve boolean, p_justification text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tasks; r public.task_postponement_requests;
begin
  t := vittahub_private.lock_task_for_assignment_action(p_task_id);
  if not (t.created_by = auth.uid() or vittahub_private.can_manage_board(t.board_id)) then
    raise exception 'Postponement decision is not allowed' using errcode = '42501';
  end if;
  select * into r from public.task_postponement_requests where id = p_request_id and task_id = t.id for update;
  if not found or r.requested_by = auth.uid() then
    raise exception 'Postponement decision is not allowed' using errcode = '42501';
  end if;
  if r.status <> 'pending' or p_approve is null then
    raise exception 'A pending request and a decision are required' using errcode = '22023';
  end if;
  if not p_approve and (p_justification is null or p_justification !~ '\S') then
    raise exception 'Justification is required' using errcode = '22023';
  end if;
  update public.task_postponement_requests set status = case when p_approve then 'approved' else 'rejected' end,
    decided_by = auth.uid(), decided_at = statement_timestamp(), decision_justification = nullif(btrim(p_justification), '')
    where id = r.id;
  if p_approve then update public.tasks set due_at = r.requested_due_at where id = t.id; end if;
  insert into public.task_events(task_id, event_type, content, actor_id, details)
  values(t.id, case when p_approve then 'postponement_approved' else 'postponement_rejected' end,
    case when p_approve then format('Adiamento solicitado por %s aprovado: prazo de %s para %s.',
      (select display_name from public.profiles where id = r.requested_by), t.due_at, r.requested_due_at)
    else format('Adiamento solicitado por %s recusado. Justificativa: %s',
      (select display_name from public.profiles where id = r.requested_by), btrim(p_justification)) end,
    auth.uid(), jsonb_build_object('request_id', r.id, 'requested_by', r.requested_by,
      'decided_by', auth.uid(), 'previous_due_at', t.due_at,
      'new_due_at', case when p_approve then r.requested_due_at else t.due_at end,
      'justification', nullif(btrim(p_justification), '')));
end;
$$;

create function public.change_task_due_at(p_task_id uuid, p_due_at timestamptz, p_justification text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
  t := vittahub_private.lock_task_for_assignment_action(p_task_id);
  if not vittahub_private.is_system_admin() then
    raise exception 'Global administration is required' using errcode = '42501';
  end if;
  if p_due_at is null or not isfinite(p_due_at) or p_justification is null or p_justification !~ '\S' then
    raise exception 'Deadline and justification are required' using errcode = '22023';
  end if;
  update public.tasks set due_at = p_due_at where id = t.id;
  insert into public.task_events(task_id, event_type, content, actor_id, details)
  values(t.id, 'due_at_changed', format('Prazo alterado diretamente de %s para %s. Justificativa: %s',
    t.due_at, p_due_at, btrim(p_justification)), auth.uid(),
    jsonb_build_object('previous_due_at', t.due_at, 'new_due_at', p_due_at, 'justification', btrim(p_justification)));
end;
$$;

alter function vittahub_private.lock_task_for_assignment_action(uuid) owner to postgres;
revoke all on function vittahub_private.lock_task_for_assignment_action(uuid) from public, anon, authenticated;
alter function public.task_assignment_capabilities(uuid) owner to postgres;
alter function public.refuse_task_assignment(uuid, text) owner to postgres;
alter function public.reassign_refused_task(uuid, uuid) owner to postgres;
alter function public.request_task_postponement(uuid, timestamptz, text) owner to postgres;
alter function public.decide_task_postponement(uuid, uuid, boolean, text) owner to postgres;
alter function public.change_task_due_at(uuid, timestamptz, text) owner to postgres;
revoke all on function public.task_assignment_capabilities(uuid), public.refuse_task_assignment(uuid, text),
  public.reassign_refused_task(uuid, uuid), public.request_task_postponement(uuid, timestamptz, text),
  public.decide_task_postponement(uuid, uuid, boolean, text), public.change_task_due_at(uuid, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.task_assignment_capabilities(uuid), public.refuse_task_assignment(uuid, text),
  public.reassign_refused_task(uuid, uuid), public.request_task_postponement(uuid, timestamptz, text),
  public.decide_task_postponement(uuid, uuid, boolean, text), public.change_task_due_at(uuid, timestamptz, text)
  to authenticated;

-- Preserve movement permissions with a nullable active assignee.
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
      or coalesce(current_task.assignee_id = caller_id, false)
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

commit;
