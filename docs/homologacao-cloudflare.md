# VittaHub — plano de homologação para revisão

Data da inspeção: 09/10/2026. Inspeção inicial em 09/10/2026; nenhuma migration remota, provisionamento de conta, merge ou publicação foi executado. Commit/push na branch separada e abertura de PR foram autorizados pelo responsável em 09/10/2026; aplicação das migrations continua não autorizada.

## Estado confirmado

- GitHub: Vacivitta/VittaHub, main no commit `60d072c219aaf4778858de94775d8f632299e308`.
- Supabase Cloud: `vittahub-dev`, ref `cpjorwbvbzqopiwwwqdy`, região `sa-east-1` (São Paulo), estado `ACTIVE_HEALTHY`, organização no plano Free.
- Sem tabelas/relações da aplicação nos schemas `public`/`vittahub_private`, sem migrations registradas e sem usuários Auth.
- Auth responde à consulta de saúde; e-mail/senha habilitados, signup público desabilitado (`disable_signup=true`). Nenhuma configuração Auth foi alterada.
- Security Advisor sem alertas; isso não valida as políticas futuras, pois o schema está vazio.
- Cloudflare: painel aberto, sem sessão autenticada; tela de login exibe erro de verificação após uma recarga. Nenhum projeto Pages criado ou plano contratado.

## Alterações preparadas

Branch de preparação: `chore/homologacao-cloudflare`, autorizada exclusivamente para commit/push e PR de revisão, sem merge em `main`.

- `package.json`: comando `build:homologation` para gerar configuração pública e compilar com `production,homologation`.
- `angular.json`: configuração de homologação com substituição de `environment.ts` pelo arquivo de produção ignorado pelo Git.
- `scripts/generate-homologation-environment.mjs`: gera esse arquivo a partir de `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`; rejeita projeto incorreto, URL local e chaves que não sejam `sb_publishable_`.
- Este plano documenta configuração, ordem, riscos e critérios de validação.

O comando de desenvolvimento e `environment.local.ts` permanecem separados. Neste checkout de inspeção, uma cópia vazia do template foi criada no arquivo local ignorado apenas para permitir os testes unitários; ele não aponta para Cloud. O arquivo de homologação gerado também é ignorado. Credenciais públicas não são versionadas. Os quatro históricos protegidos e todas as migrations permanecem idênticos ao commit inspecionado.

## Plano de banco — exige aprovação específica

Aplicar somente os 28 arquivos existentes listados abaixo, na ordem lexicográfica, pelo Supabase CLI fixado em `2.117.0`, com `migration up --linked --project-ref cpjorwbvbzqopiwwwqdy`, usando os nomes originais, conteúdos e hashes revisados deste commit. O comando é apenas a proposta para execução futura após aprovação específica; não foi executado. Não executar `db push`, `db reset`, seed, cleanup, snippets históricos nem importações locais.

Antes da primeira aplicação, reconsultar tabelas, funções, migrations e contagem de usuários. Se o schema deixou de estar vazio, houver divergência de hash ou aparecerem migrations inesperadas, interromper para nova revisão. Nenhuma autorização permite apagar ou sobrescrever dados existentes.

Resultado previsto: 13 tabelas públicas, quatro tabelas privadas, enums, índices, constraints, policies RLS e RPCs já implementadas. A publicação Realtime existente receberá somente `public.messages`. Não criar identidades Auth, perfis ou registros de master durante as migrations.

Riscos e controles:

