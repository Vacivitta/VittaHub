begin;

create function public.can_edit_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t where t.id = p_task_id
      and t.business_state <> 'concluido'
      and vittahub_private.can_view_task(t.id)
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
      and (t.created_by = auth.uid() or vittahub_private.can_manage_board(t.board_id))
  );
$$;

create function public.edit_task(p_task_id uuid, p_title text, p_description text, p_is_private boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks;
  new_title text := btrim(p_title);
  new_description text := nullif(btrim(p_description), '');
  changes jsonb := '{}'::jsonb;
  labels text[] := '{}';
begin
  t := vittahub_private.lock_task_for_assignment_action(p_task_id);
  perform 1 from public.profiles where id = auth.uid() and is_active for share;
  if not found then raise exception 'Task editing is not allowed' using errcode = '42501'; end if;
  perform 1 from public.board_memberships where board_id = t.board_id and user_id = auth.uid() for share;
  if not public.can_edit_task(t.id) then
    raise exception 'Task editing is not allowed' using errcode = '42501';
  end if;
  if new_title is null or new_title !~ '\S' then
    raise exception 'Task title is required' using errcode = '22023';
  end if;
  if p_is_private is null then
    raise exception 'Task privacy is required' using errcode = '22023';
  end if;
  if t.title is distinct from new_title then
    changes := changes || jsonb_build_object('title', jsonb_build_object('before', t.title, 'after', new_title));
    labels := array_append(labels, 'título');
  end if;
  if t.description is distinct from new_description then
    changes := changes || jsonb_build_object('description', jsonb_build_object('before', t.description, 'after', new_description));
    labels := array_append(labels, 'descrição');
  end if;
  if t.is_private is distinct from p_is_private then
    changes := changes || jsonb_build_object('is_private', jsonb_build_object('before', t.is_private, 'after', p_is_private));
    labels := array_append(labels, 'privacidade');
  end if;
  if changes = '{}'::jsonb then return false; end if;
  update public.tasks set title = new_title, description = new_description, is_private = p_is_private
    where id = t.id;
  insert into public.task_events(task_id, event_type, content, actor_id, created_at, details)
    values(t.id, 'edited', 'Pendência editada. Campos alterados: ' || array_to_string(labels, ', ') || '.',
      auth.uid(), statement_timestamp(), jsonb_build_object('changes', changes));
  return true;
end;
$$;

alter function public.can_edit_task(uuid) owner to postgres;
alter function public.edit_task(uuid,text,text,boolean) owner to postgres;
revoke all on function public.can_edit_task(uuid), public.edit_task(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.can_edit_task(uuid), public.edit_task(uuid,text,text,boolean) to authenticated;
commit;
