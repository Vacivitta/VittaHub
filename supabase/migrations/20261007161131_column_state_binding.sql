begin;

alter table public.board_columns add constraint board_columns_allowed_business_state
  check (business_state is null or business_state in ('a_fazer', 'fazendo', 'aguardando_terceiro', 'concluido'));

create function public.set_board_column_state(p_column_id uuid, p_business_state public.kanban_business_state)
returns void language plpgsql security definer set search_path = '' as $$
declare target_board_id uuid;
begin
  select board_id into target_board_id from public.board_columns where id = p_column_id for update;
  if auth.uid() is null or target_board_id is null
    or not vittahub_private.can_manage_board_columns(target_board_id) then
    raise exception 'Board management is required' using errcode = '42501';
  end if;
  if p_business_state = 'aguardando_aceite' then
    raise exception 'Column state is not allowed' using errcode = '22023';
  end if;
  update public.board_columns set business_state = p_business_state where id = p_column_id;
end;
$$;
alter function public.set_board_column_state(uuid,public.kanban_business_state) owner to postgres;
revoke all on function public.set_board_column_state(uuid,public.kanban_business_state) from public, anon, authenticated;
grant execute on function public.set_board_column_state(uuid,public.kanban_business_state) to authenticated;
commit;
