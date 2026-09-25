# VittaHub — Registro de decisões da Vacivitta

Atualizado em: 24/09/2026
Status: decisões de planejamento para o protótipo funcional.

## 1. Objetivo da entrega

Desenvolver, em aproximadamente sete dias, uma aplicação web funcional para apresentação e testes iniciais com até quatro funcionários da Vacivitta.

A aplicação não substituirá o Trello nem o Slack nesta etapa. As duas ferramentas continuarão em uso normalmente.

O objetivo é demonstrar os principais fluxos funcionando com persistência de dados, e não apenas apresentar telas estáticas.

O prazo poderá ser ajustado se houver problemas críticos que impeçam o uso seguro do sistema.

## 2. Tecnologias

- Frontend: Angular, TypeScript e SCSS.
- Backend gerenciado: Supabase.
- Banco de dados: PostgreSQL do Supabase.
- Autenticação: Supabase Auth.
- Autorização: Row Level Security (RLS).
- Chat em tempo real: Supabase Realtime.
- Hospedagem: serviço gratuito de hospedagem estática, inicialmente Cloudflare Pages.
- Desenvolvimento: VS Code, Git e Codex CLI.

Não desenvolver um backend independente em Java ou Spring Boot para o protótipo.

## 3. Funcionalidades do protótipo

### Kanban
- Criação e edição de quadros por usuários autorizados.
- Criação e organização de colunas.
- Criação e edição de cards.
- Movimentação de cards entre colunas.
- Algumas colunas poderão estar vinculadas a estados de negócio.

### Pendências
- Responsável único e prazo obrigatório.
- Aceite de pendências atribuídas.
- Recusa com justificativa obrigatória.
- Pendências recusadas retornam ao criador para reatribuição.
- Solicitação e aprovação de adiamentos.
- Conclusão e reabertura de pendências.
- Comentários e histórico das principais ações.
- Sinalização visual de prazos vencidos.

### Chat
- Conversas individuais por texto.
- Conversas em grupo.
- Histórico persistido.
- Recebimento de novas mensagens em tempo real.
- Apenas gestores e administradores poderão criar grupos e administrar participantes.

## 4. Estados e movimentação

Os estados de negócio previstos são:
- aguardando_aceite
- a_fazer
- fazendo
- aguardando_terceiro
- concluido

As colunas Kanban poderão ser organizacionais ou vinculadas a um desses estados.

Mover um card para uma coluna vinculada a um estado deverá executar a transição correspondente, desde que todas as regras sejam respeitadas.

Se uma transição exigir dados adicionais, como justificativa ou comentário, a interface deverá solicitá-los.

Uma transição inválida não poderá ser persistida.

O fluxo exato de todas as transições ainda deverá ser detalhado em regras-negocio.md.

## 5. Permissões

- Perfis previstos: membro, gestor e administrador.
- Administradores autorizam quais usuários podem criar e administrar quadros.
- Itens privados poderão ser visualizados pelo criador e por administradores.
- Responsável, criador e administradores poderão reabrir pendências concluídas.
- A autenticação não concede automaticamente acesso a todos os quadros ou conversas.
- O acesso aos dados deverá ser protegido por políticas RLS.

## 6. Cadastro de usuários

O acesso será realizado por e-mail corporativo.

O domínio corporativo permitido ainda não foi informado.

Até essa definição, não liberar cadastro público indiscriminado. Utilizar contas de teste autorizadas durante o desenvolvimento.

## 7. Infraestrutura

A aplicação será desenvolvida localmente e posteriormente publicada em hospedagem gratuita.

O Supabase Free será utilizado inicialmente.

As contas corporativas definitivas ainda não estão disponíveis.

Durante o desenvolvimento, utilizar exclusivamente dados fictícios. O uso de dados reais e o convite a funcionários dependem de autorização da empresa e validação da segurança.

Nunca armazenar senhas, tokens secretos ou chaves privilegiadas no repositório ou no frontend.

## 8. Fora do escopo do protótipo

- Importação de dados do Trello.
- Integração ou migração de conversas do Slack.
- Substituição definitiva das ferramentas atuais.
- Notas pessoais.
- Notificações automáticas.
- E-mails diários.
- Respostas a e-mails convertidas em comentários.
- Chamadas de áudio e vídeo.
- Anexos e funcionalidades avançadas de comunicação.

Esses recursos poderão ser considerados após a apresentação inicial.

## 9. Decisões pendentes

- Confirmar o domínio corporativo permitido.
- Definir as transições exatas entre os estados das pendências.
- Definir o comportamento de uma pendência recusada enquanto aguarda reatribuição, sem criar um novo estado sem aprovação.
- Definir o estado de retorno e a exigência de justificativa na reabertura.
- Definir as regras específicas de pendências compartilhadas entre departamentos. O acesso aos quadros foi aprovado na seção 11.
- Confirmar a plataforma definitiva de hospedagem e a titularidade das contas.
- Confirmar a autorização para testes com funcionários reais.

