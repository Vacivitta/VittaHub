select
    b.title,
    d.name as departamento,
    u.email as criador
from public.boards b
join public.departments d
    on d.id = b.department_id
join auth.users u
    on u.id = b.created_by
where u.email = 'teste@exemplo.com'
  and b.title = 'Quadro de Testes';