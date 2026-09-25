# VittaHub — modelo inicial de identidade, quadros e permissões

Atualizado em 24/09/2026, Tarefa 04. **Arquivos para revisão; migration e testes SQL não executados.** VittaHub é o aplicativo da empresa Vacivitta. As decisões aprovadas estão nas seções 11 e 12 de [decisoes.md](decisoes.md), que prevalecem sobre as formulações anteriores. A interface Angular permanece intacta.

## 1. Escopo e situação

A migration `supabase/migrations/20260924150000_identity_kanban_foundation.sql` foi revisada no próprio arquivo porque ainda não foi aplicada em nenhum banco, conforme informado pelo desenvolvedor. Não usar essa estratégia depois da primeira aplicação: alterações posteriores exigirão nova migration versionada.

Docker Desktop está disponível, mas o desenvolvedor proibiu nesta tarefa iniciar a stack, aplicar migrations, executar SQL/testes SQL e acessar o Supabase remoto. Nenhum desses passos foi executado. Não há tabelas de pendências ou mensagens, seeds, contas reais nem alteração do schema gerenciado Auth.

## 2. Tabelas e constraints

| Tabela | Campos relevantes | Integridade |
| --- | --- | --- |
| departments | id, name, created_at | UUID PK; nome não vazio |
| profiles | id, department_id, display_name opcional, role, created_at | id PK/FK auth.users; departamento obrigatório FK departments; papel obrigatório |
| board_creation_authorizations | user_id, granted_by, granted_at | user_id PK/FK profiles; concedente FK profiles, definido pela sessão |
| boards | id, department_id, title, description, created_by, created_at | departamento obrigatório FK departments; criador obrigatório FK profiles; título não vazio |
| board_memberships | board_id, user_id, is_board_admin, added_by, added_at | PK composta quadro/usuário; FKs obrigatórias; participação comum por padrão |
| board_columns | id, board_id, title, position, business_state opcional, created_at | FK boards; posição não negativa; UNIQUE(board_id, position) adiável |

`application_role` contém membro, gestor e administrador. `kanban_business_state` contém apenas aguardando_aceite, a_fazer, fazendo, aguardando_terceiro e concluido. Estado NULL representa coluna organizacional, sem transição implícita. Não há unicidade de nomes nem de estado por quadro, pois essas restrições não foram aprovadas.

Cada perfil e quadro tem exatamente um departamento principal. Não há tabela N:N departamental nem herança de acesso por departamento. Os vínculos entre pessoas e quadros são exclusivamente participações explícitas, além do acesso global de administradores do sistema.

Todos os relacionamentos usam ON DELETE RESTRICT. A API não permite exclusão de perfis/departamentos/quadros/colunas; o procedimento de retenção e exclusão permanece pendente. Participações e autorizações de criação podem ser removidas por quem foi autorizado. A autoria é preservada mesmo quando a participação do criador é removida.

Índices: PKs; profiles(department_id); boards(department_id) e boards(created_by); authorizations(granted_by); memberships(user_id, board_id) e memberships(added_by); UNIQUE(board_id, position), que também atende à FK de colunas e à ordenação. A PK de memberships atende à consulta por quadro/usuário. Não há índices redundantes para os enums.

## 3. RLS e grants preparados

RLS habilitada e forçada nas seis tabelas. Grants herdados de PUBLIC/anon/authenticated são removidos desses objetos, e somente operações e colunas necessárias são concedidas. `anon` não recebe acesso a tabelas ou RPC. A existência de uma sessão Auth sem perfil provisionado não concede acesso à aplicação.

| Recurso | Leitura | Escrita pela API |
| --- | --- | --- |
| profiles | Somente o próprio perfil | Nenhuma; provisionamento administrativo controlado |
| departments | Departamento próprio, departamento de quadro visível; administrador do sistema vê todos | Nenhuma; cadastro administrativo controlado |
| board_creation_authorizations | Própria autorização ou administrador do sistema | Administrador do sistema inclui user_id ou remove autorização; concedente e data não são editáveis |
| boards | Participante autorizado ou administrador do sistema | Criação só por create_board; administrador do quadro/sistema edita título e descrição |
| board_memberships | Própria participação ou administrador do quadro/sistema | Administrador do quadro/sistema inclui/remove participantes e promove outro participante pela RPC controlada |
| board_columns | Mesma visibilidade do quadro | Administrador do quadro/sistema cria e edita título, posição e associação opcional de estado |

O diretório completo de perfis e a listagem completa de participantes para participantes comuns não foram liberados. Para adicionar alguém, a operação usa UUID de perfil já provisionado, fornecido pelo procedimento administrativo; a futura seleção visual de colegas depende da regra de diretório. Nomes/roles dos colegas não são expostos por JOIN que contorne RLS.

Todos que criam quadros precisam de autorização explícita, inclusive administradores do sistema; estes podem registrar sua própria autorização. A autorização não dispensa o limite departamental: membros e gestores, mesmo administrando algum quadro, criam somente no próprio departamento principal. O papel administrador permite escolher qualquer departamento existente, mantendo a autorização explícita obrigatória. Essa autorização é independente da participação: revogá-la impede novos quadros, mas não apaga participações já concedidas. Autorização de criação não dá acesso a quadros de outras pessoas.

