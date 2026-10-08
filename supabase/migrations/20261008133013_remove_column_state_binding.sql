-- Revised Task 26A: remove only the API and constraint introduced by the old 26A.
-- The legacy column and enum predate 26A and remain for compatibility.
-- Card movement already changes only column_id, independently of business_state.
begin;
drop function public.set_board_column_state(uuid, public.kanban_business_state);
alter table public.board_columns drop constraint board_columns_allowed_business_state;
commit;
