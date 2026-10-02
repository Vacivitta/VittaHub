begin;

create function public.get_admin_activity(
  p_from timestamptz, p_to timestamptz,
  p_actor_id uuid default null, p_board_id uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and p.is_active and p.role in ('gestor', 'administrador')
  ) then
    raise exception 'Administrative access required' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or not pg_catalog.isfinite(p_from)
    or not pg_catalog.isfinite(p_to) or p_from >= p_to then
    raise exception 'Invalid period' using errcode = '22023';
  end if;

  with authorized_boards as materialized (
    select b.id, b.title from public.boards b
    where vittahub_private.can_manage_board_structure(b.id)
  ), scoped_tasks as materialized (
    select t.*, b.title as board_title from public.tasks t
    join authorized_boards b on b.id = t.board_id
    where vittahub_private.can_view_task(t.id)
  ), scoped_events as materialized (
    select e.*, t.title as task_title, t.board_id, t.board_title, p.display_name as actor_name
    from public.task_events e join scoped_tasks t on t.id = e.task_id
    join public.profiles p on p.id = e.actor_id
    where e.event_type in ('accepted','started','column_moved','waiting_third_party','resumed','completed')
  ), filtered_events as materialized (
    select e.*,
      case when e.event_type = 'completed' then (
        select extract(epoch from e.created_at - max(s.created_at))
        from public.task_events s where s.task_id = e.task_id and s.event_type = 'started'
          and s.created_at <= e.created_at
      ) end as elapsed_seconds
    from scoped_events e
    where e.created_at >= p_from and e.created_at < p_to
      and (p_actor_id is null or e.actor_id = p_actor_id)
      and (p_board_id is null or e.board_id = p_board_id)
  ), completions as (
    -- One completion per task in the selected period; do not double-count audit duplicates.
    select distinct on (e.task_id) e.task_id, e.elapsed_seconds
    from filtered_events e where e.event_type = 'completed'
    order by e.task_id, e.created_at desc, e.id desc
  ), people_ids as (
    select t.assignee_id as id from scoped_tasks t
    union select e.actor_id from scoped_events e
  )
  select jsonb_build_object(
    'completed', (select count(*) from completions),
    'in_progress', (select count(*) from scoped_tasks t
      where t.business_state in ('fazendo', 'aguardando_terceiro')
        and (p_actor_id is null or t.assignee_id = p_actor_id)
        and (p_board_id is null or t.board_id = p_board_id)),
    'average_seconds', (select avg(elapsed_seconds) from completions),
    'duration_samples', (select count(elapsed_seconds) from completions),
    'total_events', (select count(*) from filtered_events),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc, e.id desc)
      from (select id, task_id, task_title, board_id, board_title, actor_id, actor_name,
        event_type, content, created_at, elapsed_seconds from filtered_events
        order by created_at desc, id desc limit 200) e), '[]'::jsonb),
    'boards', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.title) order by b.title,b.id)
      from authorized_boards b), '[]'::jsonb),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by p.display_name,p.id)
      from public.profiles p join people_ids i on i.id = p.id), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

alter function public.get_admin_activity(timestamptz,timestamptz,uuid,uuid) owner to postgres;
revoke all on function public.get_admin_activity(timestamptz,timestamptz,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_admin_activity(timestamptz,timestamptz,uuid,uuid) to authenticated;
commit;
