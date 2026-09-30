-- VittaHub Task 18. Safe and atomic group conversation creation.
begin;

create function public.create_group_conversation(group_name text, participant_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_name text := btrim(group_name);
  conversation_id uuid;
  normalized_participant_ids uuid[];
begin
  if caller_id is null then
    raise exception 'Active authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = caller_id
      and profile.is_active
      and profile.role in ('gestor', 'administrador')
  ) then
    raise exception 'Group creation requires an active manager or administrator'
      using errcode = '42501';
  end if;

  if normalized_name is null or length(normalized_name) = 0 then
    raise exception 'Group name is required' using errcode = '22023';
  end if;

  if participant_ids is not null and array_position(participant_ids, null) is not null then
    raise exception 'Participants must be active users' using errcode = '22023';
  end if;

  select coalesce(array_agg(candidate.user_id order by candidate.user_id), '{}'::uuid[])
  into normalized_participant_ids
  from (
    select distinct requested.user_id
    from unnest(coalesce(participant_ids, '{}'::uuid[])) as requested(user_id)
    where requested.user_id <> caller_id
  ) candidate;

  if cardinality(normalized_participant_ids) = 0 then
    raise exception 'At least one other participant is required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(normalized_participant_ids) as requested(user_id)
    left join public.profiles profile
      on profile.id = requested.user_id and profile.is_active
    where profile.id is null
  ) then
    raise exception 'Participants must be active users' using errcode = '22023';
  end if;

  insert into public.conversations (kind, title)
  values ('grupo', normalized_name)
  returning id into conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  select conversation_id, member.user_id
  from (
    select caller_id as user_id
    union all
    select unnest(normalized_participant_ids)
  ) member;

  return conversation_id;
end;
$$;

alter function public.create_group_conversation(text, uuid[]) owner to postgres;
revoke all on function public.create_group_conversation(text, uuid[])
  from public, anon, authenticated;
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;

comment on function public.create_group_conversation(text, uuid[]) is
  'Creates a named group atomically for an active manager or administrator and active participants.';

commit;