## 10. Regras para implementação

A especificação técnica original continua sendo referência, mas decisões posteriores registradas neste arquivo prevalecem quando houver conflito.

Não interpretar decisões pendentes como requisitos aprovados.

Não implementar funcionalidades fora do escopo do protótipo sem autorização.

Priorizar funcionalidades completas e testáveis, mantendo a segurança e a integridade dos dados.

## 11. Decisões aprovadas — Tarefa 03 (24/09/2026)

Estas decisões complementam e prevalecem sobre as descrições anteriores de acesso a quadros. VittaHub é o aplicativo; Vacivitta é a empresa. Não há renomeação da interface nesta tarefa.

- Cada funcionário tem exatamente um departamento principal obrigatório.
- Cada quadro tem exatamente um departamento principal obrigatório.
- O vínculo departamental é organizacional; não concede leitura ou administração de quadros automaticamente.
- Funcionários podem participar de quadros de outros departamentos mediante autorização.
- Somente participantes autorizados e administradores do sistema podem visualizar quadros.
- Administradores do sistema têm acesso global aos quadros, independentemente de participação ou departamento.
- O criador recebe participação e permissão administrativa automaticamente na mesma operação de criação do quadro.
- Administradores do sistema e administradores de cada quadro podem adicionar e remover participantes.
- Administradores do sistema autorizam os usuários que podem criar quadros. Ser gestor não concede essa autorização.
- Os primeiros usuários e perfis serão cadastrados por procedimento administrativo controlado, sem cadastro livre pela aplicação.
- O cadastro do primeiro administrador deve respeitar a ordem: departamento existente, identidade Supabase Auth, perfil vinculado à identidade e ao departamento.

### Limites desta revisão

A migration inicial ainda não foi aplicada e será revisada no próprio arquivo, sem criar migration incremental sobre um schema inexistente. Nenhuma migration, teste SQL, inicialização local ou comando remoto será executado nesta tarefa, mesmo com Docker Desktop disponível. Os arquivos são entregues para revisão.

A inclusão comum em quadro não nomeia um novo administrador de quadro. O criador recebe nomeação automática; a promoção posterior, antes pendente, foi aprovada na seção 12 e usa operação controlada separada.

A remoção autorizada de participantes não ganhou exceções para criador ou administrador do quadro. O SQL segue essa autorização geral, sem conceder acesso permanente pela autoria. A seção 12 confirma definitivamente que não haverá proteção do último administrador local contra remoção. Administradores do sistema conservam acesso global independentemente dessas remoções.

### Decisões ainda necessárias

- Rebaixamento de administrador de quadro permanece fora do escopo; promoção e remoção do último administrador foram decididas na seção 12.
- Fluxos de edição/desativação/exclusão de departamentos, funcionários e quadros; transferência de departamento ou autoria; retenção de registros.
- Visibilidade do diretório de colegas e de todos os participantes para participantes comuns.
- Domínio corporativo, restrição de signup e detalhes operacionais de convite, recuperação e desativação de contas.
- Permanecem pendentes as regras de pendências indicadas nas seções anteriores; esta tarefa não as implementa.
## 12. Decisões definitivas — Tarefa 04 (24/09/2026)

Esta seção prevalece sobre os pontos anteriormente pendentes da seção 11.

- Não proteger o último administrador local contra remoção, inclusive quando ele remove sua própria participação. O administrador global mantém acesso e pode recuperar a administração local.
- Administradores do quadro e administradores globais podem promover outro participante existente a administrador daquele quadro. Participantes comuns não podem promover a si mesmos nem terceiros.
- A promoção é uma operação separada da inclusão. Não cria participação, não altera o papel global e não permite rebaixamento.
- Para recuperar um quadro sem administrador local, o administrador global promove outro participante existente; se não houver um candidato participante, primeiro o inclui como participante comum e depois o promove.
- A identidade de quem executa as operações vem de auth.uid(), nunca de parâmetros do frontend. O UUID de participante recebido pela promoção identifica somente o destinatário.
- Usuários autorizados a criar quadros, incluindo gestores e administradores locais, só podem criá-los no departamento principal registrado em seu perfil.
- Administradores globais podem escolher qualquer departamento existente. A autorização explícita de criação continua obrigatória também para eles.
- O nome do papel global no banco é administrador. Não criar papel admin, administrador_global ou outro sinônimo. A função administrativa de quadro continua representada por is_board_admin na participação.
- Autoria imutável e criação atômica do quadro com participação administrativa do criador permanecem preservadas.

A migration inicial permanece não aplicada e é ajustada no mesmo arquivo. Não executar migrations, testes SQL ou comandos remotos nesta tarefa. Não implementar rebaixamento, exclusão de quadros ou outras regras pendentes.