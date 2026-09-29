-- LOCAL DEMO DATA ONLY
-- NEVER RUN AGAINST PRODUCTION
-- Idempotent presentation dataset for the local VittaHub database.

begin;

create temp table demo_users (
  member_id uuid not null,
  manager_id uuid not null,
  department_id uuid not null
) on commit drop;

do $$
declare
  member_record record;
  manager_record record;
begin
  select p.id, p.department_id, p.display_name, p.role, p.is_active
  into member_record
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = 'teste@exemplo.com';

  select p.id, p.department_id, p.display_name, p.role, p.is_active
  into manager_record
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = 'teste2@exemplo.com';

  if member_record.id is null then
    raise exception 'Demo seed aborted: teste@exemplo.com was not found in auth.users + profiles';
  end if;
  if manager_record.id is null then
    raise exception 'Demo seed aborted: teste2@exemplo.com was not found in auth.users + profiles';
  end if;
  if member_record.role <> 'membro' or not member_record.is_active then
    raise exception 'Demo seed aborted: teste@exemplo.com must be an active membro';
  end if;
  if manager_record.role <> 'gestor' or not manager_record.is_active then
    raise exception 'Demo seed aborted: teste2@exemplo.com must be an active gestor';
  end if;

  insert into demo_users values (member_record.id, manager_record.id, manager_record.department_id);
end;
$$;

create temp table demo_chat_counts as
select
  (select count(*) from public.conversations) as conversations,
  (select count(*) from public.conversation_participants) as participants,
  (select count(*) from public.messages) as messages;

-- Idempotent cleanup restricted to reserved demo board IDs.
delete from public.task_comments where task_id in (
  select id from public.tasks where board_id in (
    'de000001-0000-4000-8000-000000000001','de000001-0000-4000-8000-000000000002','de000001-0000-4000-8000-000000000003'));
delete from public.task_events where task_id in (
  select id from public.tasks where board_id in (
    'de000001-0000-4000-8000-000000000001','de000001-0000-4000-8000-000000000002','de000001-0000-4000-8000-000000000003'));
delete from public.tasks where board_id in (
  'de000001-0000-4000-8000-000000000001','de000001-0000-4000-8000-000000000002','de000001-0000-4000-8000-000000000003');
delete from public.board_memberships where board_id in (
  'de000001-0000-4000-8000-000000000001','de000001-0000-4000-8000-000000000002','de000001-0000-4000-8000-000000000003');
delete from public.board_columns where board_id in (
  'de000001-0000-4000-8000-000000000001','de000001-0000-4000-8000-000000000002','de000001-0000-4000-8000-000000000003');
delete from public.boards where id in (
  'de000001-0000-4000-8000-000000000001','de000001-0000-4000-8000-000000000002','de000001-0000-4000-8000-000000000003');

insert into public.boards (id, department_id, title, description, created_by, created_at)
select 'de000001-0000-4000-8000-000000000001'::uuid, department_id,
  'Operação da Unidade',
  'Rotinas operacionais, manutenção, estoque e demandas administrativas da unidade.',
  manager_id, statement_timestamp() - interval '6 days'
from demo_users
union all
select 'de000001-0000-4000-8000-000000000002'::uuid, department_id,
  'Projetos e Melhorias',
  'Acompanhamento de melhorias internas, tecnologia e implantação de novos processos.',
  manager_id, statement_timestamp() - interval '4 days'
from demo_users
union all
select 'de000001-0000-4000-8000-000000000003'::uuid, department_id,
  'Administrativo e Fornecedores',
  'Demandas administrativas, compras e acompanhamento de fornecedores.',
  manager_id, statement_timestamp() - interval '2 days'
from demo_users;

insert into public.board_memberships (board_id, user_id, is_board_admin, added_by)
select board_id, member_id, false, manager_id
from demo_users
cross join (values
  ('de000001-0000-4000-8000-000000000001'::uuid),
  ('de000001-0000-4000-8000-000000000002'::uuid),
  ('de000001-0000-4000-8000-000000000003'::uuid)
) boards(board_id);

