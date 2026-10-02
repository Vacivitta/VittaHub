# Task 22B — Relatório de execução local

Data: 02/10/2026.

Implementado o diretório administrativo somente leitura conforme `task22b-instrucoes-local.md`. Nenhuma operação foi executada contra o projeto Supabase remoto. Não houve commit, push, staging, reset, alteração de credenciais ou de papéis de contas existentes.

## Banco e escopo

- Migration incremental: `supabase/migrations/20261002114707_admin_team_directory.sql`.
- RPC sem argumentos: `public.list_admin_team_members()`.
- Identidade obtida por `auth.uid()`; papel, departamento e situação consultados em `profiles` em cada chamada. Sessão ausente, perfil inexistente, membro e chamador inativo são rejeitados com `42501`.
- Administrador ativo consulta todos os perfis provisionados. Gestor ativo consulta o próprio departamento e participantes atuais dos quadros que efetivamente administra, usando `vittahub_private.can_manage_board_structure`. Departamento do quadro, autoria ou mera participação não concedem administração.
- Alvos inativos aparecem dentro do escopo. `EXISTS` evita duplicação; a ordenação usa nome e UUID. Retorno limitado a identificação, nome, papel, situação e departamento; sem consulta a `auth.users` na RPC.
- Função `STABLE`, `SECURITY DEFINER`, owner `postgres`, `search_path` vazio; EXECUTE revogado de PUBLIC/anon e concedido a authenticated. Nenhuma política RLS existente ou permissão de helper privado foi ampliada.
- Aplicada com `npx.cmd supabase migration up --local`; a saída confirmou somente a nova migration no banco local.

## Interface e arquivos

Arquivos criados:

- `src/app/features/admin/admin.models.ts`: contrato do diretório e erro específico de acesso.
- `src/app/features/admin/admin.service.ts`: consulta exclusivamente à RPC sem parâmetros de identidade/permissão.
- `src/app/features/admin/admin.service.spec.ts`: testes do serviço.
- Migration e `supabase/tests/admin_team_directory.test.sql`.
- Este relatório, incluindo roteiro de smoke manual.

Arquivos modificados:

- `src/app/features/admin/admin.ts`, `admin.html`, `admin.scss`, `admin.spec.ts`: seção Equipe e acessos, busca local por nome/departamento, contador dos registros autorizados, situação Ativo/Inativo, estados de carregamento/vazio/erro e retry. Perfil, departamento, quadros e links anteriores preservados.
- `src/app/features/boards/boards.service.ts` e `boards.service.spec.ts`: adicionado `canManageStructureStrict()`, usado somente pela Administração. `false` legítimo exclui o quadro; falha da RPC rejeita a consulta e produz mensagem de erro. O método anterior e o comportamento da listagem de Quadros permanecem preservados.
- `src/app/app.spec.ts`: mocks atualizados para os novos contratos, preservando os testes de acesso direto à rota.

Troca de usuário, logout ou perda de acesso observada limpam dados e invalidam requisições anteriores, com retorno a `/inicio`. Rejeição administrativa recebida do banco também limpa os dados. Nenhum diretório é persistido em localStorage. A autorização de cada nova chamada continua no banco; não foi introduzido monitoramento Realtime de alterações de perfil.

## Validações

| Validação | Resultado |
| --- | --- |
| pgTAP dirigido, `npx.cmd supabase test db --local supabase/tests/admin_team_directory.test.sql` | 31/31, 1 arquivo |
| pgTAP completo, `npx.cmd supabase test db --local` | 573/573, 12 arquivos |
| Angular dirigido: administração, BoardsService, app/guard, sidebar e AuthService | 99/99, 6 arquivos |
| Angular completo, `npm.cmd test -- --watch=false` | 237/237, 15 arquivos; suíte completa executada uma vez |
| `npm.cmd run build` | Sucesso |
| `git diff --check` | Sucesso |