- DDL remoto altera estrutura, permissões e funções. Funções e policies intermediárias serão substituídas pelas versões posteriores aprovadas; validar o estado final antes de provisionar contas e abrir o frontend.
- `20261006124848_task_assignment_postponement.sql` remove NOT NULL de `tasks.assignee_id`, conforme fluxo já implementado; não remove coluna ou dados.
- `20261008133013_remove_column_state_binding.sql` remove uma função e uma constraint introduzidas anteriormente no mesmo lote; preserva `business_state`, enums, tabelas e registros.
- Funções operacionais existentes incluem operações de escrita/exclusão controladas para uso pela aplicação. Aplicar suas definições não executa essas operações. Não chamar RPCs de exclusão durante esta implantação.
- O lote não é uma transação única entre arquivos. Em erro, parar, registrar a última migration confirmada e inspecionar. Não desfazer apagando objetos ou restaurando banco.
- Preservação confirmada no CLI 2.117.0: o prefixo de `<timestamp>_<nome>.sql` é usado como `version` e o sufixo como `name`; o próprio executor grava ambos em `supabase_migrations.schema_migrations` depois de executar o arquivo. Exemplo: `20260924150000_identity_kanban_foundation.sql` registra `version=20260924150000` e `name=identity_kanban_foundation`. Não usar o MCP `apply_migration` neste lote: sua interface não permite escolher a versão original.
- Executar futuramente em checkout separado com o commit aprovado e as 28 migrations conferidas, sem reutilizar o vínculo do ambiente Docker local. Autenticar o CLI por mecanismo seguro; `supabase link --project-ref cpjorwbvbzqopiwwwqdy` prepara o vínculo somente nesse checkout. Conferir `migration list --linked --project-ref cpjorwbvbzqopiwwwqdy` antes e depois. Não usar `--include-all`, `migration repair`, SQL manual no histórico, renomeação, squash, seed ou `db push` para resolver divergências: qualquer diferença interrompe a operação para revisão.
- `migration up` não executa seed. O executor também verifica `[db.vault]`; esse bloco está comentado no config atual e deve permanecer sem valores ativos no checkout de implantação. Não executar config push nem copiar secrets/arquivos locais.
- Os 28 arquivos têm `BEGIN`/`COMMIT` explícitos. No executor 2.117.0, esses limites são respeitados e o registro de histórico é inserido depois que o arquivo termina: DDL e registro não têm garantia de transação única. Uma falha entre COMMIT e a gravação do histórico pode deixar schema aplicado sem registro. Interromper e inspecionar; não reparar histórico manualmente nem reaplicar automaticamente. Não foi feito teste remoto para demonstrar aplicação das migrations.
- Fonte oficial verificada na tag v2.117.0: [up.handler.ts](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/commands/migration/up/up.handler.ts), [leitura de versão/nome](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/command-internal/legacy-migration-history.ts), [executor e gravação de histórico](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/command-internal/legacy-migration-apply.ts). `--help` de migration up/list/link consultado no binário instalado, sem conectar o CLI ao projeto.
- Depois do lote, verificar RLS, grants explícitos para `authenticated`, ausência de acesso anônimo, EXECUTE das RPCs e ausência de acesso público ao schema privado, além de Security Advisor e inscrição de messages no Realtime. Não abrir grants genéricos para contornar erros.
- Testes SQL existentes não serão executados no Cloud: contêm fixtures e escrita transacional em Auth. A inspeção atual e os testes frontend não comprovam o comportamento do banco remoto.

## Cloudflare Pages — configuração preparada, ainda não salva no serviço

| Campo | Valor planejado |
| --- | --- |
| Produto / plano | Pages / gratuito, sem Functions nem contratação paga |
| Projeto sugerido | `vittahub-homologacao` (disponibilidade não confirmada) |
| Repositório | `Vacivitta/VittaHub` |
| Branch de produção | `main`, somente após PR revisado e merge autorizado |
| Diretório raiz | raiz do repositório |
| Build command | `npm ci --no-audit --no-fund && npm run build:homologation` |
| Build output directory | `dist/vacivitta-app/browser` |
| Build image | v3 |
| NODE_VERSION | `24.19.0`, mesma versão do build validado e compatível com Angular 22.2 |
| SKIP_DEPENDENCY_INSTALL | `1`, pois o comando executa npm ci com lockfile |
| SUPABASE_URL | `https://cpjorwbvbzqopiwwwqdy.supabase.co` |
| SUPABASE_PUBLISHABLE_KEY | chave pública publishable ativa do projeto, lida pelo conector, não incluída neste plano |
| Preview deployments | desabilitar inicialmente para restringir esta homologação à branch aprovada |

O Pages serve rotas SPA por padrão na ausência de `404.html` de topo. O build contém `index.html` na pasta `browser`; verificar acesso direto e recarga de rotas após o deploy. Nenhuma URL `pages.dev` foi atribuída até agora.