insert into public.board_columns (id, board_id, title, position, business_state) values
  ('de000002-0000-4000-8000-000000000001','de000001-0000-4000-8000-000000000001','Entrada',0,null),
  ('de000002-0000-4000-8000-000000000002','de000001-0000-4000-8000-000000000001','A fazer',1,null),
  ('de000002-0000-4000-8000-000000000003','de000001-0000-4000-8000-000000000001','Em execução',2,null),
  ('de000002-0000-4000-8000-000000000004','de000001-0000-4000-8000-000000000001','Aguardando terceiro',3,null),
  ('de000002-0000-4000-8000-000000000005','de000001-0000-4000-8000-000000000001','Concluído',4,null),
  ('de000002-0000-4000-8000-000000000006','de000001-0000-4000-8000-000000000002','Backlog',0,null),
  ('de000002-0000-4000-8000-000000000007','de000001-0000-4000-8000-000000000002','Planejado',1,null),
  ('de000002-0000-4000-8000-000000000008','de000001-0000-4000-8000-000000000002','Em desenvolvimento',2,null),
  ('de000002-0000-4000-8000-000000000009','de000001-0000-4000-8000-000000000002','Validação',3,null),
  ('de000002-0000-4000-8000-000000000010','de000001-0000-4000-8000-000000000002','Finalizado',4,null),
  ('de000002-0000-4000-8000-000000000011','de000001-0000-4000-8000-000000000003','Solicitações',0,null),
  ('de000002-0000-4000-8000-000000000012','de000001-0000-4000-8000-000000000003','Cotação',1,null),
  ('de000002-0000-4000-8000-000000000013','de000001-0000-4000-8000-000000000003','Aguardando fornecedor',2,null),
  ('de000002-0000-4000-8000-000000000014','de000001-0000-4000-8000-000000000003','Aprovação interna',3,null),
  ('de000002-0000-4000-8000-000000000015','de000001-0000-4000-8000-000000000003','Finalizado',4,null);

create temp table demo_tasks (task_key text primary key, task_id uuid not null) on commit drop;
grant select on demo_users to authenticated;
grant select, insert on demo_tasks to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select manager_id::text from demo_users), true);

-- Operação da Unidade (6)
insert into demo_tasks values ('op_a', public.create_task('de000001-0000-4000-8000-000000000001','de000002-0000-4000-8000-000000000001','Validar solicitação de reposição de insumos',(select member_id from demo_users),(current_date + 1) + time '09:00',false,'Conferir a necessidade informada pela equipe e validar a reposição para os próximos dias.'));
insert into demo_tasks values ('op_b', public.create_task('de000001-0000-4000-8000-000000000001','de000002-0000-4000-8000-000000000002','Conferir estoque de materiais da recepção',(select member_id from demo_users),(current_date + 2) + time '10:30',false,'Revisar os itens de uso diário e registrar necessidades de reposição para a próxima semana.'));
insert into demo_tasks values ('op_c', public.create_task('de000001-0000-4000-8000-000000000001','de000002-0000-4000-8000-000000000003','Atualizar checklist de abertura da unidade',(select manager_id from demo_users),(current_date + 3) + time '09:00',false,'Revisar o checklist utilizado pela equipe no início do expediente e validar os itens operacionais.'));
insert into demo_tasks values ('op_d', public.create_task('de000001-0000-4000-8000-000000000001','de000002-0000-4000-8000-000000000004','Confirmar manutenção preventiva do ar-condicionado',(select manager_id from demo_users),(current_date + 4) + time '14:00',false,'Acompanhar com o fornecedor a manutenção preventiva dos equipamentos da unidade.'));
insert into demo_tasks values ('op_e', public.create_task('de000001-0000-4000-8000-000000000001','de000002-0000-4000-8000-000000000002','Revisar escala operacional da próxima semana',(select manager_id from demo_users),(current_date + 5) + time '16:00',true,'Conferir horários e responsabilidades antes da divulgação da escala para a equipe.'));
insert into demo_tasks values ('op_f', public.create_task('de000001-0000-4000-8000-000000000001','de000002-0000-4000-8000-000000000005','Enviar relatório mensal de operação',(select member_id from demo_users),(current_date + 6) + time '10:30',false,'Consolidar os principais indicadores operacionais do mês e encaminhar o relatório para acompanhamento interno.'));

