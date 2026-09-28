-- VittaHub Task 12. Manual comments and controlled third-party waiting workflow.
begin;

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now()
);

create index task_comments_task_created_idx
  on public.task_comments (task_id, created_at, id);

alter table public.task_comments enable row level security;
alter table public.task_comments force row level security;
revoke all on table public.task_comments from public, anon, authenticated;
grant select on public.task_comments to authenticated;

create function vittahub_private.can_view_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = target_task_id
      and (
        vittahub_private.is_system_admin()
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
  );
$$;

alter function vittahub_private.can_view_task(uuid) owner to postgres;
revoke all on function vittahub_private.can_view_task(uuid) from public, anon, authenticated;
grant execute on function vittahub_private.can_view_task(uuid) to authenticated;

create policy task_comments_select on public.task_comments for select to authenticated
using (vittahub_private.can_view_task(task_id));

create function public.add_task_comment(p_task_id uuid, p_content text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_comment_id uuid;
begin
  if p_content is null or length(btrim(p_content)) = 0 then
    raise exception 'Comment content is required' using errcode = '22023';
  end if;
  if caller_id is null or not vittahub_private.can_view_task(p_task_id) then
    raise exception 'Task access is required' using errcode = '42501';
  end if;

  insert into public.task_comments (task_id, author_id, content)
  values (p_task_id, caller_id, btrim(p_content))
  returning id into new_comment_id;

  return new_comment_id;
end;
$$;

create function public.wait_task_for_third_party(p_task_id uuid, p_content text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if p_content is null or length(btrim(p_content)) = 0 then
    raise exception 'Third-party explanation is required' using errcode = '22023';
  end if;
  if caller_id is null then
    raise exception 'Task transition is not allowed' using errcode = '42501';
  end if;

  update public.tasks t
  set business_state = 'aguardando_terceiro'
  where t.id = p_task_id
    and t.assignee_id = caller_id
    and t.business_state = 'fazendo'
    and vittahub_private.can_view_board(t.board_id);

  if not found then
    raise exception 'Task transition is not allowed' using errcode = '42501';
  end if;

  insert into public.task_comments (task_id, author_id, content)
  values (p_task_id, caller_id, btrim(p_content));
  insert into public.task_events (task_id, event_type, content, actor_id, is_system)
  values (p_task_id, 'waiting_third_party', 'Pendência aguardando terceiro', caller_id, true);
end;
$$;

create function public.resume_task(p_task_id uuid)
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
    and t.business_state = 'aguardando_terceiro'
    and vittahub_private.can_view_board(t.board_id);

  if not found then
    raise exception 'Task transition is not allowed' using errcode = '42501';
  end if;

  insert into public.task_events (task_id, event_type, content, actor_id, is_system)
  values (p_task_id, 'resumed', 'Pendência retomada', caller_id, true);
end;
$$;

alter function public.add_task_comment(uuid, text) owner to postgres;
alter function public.wait_task_for_third_party(uuid, text) owner to postgres;
alter function public.resume_task(uuid) owner to postgres;
revoke all on function public.add_task_comment(uuid, text),
  public.wait_task_for_third_party(uuid, text), public.resume_task(uuid)
  from public, anon, authenticated;
grant execute on function public.add_task_comment(uuid, text),
  public.wait_task_for_third_party(uuid, text), public.resume_task(uuid)
  to authenticated;

comment on table public.task_comments is
  'Immutable manual task comments, separate from automatic system events.';

commit;
