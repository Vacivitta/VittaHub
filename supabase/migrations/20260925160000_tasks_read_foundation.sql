-- VittaHub Task 08. REVIEW ONLY: do not apply without separate authorization.
-- Incremental over the already applied identity/kanban foundation. No seed data.
begin;

-- Required target key for the composite FK; the existing column PK remains intact.
alter table public.board_columns
  add constraint board_columns_board_id_id_key unique (board_id, id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete restrict,
  column_id uuid not null,
  title text not null check (length(btrim(title)) > 0),
  description text,
  created_by uuid not null default auth.uid()
    references public.profiles (id) on delete restrict,
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  due_at timestamptz not null,
  business_state public.kanban_business_state not null default 'aguardando_aceite',
  is_private boolean not null,
  created_at timestamptz not null default now(),
  constraint tasks_board_column_fkey foreign key (board_id, column_id)
    references public.board_columns (board_id, id) on delete restrict
);

-- Board/column listing with stable chronological order; also covers both board FKs.
create index tasks_board_column_created_idx
  on public.tasks (board_id, column_id, created_at, id);
-- Future own-task/deadline listings and assignee FK checks.
create index tasks_assignee_due_idx on public.tasks (assignee_id, due_at);
-- Creator lookups and creator FK checks. No membership FK: removal must preserve tasks.
create index tasks_created_by_idx on public.tasks (created_by);

alter table public.tasks enable row level security;
alter table public.tasks force row level security;
revoke all on table public.tasks from public, anon, authenticated;
grant select on public.tasks to authenticated;

-- Reuse trusted helpers: current identity and roles come from the database.
-- Local authors, assignees and board admins lose access after membership removal.
create policy tasks_select on public.tasks for select to authenticated
using (
  (select vittahub_private.is_system_admin())
  or (
    vittahub_private.can_view_board(board_id)
    and (
      not is_private
      or created_by = (select auth.uid())
      or assignee_id = (select auth.uid())
      or vittahub_private.can_manage_board(board_id)
    )
  )
);

comment on table public.tasks is
  'Read-only API foundation. No client writes or workflow RPCs. Membership removal preserves task records and authorship.';
comment on column public.tasks.business_state is
  'Independent of organizational column. Existing enum only; no transitions or automatic synchronization implemented.';
comment on column public.tasks.is_private is
  'Explicit classification required. Private read: active creator, assignee, board admin, or global administrator.';
comment on column public.tasks.created_by is
  'Defaults to auth.uid(); no application INSERT or UPDATE grant. Future creation must derive identity server-side.';
comment on column public.tasks.created_at is
  'Creation audit only. Workflow event history and controlled update timestamps are deferred.';
comment on column public.tasks.due_at is
  'Required instant with timezone; overdue deadlines are allowed. No postponement workflow in this migration.';

commit;