-- Projetos e Melhorias (5); columns remain purely organizational.
insert into demo_tasks values ('pr_a', public.create_task('de000001-0000-4000-8000-000000000002','de000002-0000-4000-8000-000000000006','Revisar fluxo interno de abertura de chamados',(select member_id from demo_users),(current_date + 2) + time '09:00',false,'Mapear o fluxo atual e identificar pontos de simplificação no atendimento interno.'));
insert into demo_tasks values ('pr_b', public.create_task('de000001-0000-4000-8000-000000000002','de000002-0000-4000-8000-000000000007','Padronizar modelo de relatório gerencial',(select manager_id from demo_users),(current_date + 4) + time '14:00',false,'Definir uma estrutura única para consolidação e leitura dos indicadores mensais.'));
insert into demo_tasks values ('pr_c', public.create_task('de000001-0000-4000-8000-000000000002','de000002-0000-4000-8000-000000000008','Validar nova rotina de conferência de estoque',(select manager_id from demo_users),(current_date + 5) + time '10:30',false,'Executar a rotina piloto e registrar ajustes necessários antes da adoção pela equipe.'));
insert into demo_tasks values ('pr_d', public.create_task('de000001-0000-4000-8000-000000000002','de000002-0000-4000-8000-000000000009','Documentar processo de integração entre sistemas',(select member_id from demo_users),(current_date + 7) + time '16:00',false,'Consolidar dependências, responsáveis e critérios de validação da integração.'));
insert into demo_tasks values ('pr_e', public.create_task('de000001-0000-4000-8000-000000000002','de000002-0000-4000-8000-000000000010','Preparar treinamento da equipe para novo fluxo',(select member_id from demo_users),(current_date + 8) + time '14:00',false,'Organizar material objetivo e roteiro prático para apresentação do novo processo.'));

-- Administrativo e Fornecedores (5)
insert into demo_tasks values ('ad_a', public.create_task('de000001-0000-4000-8000-000000000003','de000002-0000-4000-8000-000000000011','Solicitar cotação de materiais de escritório',(select member_id from demo_users),(current_date + 1) + time '10:30',false,'Levantar quantidades e solicitar propostas aos fornecedores homologados.'));
insert into demo_tasks values ('ad_b', public.create_task('de000001-0000-4000-8000-000000000003','de000002-0000-4000-8000-000000000012','Renovar contrato de manutenção preventiva',(select manager_id from demo_users),(current_date + 3) + time '09:00',false,'Revisar condições vigentes e preparar a renovação do serviço recorrente.'));
insert into demo_tasks values ('ad_c', public.create_task('de000001-0000-4000-8000-000000000003','de000002-0000-4000-8000-000000000013','Validar proposta de fornecedor de uniformes',(select manager_id from demo_users),(current_date + 6) + time '14:00',false,'Conferir valores, prazos e especificações apresentados pelo fornecedor.'));
insert into demo_tasks values ('ad_d', public.create_task('de000001-0000-4000-8000-000000000003','de000002-0000-4000-8000-000000000015','Confirmar prazo de entrega dos novos equipamentos',(select member_id from demo_users),(current_date + 7) + time '10:30',false,'Validar o cronograma final de entrega e comunicar as áreas envolvidas.'));
insert into demo_tasks values ('ad_e', public.create_task('de000001-0000-4000-8000-000000000003','de000002-0000-4000-8000-000000000014','Organizar documentação para renovação contratual',(select manager_id from demo_users),(current_date + 9) + time '16:00',false,'Reunir documentos, aprovações e comprovantes necessários para a renovação.'));

-- Manager-owned transitions.
select public.start_task((select task_id from demo_tasks where task_key='op_c'));
select public.start_task((select task_id from demo_tasks where task_key='op_d'));
select public.wait_task_for_third_party((select task_id from demo_tasks where task_key='op_d'),'Fornecedor confirmou atendimento para quarta-feira no período da manhã.');
select public.start_task((select task_id from demo_tasks where task_key='pr_c'));
select public.start_task((select task_id from demo_tasks where task_key='ad_b'));
select public.start_task((select task_id from demo_tasks where task_key='ad_c'));
select public.wait_task_for_third_party((select task_id from demo_tasks where task_key='ad_c'),'Fornecedor enviará a amostra e a grade final de tamanhos até sexta-feira.');

