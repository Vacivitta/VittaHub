begin;

-- Bounded read model for the current user. SECURITY DEFINER is needed only to
-- resolve names of people involved in already-authorized tasks, without changing
-- profiles RLS or exposing a general directory. No caller identity parameters.
create or replace function public.list_my_requests()
returns table (
  item_key text, area text, kind text, task jsonb, request jsonb,
  creator_name text, assignee_name text, requester_name text,
  refused_assignee_name text, justification text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  ) then raise exception 'Active authentication is required' using errcode = '42501'; end if;

  return query
  with visible as materialized (
    select t.*, (t.created_by = auth.uid() or vittahub_private.can_manage_board(t.board_id)) as can_decide
    from public.tasks t
    where vittahub_private.can_view_task(t.id)
      and (t.business_state = 'aguardando_aceite' or exists (
        select 1 from public.task_postponement_requests r where r.task_id = t.id and r.status = 'pending'
      ))
  ), relevant as (
    select 'acceptance-' || t.id as key, 'decide'::text as bucket, 'acceptance'::text as type,
      t.id as task_id, null::uuid as request_id
    from visible t where t.business_state = 'aguardando_aceite' and not t.awaiting_reassignment
      and t.assignee_id = auth.uid()
    union all
    select 'acceptance-' || t.id, 'waiting', 'acceptance', t.id, null::uuid
    from visible t where t.business_state = 'aguardando_aceite' and not t.awaiting_reassignment
      and t.assignee_id <> auth.uid()
      and (t.created_by = auth.uid() or auth.uid() = (
        select e.actor_id from public.task_events e
        where e.task_id = t.id and e.event_type = 'assignment_reassigned'
        order by e.created_at desc, e.id desc limit 1
      ))
    union all
    select 'reassignment-' || t.id, 'decide', 'reassignment', t.id, null::uuid
    from visible t where t.awaiting_reassignment and t.can_decide
    union all
    select 'postponement-' || r.id,
      case when r.requested_by = auth.uid() then 'waiting' else 'decide' end,
      'postponement', t.id, r.id
    from visible t join public.task_postponement_requests r on r.task_id = t.id and r.status = 'pending'
    where r.requested_by = auth.uid() or t.can_decide
  )
  select x.key, x.bucket, x.type, to_jsonb(t), to_jsonb(r),
    creator.display_name, assignee.display_name, requester.display_name, refused.display_name,
    case when x.type = 'postponement' then r.justification
      when x.type = 'reassignment' then (
        select e.details->>'justification' from public.task_events e
        where e.task_id = t.id and e.event_type = 'assignment_refused'
        order by e.created_at desc, e.id desc limit 1
      ) else null end
  from relevant x
  join public.tasks t on t.id = x.task_id
  left join public.task_postponement_requests r on r.id = x.request_id
  join public.profiles creator on creator.id = t.created_by
  left join public.profiles assignee on assignee.id = t.assignee_id
  left join public.profiles requester on requester.id = r.requested_by
  left join public.profiles refused on refused.id = t.refused_assignee_id
  order by t.due_at, x.key;
end;
$$;
alter function public.list_my_requests() owner to postgres;
revoke all on function public.list_my_requests() from public, anon, authenticated;
grant execute on function public.list_my_requests() to authenticated;

commit;
