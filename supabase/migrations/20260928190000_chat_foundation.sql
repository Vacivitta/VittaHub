-- VittaHub Task 13. Secure persistent chat foundation without UI creation flows.
begin;

create type public.conversation_kind as enum ('individual', 'grupo');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  title text,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  check (title is null or length(btrim(title)) > 0)
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_participants_user_idx
  on public.conversation_participants (user_id, conversation_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at, id);
create index messages_author_idx on public.messages (author_id);

alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.conversation_participants enable row level security;
alter table public.conversation_participants force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;

revoke all on table public.conversations, public.conversation_participants, public.messages
  from public, anon, authenticated;
grant select on table public.conversations, public.conversation_participants, public.messages
  to authenticated;

create function vittahub_private.can_access_conversation(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.user_id = (select auth.uid())
  );
$$;

alter function vittahub_private.can_access_conversation(uuid) owner to postgres;
revoke all on function vittahub_private.can_access_conversation(uuid)
  from public, anon, authenticated;
grant execute on function vittahub_private.can_access_conversation(uuid) to authenticated;

create policy conversations_select on public.conversations for select to authenticated
using (vittahub_private.can_access_conversation(id));

create policy conversation_participants_select on public.conversation_participants
for select to authenticated
using (vittahub_private.can_access_conversation(conversation_id));

create policy messages_select on public.messages for select to authenticated
using (vittahub_private.can_access_conversation(conversation_id));

create function public.list_conversation_participants(p_conversation_id uuid)
returns table (user_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not vittahub_private.can_access_conversation(p_conversation_id) then
    raise exception 'Conversation access is required' using errcode = '42501';
  end if;

  return query
  select participant.user_id, profile.display_name
  from public.conversation_participants participant
  join public.profiles profile on profile.id = participant.user_id
  where participant.conversation_id = p_conversation_id
  order by profile.display_name nulls last, participant.user_id;
end;
$$;

create function public.send_message(p_conversation_id uuid, p_content text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_message_id uuid;
begin
  if p_content is null or length(btrim(p_content)) = 0 then
    raise exception 'Message content is required' using errcode = '22023';
  end if;
  if caller_id is null
    or not vittahub_private.can_access_conversation(p_conversation_id) then
    raise exception 'Conversation access is required' using errcode = '42501';
  end if;

  insert into public.messages (conversation_id, author_id, content)
  values (p_conversation_id, caller_id, btrim(p_content))
  returning id into new_message_id;

  update public.conversations
  set last_activity_at = statement_timestamp()
  where id = p_conversation_id;

  return new_message_id;
end;
$$;

alter function public.list_conversation_participants(uuid) owner to postgres;
alter function public.send_message(uuid, text) owner to postgres;
revoke all on function public.list_conversation_participants(uuid),
  public.send_message(uuid, text) from public, anon, authenticated;
grant execute on function public.list_conversation_participants(uuid),
  public.send_message(uuid, text) to authenticated;

comment on table public.conversations is
  'Persistent individual and group conversations visible only to their participants.';
comment on table public.conversation_participants is
  'Conversation membership; mutation is intentionally unavailable to the application in Task 13.';
comment on table public.messages is
  'Immutable chat messages created only through the controlled send_message RPC.';

commit;