O pgTAP usa dados fictícios dentro de transação com rollback, `SET LOCAL ROLE authenticated` e `request.jwt.claim.sub`. Inclui revogação de administração, remoção de participação, mudança de departamento/papel, alvos inativos, claims forjados, parâmetros inexistentes, grants e preservação da RLS de `profiles`.

A tentativa inicial de Angular foi bloqueada pelo sandbox antes de executar testes. As execuções seguintes ocorreram com autorização fora do sandbox. Nos testes novos, foram corrigidos a ausência da rota `/inicio` no TestBed e o aguardo da navegação assíncrona. Nenhuma assertion foi suprimida; a execução dirigida final não teve falhas nem rejeições não tratadas.

Avisos do build: bundle inicial de 517,87 kB (limite de aviso 500 kB); `shell.scss` de 5,08 kB e `chat.scss` de 6,58 kB (limite de aviso 4 kB). Os budgets não foram alterados. O CLI também informou disponibilidade de atualização; nenhuma dependência foi atualizada.

## Preservação

Hashes SHA-256 conferidos antes e depois, idênticos:

| Arquivo protegido | SHA-256 |
| --- | --- |
| `README.md` | `B311E44B017D3A0B87AD8DB1C4CB68AF7C3B3F7F30871D0FAD679E26BF5BB808` |
| `docs/regras-negocio.md` | `11E3B494E5E38C5247D082289020A1E1BE7B2778CA4B5EEA8B62DBDA6D5C34EB` |
| `supabase/snippets/Untitled query 552.sql` | `2F881F8C78CF5413B1A63DD54C0E94E508E605C59312118DFB7E20830D31881C` |
| `supabase/snippets/Untitled query 564.sql` | `864B80119BC2176F2D401896B7D672D908639D684176DF307FE22C66D8FA9393` |

Esses arquivos já estavam modificados antes da tarefa e suas alterações foram preservadas. O arquivo temporário de instruções permanece sem staging.

## Roteiro de smoke manual local — pendente de execução

Não foram executados testes visuais em navegador. O roteiro abaixo deve usar somente contas já provisionadas no Auth local; não alterar seus papéis para viabilizar o teste. Não há decisão de negócio pendente para a implementação entregue.

1. Iniciar Angular com `npm.cmd start` (configuração development). Confirmar requisições exclusivamente para `http://127.0.0.1:54321` e aplicação local; não usar um frontend configurado para o projeto remoto.
2. Entrar como **Pessoa Teste**, membro: Administração deve estar ausente da sidebar e da navegação por Tab. Abrir `/administracao` diretamente e confirmar retorno a `/inicio` sem exibir pessoas.
3. Sair e entrar como **Pessoa Teste 2**, gestor: abrir Administração; confirmar perfil/departamento, quadros e links existentes e a seção Equipe e acessos.
4. Conferir que cada pessoa aparece uma vez, com nome, papel, departamento e situação; contador corresponde somente ao escopo retornado. Verificar colegas do próprio departamento e participantes externos de quadros administrados, conforme vínculos locais existentes.
5. Buscar nome e departamento; buscar termo inexistente e limpar a busca. Confirmar distinção entre nenhum resultado da busca e nenhum registro autorizado.
6. Simular conexão lenta/falha no navegador: conferir carregamento, erro legível e Tentar novamente. Falha da RPC de permissão dos quadros deve mostrar erro, nunca o vazio de ausência de permissão. Restaurar a conexão.
7. Com consulta lenta em curso, sair ou trocar de usuário e confirmar que dados anteriores não reaparecem. Conferir Tab, foco visível, leitura de rótulos e layout em desktop/mobile, sem ações de escrita.
8. Apenas se já existir administrador global de teste local, conferir seu escopo global e alvos inativos. Não criar conta, promover usuário nem consultar Auth Admin remoto. Revogações e mudanças departamentais já foram verificadas automaticamente com fixtures reversíveis no pgTAP.
