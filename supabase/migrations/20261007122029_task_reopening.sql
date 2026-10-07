begin;

create function public.can_reopen_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.business_state = 'concluido'
      and vittahub_private.can_view_task(t.id)
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
      and (t.assignee_id = auth.uid() or t.created_by = auth.uid()
        or vittahub_private.can_manage_board(t.board_id))
      and exists (select 1 from public.profiles p
        join public.board_memberships m on m.user_id = p.id
        where p.id = t.assignee_id and p.is_active and m.board_id = t.board_id)
  );
$$;

create function public.reopen_task(p_task_id uuid, p_justification text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
  t := vittahub_private.lock_task_for_assignment_action(p_task_id);
  -- Keep activity and participation valid until the transaction commits.
  perform 1 from public.profiles where id = auth.uid() and is_active for share;
  if not found then raise exception 'Task reopening is not allowed' using errcode = '42501'; end if;
  perform 1 from public.profiles p join public.board_memberships m on m.user_id = p.id
    where p.id = t.assignee_id and p.is_active and m.board_id = t.board_id for share of p, m;
  if not found then raise exception 'Active board participant is required' using errcode = '22023'; end if;
  perform 1 from public.board_memberships where board_id = t.board_id and user_id = auth.uid() for share;
  if not public.can_reopen_task(t.id) then
    raise exception 'Task reopening is not allowed' using errcode = '42501';
  end if;
  if p_justification is null or p_justification !~ '\S' then
    raise exception 'Justification is required' using errcode = '22023';
  end if;
  update public.tasks set business_state = 'a_fazer', completed_at = null where id = t.id;
  insert into public.task_events(task_id, event_type, content, actor_id, created_at, details)
  values(t.id, 'reopened', 'Pendência reaberta. Justificativa: ' || btrim(p_justification),
    auth.uid(), statement_timestamp(), jsonb_build_object('justification', btrim(p_justification),
      'previous_state', 'concluido', 'new_state', 'a_fazer'));
end;
$$;

alter function public.can_reopen_task(uuid) owner to postgres;
alter function public.reopen_task(uuid,text) owner to postgres;
revoke all on function public.can_reopen_task(uuid), public.reopen_task(uuid,text) from public, anon, authenticated;
grant execute on function public.can_reopen_task(uuid), public.reopen_task(uuid,text) to authenticated;
commit;
