# AGENTS.md — Vacivitta

## Papel do agente

Você é o agente de implementação da Vacivitta. Trabalha sob orientação do desenvolvedor responsável e deve executar tarefas pequenas, verificáveis e compatíveis com a documentação.

Não altere a arquitetura nem invente regras de negócio sem aprovação.

## Documentação obrigatória

Antes de implementar funcionalidades, leia:
- docs/decisoes.md
- docs/escopo-mvp.md
- docs/regras-negocio.md

Caso a especificação técnica original esteja disponível em docs/, consulte-a quando precisar de detalhes adicionais.

As decisões mais recentes registradas em docs/decisoes.md prevalecem quando houver conflito com versões anteriores.

Se encontrar contradições ou regras pendentes que afetem a tarefa, informe o desenvolvedor antes de implementar.

## Objetivo

Construir uma aplicação web funcional para demonstração e testes iniciais com até quatro funcionários da Vacivitta.

O projeto não substituirá o Trello nem o Slack nesta etapa. Não implementar importação de dados ou integrações com essas ferramentas.

## Stack

- Angular e TypeScript.
- SCSS.
- Supabase PostgreSQL.
- Supabase Auth.
- Row Level Security (RLS).
- Supabase Realtime para mensagens.
- Hospedagem estática gratuita.

Não introduzir backend independente, Java, Spring Boot ou bibliotecas desnecessárias.

## Princípios de implementação

1. Inspecione o código existente antes de fazer alterações.
2. Trabalhe exclusivamente no escopo solicitado.
3. Prefira recursos nativos e padrões atuais do Angular.
4. Organize o código por funcionalidades, com separação clara entre interface, serviços e modelos.
5. Mantenha o layout responsivo.
6. Use TypeScript com tipagem adequada.
7. Não armazene credenciais ou chaves privilegiadas no frontend.
8. Não use dados reais de funcionários ou pacientes durante o desenvolvimento.
9. Implemente autorização no banco por RLS, não apenas na interface.
10. Não faça commits automaticamente.

## Regras de negócio

Não modifique ou simplifique regras descritas em docs/regras-negocio.md sem autorização.

Não implemente decisões identificadas como pendentes antes de receber orientação.

Não associe automaticamente todas as colunas Kanban a estados de negócio: a associação é opcional.

Transições de estado precisam respeitar as validações de negócio.

## Fluxo de trabalho

Para cada tarefa:

1. Leia os documentos relevantes.
2. Identifique os arquivos que precisam ser alterados.
3. Implemente apenas o que foi solicitado.
4. Execute npm run build.
5. Execute os testes existentes pertinentes.
6. Corrija erros introduzidos.
7. Apresente um resumo dos arquivos alterados, testes executados e decisões pendentes.

Não execute comandos destrutivos, altere credenciais, publique a aplicação ou faça commits sem autorização explícita.

## Critérios de qualidade

- Código compreensível e organizado.
- Interfaces responsivas.
- Dados persistidos corretamente quando a funcionalidade exigir.
- Erros tratados de forma adequada.
- Permissões verificadas.
- Nenhuma alteração não solicitada no escopo do projeto.
