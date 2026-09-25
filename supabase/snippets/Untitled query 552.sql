begin;

-- Cria o departamento de teste, caso ainda não exista.
insert into public.departments (name)
select 'Departamento de Testes'
where not exists (
  select 1
  from public.departments
  where name = 'Departamento de Testes'
);

-- Associa a conta existente ao departamento.
insert into public.profiles (
  id,
  department_id,
  display_name,
  role
)
select
  u.id,
  d.id,
  'Pessoa Teste',
  'membro'::public.application_role
from auth.users u
cross join public.departments d
where u.email = 'teste@exemplo.com'
  and d.name = 'Departamento de Testes'
  and not exists (
    select 1
    from public.profiles p
    where p.id = u.id
  );

commit;



select
  u.email,
  p.display_name,
  p.role,
  d.name as departamento
from public.profiles p
join auth.users u on u.id = p.id
join public.departments d on d.id = p.department_id
where u.email = 'teste@exemplo.com';