Inclusão de participantes não aceita `is_board_admin`, `added_by` ou `added_at` do cliente. Promoção posterior usa exclusivamente promote_board_member. Não há grant de UPDATE direto em memberships; isso impede promoção por UPDATE/UPSERT, rebaixamento, troca de user_id e transferência de board_id. Somente o trigger de criação inclui automaticamente participação administrativa.

A autorização aprovada para remover participantes se aplica também a criador e administrador de quadro. Não existe acesso permanente por `created_by` nem proteção inventada de último administrador. Depois da remoção, a pessoa perde leitura e administração naquele quadro, salvo se for administradora do sistema. O quadro pode ficar sem administrador local; o administrador do sistema conserva administração global. A decisão definitiva é não proteger o último administrador local, inclusive contra sua própria remoção. Para recuperar a administração local, o administrador global pode adicionar outro usuário como participante comum, se necessário, e promovê-lo pela RPC; não precisa criar quadro nem ter autorização de criação para isso.

## 4. Criação atômica e funções confiáveis

Única entrada de criação pela API: `public.create_board(p_title text, p_department_id uuid, p_description text default null)`, que retorna UUID.

1. Captura auth.uid(); rejeita identidade ausente ou sem autorização de criação vigente.
2. Valida que o departamento solicitado é o departamento principal do perfil, exceto para o papel administrador. NULL é rejeitado; a FK exige um departamento existente. Insere o quadro com created_by fixado na identidade autenticada. Não recebe autor, UUID de quadro ou timestamps como argumentos.
3. O trigger AFTER INSERT `boards_add_creator` inclui o criador em board_memberships com is_board_admin=true e added_by=created_by.
4. Retorna apenas o UUID gerado, depois do sucesso do trigger. Qualquer falha desfaz quadro e participação na mesma operação.

Não há grant de INSERT direto em boards. A policy boards_insert também registra autoria, autorização explícita e limite departamental esperados, mas não é concedido um caminho direto que permita contornar a RPC. A função SECURITY DEFINER deve validar explicitamente a autorização porque seu owner confiável bypassa RLS. A leitura do resultado ocorre depois da criação da participação; não depende de INSERT RETURNING do cliente avaliando RLS antes do trigger AFTER.

Funções `is_system_admin`, `can_view_board`, `can_manage_board` e `add_board_creator` ficam em `vittahub_private`, fora dos schemas expostos pela configuração atual da API. Os helpers recebem somente board_id, nunca o user_id de outro usuário; consultam auth.uid() e os papéis/participações no banco. Não usam raw_user_meta_data nem dependem de papel armazenado num JWT antigo.

Todas as funções SECURITY DEFINER têm owner postgres explícito, search_path vazio e nomes qualificados. EXECUTE é revogado de PUBLIC/anon; authenticated recebe apenas os helpers booleanos necessários às policies e as duas RPCs verificadas. A função de trigger não recebe EXECUTE de cliente. authenticated recebe USAGE, mas não CREATE, no schema privado. Não expor esse schema no PostgREST.

Esse desenho evita recursão das policies de participação. FORCE RLS não impede bypass por postgres/service_role; essas identidades são confiáveis e nunca devem ser usadas para simular um usuário final nos testes de autorização. Nenhuma credencial privilegiada deve estar no Angular.

IDs, autoria, departamento do quadro, campos de concessão e timestamps não são atualizáveis via grants de coluna. UPDATE de quadro/coluna combina USING e WITH CHECK; board_id de coluna não pode ser alterado. A revogação vale nas requisições seguintes segundo a visibilidade transacional PostgreSQL, sem esperar renovação do JWT; não se promete cancelar uma operação já em andamento.

### 4.1. Promoção controlada e recuperação

`public.promote_board_member(p_board_id uuid, p_user_id uuid)` retorna void. O segundo parâmetro é o destinatário, não a identidade do autor. A função obtém o autor exclusivamente de auth.uid() e verifica administração local ou papel global administrador antes de consultar/alterar o alvo.

Somente outro participante já existente no quadro pode ser promovido. Tentativas sem autorização ou contra o próprio autor falham com SQLSTATE 42501. Participação inexistente falha com P0002; não há INSERT/UPSERT implícito. Repetir a promoção de outro administrador já existente é inofensivo. Somente is_board_admin é definido como true; papel em profiles, IDs, concedente original e timestamps da participação permanecem intactos. Não existe parâmetro para rebaixamento.

A função segue o mesmo padrão SECURITY DEFINER, owner postgres, search_path vazio, nomes qualificados e EXECUTE somente para authenticated. Como bypassa RLS internamente, o controle explícito antes do UPDATE é indispensável; a API continua sem UPDATE direto em board_memberships. O nome único do papel global é administrador, distinto do booleano de administração local.

A remoção da última participação administrativa não é impedida. A recuperação usa os caminhos já autorizados de inclusão comum e promoção pelo administrador global. São duas operações quando a pessoa ainda não participa: se a promoção falhar, a inclusão comum permanece e a promoção pode ser repetida após verificar o motivo. O acesso global não depende dessa participação, portanto o quadro continua recuperável.

