# VittaHub — procedimento administrativo de provisionamento inicial

Status: **roteiro para revisão, não executado**. Depende de autorização futura para aplicar a migration e operar no ambiente escolhido. Nesta tarefa não iniciar Supabase, executar SQL, criar contas ou acessar o remoto.

## 1. Responsabilidade e pré-condições

Um operador técnico autorizado provisiona as primeiras contas. Ele utiliza o painel administrativo do Supabase ou a Admin API em ferramenta confiável fora do frontend, e uma sessão administrativa de banco para departments/profiles. Não é um fluxo de cadastro público nem uma RPC de bootstrap aberta à aplicação.

Antes de executar futuramente:

- Obter aprovação do ambiente, das identidades fictícias/de teste, do departamento e do papel de cada pessoa. Confirmar explicitamente quem será o primeiro administrador.
- Revisar/aplicar a migration no ambiente autorizado e validar as policies em ambiente local separado. Não aplicar nada por inferência deste roteiro.
- Confirmar domínio corporativo e desabilitação de signup público. O config.toml local ainda está permissivo; não presumir que editar esse arquivo mudaria a configuração remota.
- Guardar segredos somente no mecanismo seguro da ferramenta administrativa; não registrar em SQL versionado, argumentos de comando, capturas de tela, logs ou código Angular.

## 2. Ordem obrigatória do primeiro administrador

### Passo 1 — Departamento

Na sessão administrativa de banco, cadastrar o departamento aprovado em public.departments, preenchendo name, e guardar o UUID retornado. O UUID é gerado pelo banco. Se o departamento já existir, conferir seu ID com o responsável e reutilizá-lo; não deduzir identidade por nome porque nomes não são únicos.

Essa etapa não depende de profile nem de auth.users. A falta de grant de escrita para authenticated é intencional: o primeiro departamento é criado pelo operador confiável, não pela aplicação.

### Passo 2 — Identidade Supabase Auth

Criar a identidade aprovada usando o painel Auth ou a Admin API, nunca INSERT manual em auth.users para contas operacionais. Utilizar o mecanismo aprovado de convite/definição de credencial, ainda a definir. Não colocar role de aplicação em user_metadata como forma de autorização.

Guardar o UUID devolvido pelo Auth e conferir a identidade no ambiente correto. Não criar perfil antes de obter esse UUID. Não considerar a existência da identidade como autorização de acesso ao VittaHub.

### Passo 3 — Perfil

Na sessão administrativa de banco, em transação curta, conferir a existência do departamento e da identidade e inserir public.profiles com:

| Campo | Primeiro administrador |
| --- | --- |
| id | UUID retornado pelo Supabase Auth |
| department_id | UUID do departamento aprovado no passo 1 |
| display_name | Nome demonstrativo aprovado, quando necessário |
| role | administrador, explicitamente aprovado |
| created_at | Gerado pelo banco |

Usar INSERT simples, sem UPSERT que sobrescreva perfil existente e sem promoção automática de uma conta já provisionada. Se a PK já existir, interromper e comparar identidade/departamento/papel com o registro aprovado. Mudança de papéis requer procedimento separado.

A sessão administrativa confiável pode provisionar sem depender de um administrador de aplicação previamente existente. Nenhuma policy é desativada, nenhum grant temporário é aberto a anon/authenticated e não existe função pública para criar administradores globais.

### Passo 4 — Conferência

Confirmar a ligação exata departamento/Auth/perfil e o papel administrador. Em validação local futura autorizada, simular ou autenticar uma conta de aplicação sem service_role para verificar acesso global aos quadros. Guardar evidência sem credenciais, com operador, ambiente, IDs, data e aprovação do papel.

Para o administrador também criar quadros, registrar explicitamente sua autorização em board_creation_authorizations pelo fluxo administrativo da aplicação/API autenticada. O concedente será auth.uid(). Acesso global para visualizar/administrar quadros e autorização para criar novos são permissões independentes.

## 3. Demais funcionários

Repetir a ordem departamento existente → identidade Auth → perfil. Informar explicitamente o papel aprovado (membro, gestor ou administrador); nunca inferi-lo do domínio, departamento, metadata ou primeiro login.

O perfil precisa de exatamente um departamento principal. Ser membro do mesmo departamento que um quadro não concede acesso. Depois do provisionamento, um administrador do sistema ou do quadro pode incluir o UUID em board_memberships como participante comum, inclusive em outro departamento. Só administradores do sistema concedem autorização para criar quadros.

Não atribuir is_board_admin na inclusão comum. O criador recebe administração automaticamente. Conforme a Tarefa 04, administradores do quadro ou globais podem promover outro participante existente usando promote_board_member; essa operação não modifica o papel global do perfil. Para criar quadros, usuários autorizados ficam restritos ao seu departamento principal, exceto administradores globais, que podem escolher qualquer departamento existente.

## 4. Falhas parciais e repetição segura

Auth e cadastro do departamento/perfil ocorrem em operações diferentes; não prometer atomicidade entre painel/API Auth e transação de banco.

- Departamento criado, Auth falhou: manter o departamento aprovado e retomar a criação da identidade após diagnosticar a falha. Não apagar automaticamente.
- Identidade criada, perfil falhou: a identidade continua sem permissões da aplicação. Conferir UUID, departamento, FK e aprovação; retomar somente o INSERT de perfil. Não criar outra identidade nem abrir grants para contornar a falha.
- Perfil já existe: parar e revisar o registro; não fazer UPSERT, alteração de papel ou reutilização automática de uma identidade incompatível.
- Identidade ou papel incorreto: interromper a habilitação e solicitar correção administrativa. Exclusão, desativação e transferência de autoria têm regras pendentes; não executar limpeza em cascata.

Os fixtures dos testes SQL fazem INSERT em auth.users somente para simulação transacional local, sem credenciais. Eles não são um método de provisionamento operacional e serão revertidos por ROLLBACK quando os testes forem autorizados.

## 5. Decisões antes de habilitar contas

Domínio corporativo; operador responsável; contas autorizadas; mecanismo de convite/credencial e recuperação; desativação/alteração de papéis; ajustes de signup e URLs Auth no ambiente. Nenhuma conta real foi criada por esta entrega.