Autorizar integração GitHub apenas para este repositório se ela ainda não existir. A instalação concede acesso ao código e cria integração de deploy; requer confirmação no momento da concessão. Só clicar em publicação após o banco e as configurações terem sido validados e a publicação ter sido aprovada. Interromper qualquer fluxo que exija plano pago.

Login por senha já existe e não requer redirect para funcionar. Quando houver URL real, revisar Site URL/redirects do Auth e cadastrar somente os endereços necessários, sem wildcard amplo nem remoção automática de entradas existentes. Esta configuração remota não foi consultada pela ferramenta atual.

## Contas e validação funcional — aprovação separada

Não há contas Cloud disponíveis. Proposta para confirmação posterior: um departamento `Homologação fictícia` e três identidades de teste nos papéis gestor, membro e membro sem participação em quadro/conversa. Usar endereços fictícios de domínio reservado e criação administrativa no Auth, sem envio de convites a pessoas reais e sem INSERT manual em auth.users. Método de definição de credenciais precisa ser autorizado em canal seguro. Nenhuma conta ou senha foi criada.

Provisionar os perfis por INSERT conferindo os UUIDs retornados pelo Auth; não usar UPSERT. Qualquer autorização inicial de criação de quadros deve ser aprovada nominalmente e registrada pelo operador, com `granted_by` aprovado. Não criar administrador global, master ou delegações por inferência deste plano.

Após a publicação e provisionamento aprovados:

1. HTTPS, assets, login, proteção de rota sem sessão, acesso direto e recarga de rota interna.
2. Login incorreto, login correto, perfil exibido, restauração de sessão e logout.
3. Quadros/colunas com conta autorizada e negativa de acesso para usuário sem participação.
4. Criar pendência fictícia, atribuir, aceitar, iniciar, concluir e conferir persistência após recarga; verificar privacidade e rejeição de mutações indevidas.
5. Conversa individual e grupo com gestor; envio, histórico e recebimento Realtime em duas sessões; usuário externo sem acesso.
6. Confirmar que membro não cria grupo e usuário sem autorização não cria quadro.
7. A gestão de ativação/delegação depende de master explicitamente aprovado; não validar essa parte por designação automática.

O encerramento deve informar URL efetivamente publicada, estado dos serviços, testes realmente executados e pendências. A auditoria visual completa só começa após nova aprovação do usuário.

## Evidências já obtidas

- `npm ci --no-audit --no-fund`: concluído com lockfile existente.
- `npm run build`: passou no código original, com warnings de tamanho já existentes.
- `npm run build:homologation`: passou com URL e chave pública do Cloud; mesma classe de warnings (bundle inicial ~525 kB, SCSS de shell/chat).
- `TZ=America/Sao_Paulo npm test -- --watch=false`: 23 arquivos e 374 testes passaram. A primeira execução usou o fuso America/Lima deste runtime e falhou em uma expectativa de horário; não houve alteração nos testes/código para contornar a falha.
- Nenhum teste de login ou de funcionalidades contra Cloud com conta autenticada foi realizado; banco sem schema/usuários.

## Autorizações pendentes

1. Aplicar o lote das 28 migrations abaixo, neste projeto específico, sob os controles descritos.
2. Commit/push das quatro alterações preparadas em `chore/homologacao-cloudflare` e abertura de PR: autorizados em 09/10/2026. Merge em main não autorizado.
3. Resolver o acesso ao painel Cloudflare; aprovação da integração e publicação será pedida quando houver configuração concreta no painel.
4. Aprovar identidades, papéis, grants e mecanismo de credenciais fictícias antes do provisionamento.

## Arquivos de migrations revisados

