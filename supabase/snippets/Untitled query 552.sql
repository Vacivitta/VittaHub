insert into public.board_columns (
    board_id,
    title,
    position,
    business_state
)
select
    b.id,
    c.title,
    c.position,
    c.business_state::public.kanban_business_state
from public.boards b
join auth.users u on u.id = b.created_by
cross join (
    values
        ('Entrada', 0, null),
        ('A fazer', 1, 'a_fazer'),
        ('Em andamento', 2, 'fazendo')
) as c(title, position, business_state)
where b.title = 'Quadro de Testes'
  and u.email = 'teste@exemplo.com'
  and not exists (
      select 1
      from public.board_columns existing
      where existing.board_id = b.id
        and existing.position = c.position
  );