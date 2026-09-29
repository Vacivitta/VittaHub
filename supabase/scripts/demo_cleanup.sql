-- LOCAL DEMO DATA ONLY
-- NEVER RUN AGAINST PRODUCTION
-- Removes only the reserved VittaHub presentation dataset.

begin;

delete from public.task_comments
where task_id in (
  select id from public.tasks
  where board_id in (
    'de000001-0000-4000-8000-000000000001',
    'de000001-0000-4000-8000-000000000002',
    'de000001-0000-4000-8000-000000000003'
  )
);

delete from public.task_events
where task_id in (
  select id from public.tasks
  where board_id in (
    'de000001-0000-4000-8000-000000000001',
    'de000001-0000-4000-8000-000000000002',
    'de000001-0000-4000-8000-000000000003'
  )
);

delete from public.tasks where board_id in (
  'de000001-0000-4000-8000-000000000001',
  'de000001-0000-4000-8000-000000000002',
  'de000001-0000-4000-8000-000000000003'
);
delete from public.board_memberships where board_id in (
  'de000001-0000-4000-8000-000000000001',
  'de000001-0000-4000-8000-000000000002',
  'de000001-0000-4000-8000-000000000003'
);
delete from public.board_columns where board_id in (
  'de000001-0000-4000-8000-000000000001',
  'de000001-0000-4000-8000-000000000002',
  'de000001-0000-4000-8000-000000000003'
);
delete from public.boards where id in (
  'de000001-0000-4000-8000-000000000001',
  'de000001-0000-4000-8000-000000000002',
  'de000001-0000-4000-8000-000000000003'
);

commit;