| Ordem | Arquivo | SHA-256 |
| --- | --- | --- |
| 1 | `20260924150000_identity_kanban_foundation.sql` | `9058443c04b5f367e7cc41cc78c7415fc5e76fa774ac734311c92d6f50ae3cb1` |
| 2 | `20260925160000_tasks_read_foundation.sql` | `aa8959b42a2b88ee045e3437a6f009caf42b1a039c7cdf2ee396a535463b25dd` |
| 3 | `20260928120000_tasks_creation.sql` | `6e785463ee2e7b0dfdd0a2eed3a5ac766078ddb5fb254321aa53541d1287887d` |
| 4 | `20260928160000_task_workflow.sql` | `61f785a3c75ab4e76d4d6148ba5cc6890a3d1461ceb512e8a42924be16c21cd1` |
| 5 | `20260928170000_task_privacy_normalization.sql` | `4d60cab278003b8e8175ae5139f8458a6ea2e6f9637d8bf68af23b2e12be4f74` |
| 6 | `20260928180000_task_comments_third_party.sql` | `527eba82eb6d5bcb9181d48104fc73adc9409127b83b9819cea9409a77a68fc3` |
| 7 | `20260928190000_chat_foundation.sql` | `10019a12394eaecff716322baa92489f2fa5525b646f15cdc0474e9241030766` |
| 8 | `20260928200000_messages_realtime.sql` | `0268c5c60ebcaa732f207019d478f0682fe04f6a31948930bbac85863a927189` |
| 9 | `20260929120000_board_management_drag_drop.sql` | `8568919ac2f956186a43686747426f8eada4c9db4d2e532a3a4e7206dc533ba6` |
| 10 | `20260929150000_board_edit_safe_deletion.sql` | `25a175f0ea7b07681421ce3563b6eb8b663194406f0319d8489cabe01c181cf0` |
| 11 | `20260929170000_direct_conversation_creation.sql` | `d84277fd9fb099836922a469090deb065d7543883630336b6e9e36e692df0f65` |
| 12 | `20260930120000_group_conversation_creation.sql` | `d7d4a8e185b00abbd783167220994867d8a7b52f47f8c61917a5f9809b210e0b` |
| 13 | `20261002114707_admin_team_directory.sql` | `f3e6fd1c93beb0b269e43c97fa983327359530462985f0285433e0cd9b7a23cf` |
| 14 | `20261002130636_task_movement_history.sql` | `82878bffc3b85100a260be4ab1a4b701f8339040b1d819918e7466d62e6e12bd` |
| 15 | `20261002142110_admin_activity_dashboard.sql` | `b24f970e9348cd1c885f694c3c72a3a867ef511c084a27f7787f2a4c389876e5` |
| 16 | `20261005124627_admin_board_participants.sql` | `b820432d318f51362913e72d008b4bc53a9700f7d97bedde04ec4013fd7e39ea` |
| 17 | `20261005135920_local_board_column_management.sql` | `88f1ae49735294632d541cb73400f96870e61c300763197161e6c4f2bccb0235` |
| 18 | `20261006124848_task_assignment_postponement.sql` | `1128810f07ecf378f5821a692a048a0f746ff3f132c34a3db258e50139105618` |
| 19 | `20261006135731_user_requests_center.sql` | `44d72d9fcc57d87c775592fd974258ee63109b99ef2b90223662313e7820e4ee` |
| 20 | `20261006141430_requests_assignment_return.sql` | `5645f10cb3076a670f5d5da264af2adb57da9ca9fd6640806605b034b16f2724` |
| 21 | `20261007122029_task_reopening.sql` | `34292adb41f7a638b7d933dd54190710df91f51e483f16bf32035dd814ed5e34` |
| 22 | `20261007125812_task_controlled_editing.sql` | `e517538fdca4c99c971ffa3d89a93486527b571dee0a070b1ea1d1152a9c5c56` |
| 23 | `20261007161131_column_state_binding.sql` | `8001a15cffd2a0b9c0b5e3aa064d96354fbc3ae538289eab3e5e1c69bbde1133` |
| 24 | `20261008133013_remove_column_state_binding.sql` | `bc8ddae7515be78f4de3c9cb6d6f18e892608f79ab9e38a5c568f5612930f889` |
| 25 | `20261009122222_employee_security.sql` | `7960147f5ba02aab723f8980d97635209b67d6fe1ce353b952a593c38eb4618e` |
| 26 | `20261009123140_employee_security_hardening.sql` | `8f8a175688f5a2501da01c98cff46cbf23db29172ffeac4229732afc0d24bab8` |
| 27 | `20261009124905_employee_security_read_contracts.sql` | `7cc0f13df91a3b27d23d73bfa6868e9dbef7f5df7a0a10d5950b4b09000a7b96` |
| 28 | `20261009130405_master_auth_availability.sql` | `84b893aef6ebe4afb1c88ebec28023af6f802855a783e6aa9cf25bce528eb095` |