Riscos a validar na execução local futura: grants e funções SECURITY DEFINER; isolamento sob RLS; concorrência entre remoção e promoção segundo a visibilidade transacional PostgreSQL. A promoção não promete cancelar operações já iniciadas nem implementar histórico de auditoria adicional. Não há rebaixamento nesta entrega.

## 5. Auth e provisionamento

Não existe trigger de signup nem promoção por metadata. A ligação é profiles.id = auth.users.id, usando a PK gerenciada pelo Auth. E-mail, senha e sessões continuam somente no Auth. A ordem do bootstrap é:

**Departamento → identidade Auth → perfil com role e departamento explícitos.**

O procedimento completo, incluindo recuperação de falhas parciais, está em [provisionamento-inicial.md](provisionamento-inicial.md). A migration não tenta criar o primeiro administrador: isso depende de ambiente e identidade autorizados. Criar o perfil por caminho administrativo confiável evita dependência circular de uma policy que exigisse um administrador já existente.

A configuração local ainda permite signup e usa URLs Auth na porta 3000. Esses pontos não foram alterados nesta tarefa e devem ser ajustados antes da integração/habilitação de contas. A configuração remota não foi consultada. Ter identidade Auth sem perfil não libera dados; isso não substitui a restrição de cadastro exigida pela documentação.

## 6. Testes preparados, não executados

`supabase/tests/identity_kanban_foundation.test.sql` é uma suíte pgTAP com BEGIN/ROLLBACK e identidades exclusivamente fictícias, sem senha ou e-mail. O provisionamento de fixtures segue departamento → identidade → perfil. As asserções de acesso executam SET LOCAL ROLE authenticated/anon e trocam sub para simular pessoas distintas; somente preparação e inspeção estrutural usam privilégio de banco.

Cobertura planejada no SQL:

- Seis tabelas, RLS habilitada/forçada, grants de funções e schema privado.
- Departamento obrigatório, FKs, enums, posição de coluna e participação única.
- Mesmo departamento sem acesso; participação autorizada entre departamentos.
- Acesso global do administrador do sistema; gestor sem privilégios implícitos.
- Concessão e revogação de criação apenas por administrador do sistema.
- Criação positiva por RPC, identidade do autor e participação administrativa automática.
- Falha injetada na participação do criador e rollback do quadro inteiro.
- Inclusão/remoção por administradores de quadro e sistema; participante comum não convida nem remove.
- Revogação de participação remove acesso ao quadro e colunas; autoria não dá acesso permanente.
- UPDATE/UPSERT de perfil, promoção direta fora da RPC, grantor forjado, autoria forjada e troca de quadro/departamento bloqueados.
- Criação/edição de colunas e edição de quadros por administradores; negação aos demais.
- Ausência de perfil/sub e anon sem acesso.
- Promoção por administrador local/global; administrador recém-promovido administra e promove outro; repetição inofensiva.
- Autopromoção e promoção de terceiros por participante comum, autor sem sessão, administrador de outro quadro e alvo não participante rejeitados.
- Promoção não altera papel global nem concedente original; UPDATE direto e rebaixamento continuam negados.
- Remoção do último administrador local, recuperação global com inclusão seguida de promoção, e remoção própria do último administrador recuperado.
- Criação no próprio departamento por membro/gestor autorizado; negação em outro departamento mesmo com administração local ou metadata forjada.
- Administrador global escolhe outro departamento, mas continua precisando de autorização explícita; departamento inválido/NULL é rejeitado.
- Nome de papel admin rejeitado: o enum conserva exclusivamente membro, gestor e administrador.

Depois de revisão e **nova autorização explícita**, a validação deverá ocorrer exclusivamente numa stack local aprovada: aplicação local da migration, execução de pgTAP, lint local e conferência de que fixtures e triggers de teste foram revertidos. Exigir zero falhas e código de saída zero. Nenhum comando de inicialização/aplicação/teste SQL é autorizado por este documento. Não usar o projeto vinculado para testes.

Build e testes Angular não validam sintaxe ou comportamento SQL. A revisão atual é estática; a segurança só poderá ser confirmada em execução após autorização.

## 7. Pendências

- Rebaixamento de administradores locais não foi aprovado e não está implementado. Promoção e ausência de proteção ao último administrador já são decisões definitivas.
- Diretório de colegas e visibilidade da lista completa de participantes para membros comuns.
- CRUD/desativação de departamentos e perfis; alteração de papéis; transferência de departamento/autoria e políticas de exclusão/retenção.
- Domínio corporativo, signup restrito, convites/recuperação e tratamento de contas preexistentes.
- Regras de pendências continuam fora desta tarefa; colunas vinculadas não implementam transições.

## 8. Referências técnicas

- [Supabase: RLS, grants e auth.uid](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase: integração de perfis com Auth](https://supabase.com/docs/guides/auth/managing-user-data).
- A configuração local usa PostgreSQL 17 e schemas de API public/graphql_public. Nenhuma consulta remota foi realizada.
