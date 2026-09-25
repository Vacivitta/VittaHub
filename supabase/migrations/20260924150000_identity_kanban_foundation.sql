-- VittaHub / Vacivitta. Initial migration revised BEFORE its first application.
-- Prepared for review only. No accounts, seeds, tasks or messages.
begin;

create type public.application_role as enum ('membro', 'gestor', 'administrador');
create type public.kanban_business_state as enum (
  'aguardando_aceite', 'a_fazer', 'fazendo', 'aguardando_terceiro', 'concluido'
);

-- Bootstrap order: department -> Auth identity -> profile.
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  department_id uuid not null references public.departments (id) on delete restrict,
  display_name text check (display_name is null or length(btrim(display_name)) > 0),
  role public.application_role not null,
  created_at timestamptz not null default now()
);
create index profiles_department_id_idx on public.profiles (department_id);

create table public.board_creation_authorizations (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  granted_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  granted_at timestamptz not null default now()
);
create index board_creation_authorizations_granted_by_idx
  on public.board_creation_authorizations (granted_by);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  title text not null check (length(btrim(title)) > 0),
  description text,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index boards_department_id_idx on public.boards (department_id);
create index boards_created_by_idx on public.boards (created_by);

create table public.board_memberships (
  board_id uuid not null references public.boards (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  is_board_admin boolean not null default false,
  added_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  added_at timestamptz not null default now(),
  primary key (board_id, user_id)
);
create index board_memberships_user_id_board_id_idx on public.board_memberships (user_id, board_id);
create index board_memberships_added_by_idx on public.board_memberships (added_by);

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete restrict,
  title text not null check (length(btrim(title)) > 0),
  position integer not null check (position >= 0),
  business_state public.kanban_business_state,
  created_at timestamptz not null default now(),
  constraint board_columns_board_position_key unique (board_id, position)
    deferrable initially immediate
);
-- The unique index also covers board FK lookups and ordered listing.
-- NULL business_state is organizational. No task transitions are implemented.

alter table public.departments enable row level security;
alter table public.departments force row level security;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.board_creation_authorizations enable row level security;
alter table public.board_creation_authorizations force row level security;
alter table public.boards enable row level security;
alter table public.boards force row level security;
alter table public.board_memberships enable row level security;
alter table public.board_memberships force row level security;
alter table public.board_columns enable row level security;
alter table public.board_columns force row level security;

-- Not an exposed API schema. No caller-supplied user ID or mutable metadata.
-- Trusted postgres ownership bypasses RLS inside these bounded queries, avoiding
-- recursive policies on profiles/memberships. End-user table access still uses RLS.
create schema vittahub_private;
revoke all on schema vittahub_private from public, anon, authenticated;
grant usage on schema vittahub_private to authenticated;

create function vittahub_private.is_system_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'administrador'
  );
