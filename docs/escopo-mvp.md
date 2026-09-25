# Vacivitta — Escopo do MVP

Data: 24/09/2026
Prazo-alvo: 7 dias
Público inicial: até 4 funcionários
Status: planejamento do protótipo funcional

## 1. Objetivo

Entregar uma aplicação web funcional para demonstração e testes iniciais com até quatro funcionários da Vacivitta.

O sistema deve permitir que usuários executem os principais fluxos de Kanban, gerenciamento de pendências e chat, com dados persistidos no Supabase.

O protótipo não substituirá o Trello nem o Slack nesta etapa.

## 2. Funcionalidades obrigatórias

### Autenticação e usuários
- Login e logout.
- Acesso restrito a usuários de teste autorizados.
- Perfis: membro, gestor e administrador.
- Proteção de rotas e de dados por permissões.

### Quadros Kanban
- Listar quadros aos quais o usuário tem acesso.
- Criar e editar quadros, conforme autorização.
- Criar e organizar colunas.
- Criar, visualizar e editar cards.
- Mover cards entre colunas.
- Associar determinadas colunas a estados de negócio.

### Pendências
- Atribuir responsável e prazo.
- Aceitar pendências.
- Recusar pendências com justificativa.
- Retornar pendências recusadas ao criador para reatribuição.
- Solicitar e aprovar adiamentos.
- Atualizar o estado conforme as regras de negócio.
- Concluir e reabrir pendências.
- Adicionar comentários.
- Consultar o histórico das principais ações.
- Identificar visualmente pendências atrasadas.

### Chat
- Criar e utilizar conversas individuais.
- Criar grupos por gestores e administradores.
- Adicionar participantes conforme as permissões.
- Enviar e receber mensagens de texto.
- Consultar o histórico das mensagens.
- Receber novas mensagens em tempo real.

### Segurança
- Implementar políticas RLS no Supabase.
- Restringir o acesso a quadros e conversas.
- Proteger itens privados.
- Impedir operações não autorizadas.
- Testar as permissões com usuários distintos.

## 3. Fora do escopo

- Importação de dados do Trello.
- Integração com Slack.
- Notas pessoais.
- Notificações automáticas.
- E-mails automáticos.
- Áudio e vídeo.
- Anexos.
- Implantação definitiva para todos os funcionários.

## 4. Critérios de aceite

O MVP estará pronto para apresentação quando:

1. A aplicação estiver acessível por um endereço web.
2. Os usuários de teste conseguirem entrar e sair.
3. As operações principais de Kanban persistirem no banco.
4. As principais regras de pendências estiverem funcionando.
5. As mensagens individuais e em grupo forem persistidas e atualizadas em tempo real.
6. Usuários sem permissão não conseguirem acessar dados privados.
7. A aplicação puder ser utilizada em computadores e celulares.
8. Não existirem erros críticos conhecidos que comprometam a demonstração.

## 5. Infraestrutura

- Frontend: Angular + TypeScript + SCSS.
- Backend gerenciado: Supabase Free.
- Banco: PostgreSQL.
- Autenticação: Supabase Auth.
- Autorização: RLS.
- Mensagens em tempo real: Supabase Realtime.
- Hospedagem prevista: Cloudflare Pages Free.
- Repositório Git local durante o desenvolvimento.

## 6. Plano de implementação

Dia 1: estrutura Angular, documentação e configuração do Supabase.
Dia 2: autenticação, usuários, permissões e quadros.
Dia 3: Kanban, cards e movimentação.
Dia 4: regras de pendências, comentários e histórico.
Dia 5: chat individual e em grupo.
Dia 6: integração, testes e correções.
Dia 7: publicação, homologação e preparação da demonstração.

O cronograma é uma meta. Falhas críticas de segurança ou integridade impedem a liberação para testes com funcionários.

## 7. Regras de execução

- Implementar uma funcionalidade por vez.
- Não inventar regras de negócio pendentes.
- Não introduzir funcionalidades fora do escopo sem autorização.
- Executar o build e os testes após cada tarefa relevante.
- Manter a documentação sincronizada com as decisões aprovadas.
- Utilizar dados fictícios até a autorização para testes reais.
