
# VittaHub

Aplicativo interno da Vacivitta para centralizar a organização de demandas e as conversas da equipe, combinando funcionalidades inspiradas no Trello e no Slack.

## Tecnologias

- Angular 22 e TypeScript
- Supabase (PostgreSQL, autenticação e Realtime)
- Docker para o ambiente local do Supabase

## Executar o projeto localmente

Instale as dependências:

```bash
npm install
```

Inicie a aplicação Angular:

```bash
npm start
```

Acesse http://localhost:4200/.

Para iniciar o ambiente local do Supabase, execute em outro terminal:

```bash
npx supabase start
```

## Validação

Compilar a aplicação:

```bash
npm run build
```

Executar os testes Angular:

```bash
npm test -- --watch=false
```

Executar os testes SQL no Supabase local:

```bash
npx supabase test db --local
```

## Documentação

- `docs/escopo-mvp.md` — escopo da primeira versão.
- `docs/regras-negocio.md` — regras de negócio.
- `docs/decisoes.md` — decisões técnicas e funcionais.
- `docs/modelo-dados-inicial.md` — modelagem inicial do banco.
- `docs/provisionamento-inicial.md` — procedimento de cadastro inicial.
- `AGENTS.md` — orientações para os agentes de desenvolvimento.

## Estado do projeto

Em desenvolvimento. A interface inicial utiliza dados demonstrativos, e a integração completa com o banco de dados ainda está em andamento.
