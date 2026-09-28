-- VittaHub Task 14. Publish only chat messages for Realtime Postgres Changes.
begin;

alter publication supabase_realtime add table public.messages;

commit;