$$;
create function vittahub_private.can_view_board(target_board_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select vittahub_private.is_system_admin() or exists (
    select 1 from public.board_memberships m
    where m.board_id = target_board_id and m.user_id = (select auth.uid())
  );
$$;
create function vittahub_private.can_manage_board(target_board_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select vittahub_private.is_system_admin() or exists (
    select 1 from public.board_memberships m
    where m.board_id = target_board_id and m.user_id = (select auth.uid())
      and m.is_board_admin
  );
$$;
create function vittahub_private.add_board_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.board_memberships (board_id, user_id, is_board_admin, added_by)
  values (new.id, new.created_by, true, new.created_by);
  return new;
end;
$$;

alter function vittahub_private.is_system_admin() owner to postgres;
alter function vittahub_private.can_view_board(uuid) owner to postgres;
alter function vittahub_private.can_manage_board(uuid) owner to postgres;
alter function vittahub_private.add_board_creator() owner to postgres;
revoke all on function vittahub_private.is_system_admin(),
  vittahub_private.can_view_board(uuid), vittahub_private.can_manage_board(uuid),
  vittahub_private.add_board_creator() from public, anon, authenticated;
grant execute on function vittahub_private.is_system_admin(),
  vittahub_private.can_view_board(uuid), vittahub_private.can_manage_board(uuid)
  to authenticated;
-- No EXECUTE grant for the trigger function. Failure rolls back the board INSERT.
create trigger boards_add_creator after insert on public.boards
  for each row execute function vittahub_private.add_board_creator();

revoke all on table public.departments, public.profiles,
  public.board_creation_authorizations, public.boards, public.board_memberships,
  public.board_columns from public, anon, authenticated;
revoke all on type public.application_role, public.kanban_business_state from public;
grant usage on type public.application_role, public.kanban_business_state to authenticated;
grant select on public.departments, public.profiles, public.board_creation_authorizations,
  public.boards, public.board_memberships, public.board_columns to authenticated;

-- Column-level grants keep identifiers, authorship and audit fields immutable.
grant insert (user_id) on public.board_creation_authorizations to authenticated;
grant delete on public.board_creation_authorizations to authenticated;
-- Board creation is exclusively through the checked create_board RPC below.
grant update (title, description) on public.boards to authenticated;
grant insert (board_id, user_id) on public.board_memberships to authenticated;
grant delete on public.board_memberships to authenticated;
grant insert (board_id, title, position, business_state) on public.board_columns to authenticated;
grant update (title, position, business_state) on public.board_columns to authenticated;
-- No direct client writes to profiles/departments or membership roles, board/column
-- deletion or department reassignment until those workflows are defined.

create policy profiles_select_self on public.profiles
  for select to authenticated using (id = (select auth.uid()));

-- Read only department context that is already accessible, not a staff directory.
create policy departments_select_context on public.departments for select to authenticated
  using (
    (select vittahub_private.is_system_admin())
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.department_id = departments.id)
    or exists (select 1 from public.boards b where b.department_id = departments.id)
  );

create policy creation_authorizations_select on public.board_creation_authorizations
  for select to authenticated
  using (user_id = (select auth.uid()) or (select vittahub_private.is_system_admin()));
create policy creation_authorizations_insert on public.board_creation_authorizations
  for insert to authenticated
  with check ((select vittahub_private.is_system_admin()) and granted_by = (select auth.uid()));
create policy creation_authorizations_delete on public.board_creation_authorizations
  for delete to authenticated using ((select vittahub_private.is_system_admin()));

create policy boards_select on public.boards for select to authenticated
  using (vittahub_private.can_view_board(id));
create policy boards_insert on public.boards for insert to authenticated
  with check (
    created_by = (select auth.uid()) and exists (
      select 1 from public.board_creation_authorizations a where a.user_id = (select auth.uid())
    ) and exists (
      select 1 from public.profiles p where p.id = (select auth.uid())
        and (p.role = 'administrador' or p.department_id = boards.department_id)
    )
  );
create policy boards_update on public.boards for update to authenticated
  using (vittahub_private.can_manage_board(id))
  with check (vittahub_private.can_manage_board(id));

create policy memberships_select on public.board_memberships for select to authenticated
  using (user_id = (select auth.uid()) or vittahub_private.can_manage_board(board_id));
create policy memberships_insert on public.board_memberships for insert to authenticated
  with check (
    vittahub_private.can_manage_board(board_id)
    and added_by = (select auth.uid()) and not is_board_admin
  );
create policy memberships_delete on public.board_memberships for delete to authenticated
  using (vittahub_private.can_manage_board(board_id));

create policy columns_select on public.board_columns for select to authenticated
  using (vittahub_private.can_view_board(board_id));
create policy columns_insert on public.board_columns for insert to authenticated
  with check (vittahub_private.can_manage_board(board_id));
create policy columns_update on public.board_columns for update to authenticated
  using (vittahub_private.can_manage_board(board_id))
  with check (vittahub_private.can_manage_board(board_id));

-- Explicit API entry point: checks caller authorization before privileged INSERT.
-- Returns only the generated ID after the creator trigger has succeeded. This also
-- avoids INSERT RETURNING visibility checks running before an AFTER trigger.
create function public.create_board(p_title text, p_department_id uuid, p_description text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := auth.uid();
  new_board_id uuid;
begin
  if caller_id is null or not exists (
    select 1 from public.board_creation_authorizations a where a.user_id = caller_id
  ) then
    raise exception 'Board creation requires an explicit authorization' using errcode = '42501';
  end if;
  -- The department comes from the caller's stored profile, never from user metadata.
  -- A global administrator still needs the explicit creation authorization above.
  if p_department_id is null or not exists (
    select 1 from public.profiles p where p.id = caller_id
      and (p.role = 'administrador' or p.department_id = p_department_id)
  ) then
    raise exception 'Board department is not allowed for this user' using errcode = '42501';
  end if;
  insert into public.boards (title, department_id, description, created_by)
  values (p_title, p_department_id, p_description, caller_id)
  returning id into new_board_id;
  return new_board_id;
end;
$$;
alter function public.create_board(text, uuid, text) owner to postgres;
revoke all on function public.create_board(text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_board(text, uuid, text) to authenticated;

-- Only an existing OTHER participant may be promoted. The caller is never an input.
-- No general UPDATE grant, demotion flag, enrollment or change of application role.
create function public.promote_board_member(p_board_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or not vittahub_private.can_manage_board(p_board_id) then
    raise exception 'Board administration is required' using errcode = '42501';
  end if;
  if p_user_id = caller_id then
    raise exception 'Only another participant can be promoted' using errcode = '42501';
  end if;

  update public.board_memberships set is_board_admin = true
  where board_id = p_board_id and user_id = p_user_id;
  if not found then
    raise exception 'Participant does not exist in this board' using errcode = 'P0002';
  end if;
end;
$$;
alter function public.promote_board_member(uuid, uuid) owner to postgres;
revoke all on function public.promote_board_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.promote_board_member(uuid, uuid) to authenticated;

comment on table public.profiles is 'Controlled provisioning only; one required organizational department.';
comment on table public.boards is 'Department is organizational, not an access grant. Creator membership is atomic.';
comment on table public.board_memberships is 'Explicit board participation; only creator receives admin automatically. Existing participants may be promoted only through the checked RPC.';
comment on table public.board_creation_authorizations is 'Only system administrators grant/revoke creation; not a grant to existing boards.';
commit;