-- Member-owned transitions.
select set_config('request.jwt.claim.sub', (select member_id::text from demo_users), true);
select public.accept_task((select task_id from demo_tasks where task_key='op_b'));
select public.accept_task((select task_id from demo_tasks where task_key='op_f'));
select public.start_task((select task_id from demo_tasks where task_key='op_f'));
select public.add_task_comment((select task_id from demo_tasks where task_key='op_f'),'Indicadores revisados e relatório final conferido.');
select public.complete_task((select task_id from demo_tasks where task_key='op_f'));
select public.accept_task((select task_id from demo_tasks where task_key='pr_d'));
select public.start_task((select task_id from demo_tasks where task_key='pr_d'));
select public.wait_task_for_third_party((select task_id from demo_tasks where task_key='pr_d'),'Equipe técnica confirmou a revisão do diagrama de integração para amanhã.');
select public.accept_task((select task_id from demo_tasks where task_key='pr_e'));
select public.start_task((select task_id from demo_tasks where task_key='pr_e'));
select public.add_task_comment((select task_id from demo_tasks where task_key='pr_e'),'Material revisado e roteiro de treinamento validado com a gestão.');
select public.complete_task((select task_id from demo_tasks where task_key='pr_e'));
select public.accept_task((select task_id from demo_tasks where task_key='ad_d'));
select public.start_task((select task_id from demo_tasks where task_key='ad_d'));
select public.add_task_comment((select task_id from demo_tasks where task_key='ad_d'),'Fornecedor confirmou o cronograma e encaminhou o comprovante de expedição.');
select public.complete_task((select task_id from demo_tasks where task_key='ad_d'));

reset role;

-- Abort atomically if any demo invariant is not satisfied.
do $$
declare
  demo_boards uuid[] := array[
    'de000001-0000-4000-8000-000000000001'::uuid,
    'de000001-0000-4000-8000-000000000002'::uuid,
    'de000001-0000-4000-8000-000000000003'::uuid
  ];
begin
  if (select count(*) from public.boards where id = any(demo_boards)) <> 3 then raise exception 'Demo validation failed: boards'; end if;
  if (select count(*) from public.board_columns where board_id = any(demo_boards)) <> 15 then raise exception 'Demo validation failed: columns'; end if;
  if (select count(*) from public.board_memberships where board_id = any(demo_boards)) <> 6 then raise exception 'Demo validation failed: memberships'; end if;
  if (select count(*) from public.tasks where board_id = any(demo_boards)) <> 16 then raise exception 'Demo validation failed: tasks'; end if;
  if exists (select 1 from public.tasks t join public.board_columns c on c.id=t.column_id where t.board_id=any(demo_boards) and c.board_id<>t.board_id) then raise exception 'Demo validation failed: cross-board column'; end if;
  if (select count(*) from public.board_memberships m join demo_users u on true where m.board_id=any(demo_boards) and m.user_id in (u.member_id,u.manager_id)) <> 6 then raise exception 'Demo validation failed: participants'; end if;
  if (select count(*) from public.board_memberships m join demo_users u on m.user_id=u.manager_id where m.board_id=any(demo_boards) and m.is_board_admin) <> 3 then raise exception 'Demo validation failed: manager admin'; end if;
  if exists (select 1 from public.tasks where board_id=any(demo_boards) and is_private and assignee_id<>created_by) then raise exception 'Demo validation failed: private assignee'; end if;
  if not exists (select 1 from public.tasks where board_id=any(demo_boards) and is_private) then raise exception 'Demo validation failed: private task'; end if;
  if exists (select 1 from public.tasks t where t.board_id=any(demo_boards) and t.business_state='aguardando_terceiro' and not exists (select 1 from public.task_comments c where c.task_id=t.id)) then raise exception 'Demo validation failed: third-party explanation'; end if;
  if (select count(*) from public.task_comments c join public.tasks t on t.id=c.task_id where t.board_id=any(demo_boards)) = 0 then raise exception 'Demo validation failed: comments'; end if;
  if (select count(*) from public.task_events e join public.tasks t on t.id=e.task_id where t.board_id=any(demo_boards)) = 0 then raise exception 'Demo validation failed: events'; end if;
  if exists (select 1 from demo_chat_counts d where d.conversations<>(select count(*) from public.conversations) or d.participants<>(select count(*) from public.conversation_participants) or d.messages<>(select count(*) from public.messages)) then raise exception 'Demo validation failed: chat changed'; end if;
end;
$$;

commit;

select
  (select count(*) from public.boards where id::text like 'de000001-%') as boards,
  (select count(*) from public.board_columns where board_id::text like 'de000001-%') as columns,
  (select count(*) from public.board_memberships where board_id::text like 'de000001-%') as memberships,
  (select count(*) from public.tasks where board_id::text like 'de000001-%') as tasks,
  (select count(*) from public.task_comments c join public.tasks t on t.id=c.task_id where t.board_id::text like 'de000001-%') as comments,
  (select count(*) from public.task_events e join public.tasks t on t.id=e.task_id where t.board_id::text like 'de000001-%') as events;
