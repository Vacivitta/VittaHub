-- VittaHub Task 17. Safe, idempotent individual conversation creation.
begin;

create function public.list_direct_chat_candidates()
returns table (user_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or not exists (
    select 1 from public.profiles p where p.id = caller_id and p.is_active
  ) then
    raise exception 'Active authentication is required' using errcode = '42501';
  end if;

  return query
  select p.id, p.display_name
  from public.profiles p
  where p.is_active and p.id <> caller_id
  order by p.display_name nulls last, p.id;
end;
$$;

create function public.get_or_create_direct_conversation(p_target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  conversation_id uuid;
begin
  if caller_id is null or not exists (
    select 1 from public.profiles p where p.id = caller_id and p.is_active
  ) then
    raise exception 'Active authentication is required' using errcode = '42501';
  end if;
  if p_target_user_id is null or p_target_user_id = caller_id then
    raise exception 'A different target user is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_target_user_id and p.is_active
  ) then
    raise exception 'Target user must be active' using errcode = '22023';
  end if;

  -- Both A→B and B→A serialize on the same transaction-scoped key.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(caller_id, p_target_user_id)::text || ':' || greatest(caller_id, p_target_user_id)::text,
      0
    )
  );

  select c.id into conversation_id
  from public.conversations c
  join public.conversation_participants cp on cp.conversation_id = c.id
  where c.kind = 'individual'
  group by c.id
  having count(*) = 2
    and count(*) filter (where cp.user_id in (caller_id, p_target_user_id)) = 2
  order by c.id
  limit 1;

  if conversation_id is not null then
    return conversation_id;
  end if;

  insert into public.conversations (kind, title)
  values ('individual', null)
  returning id into conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (conversation_id, caller_id), (conversation_id, p_target_user_id);

  return conversation_id;
end;
$$;

alter function public.list_direct_chat_candidates() owner to postgres;
alter function public.get_or_create_direct_conversation(uuid) owner to postgres;
revoke all on function public.list_direct_chat_candidates(),
  public.get_or_create_direct_conversation(uuid) from public, anon, authenticated;
grant execute on function public.list_direct_chat_candidates(),
  public.get_or_create_direct_conversation(uuid) to authenticated;

comment on function public.get_or_create_direct_conversation(uuid) is
  'Returns the unique usable individual conversation for the authenticated active user and active target.';

commit;
