# Cliente Supabase no Angular

Para desenvolvimento, configure `src/environments/environment.local.ts` (ignorado pelo Git).
Em um novo checkout, copie `src/environments/environment.ts` para esse caminho.
Defina `supabaseUrl` como `http://127.0.0.1:54321` (ou a URL da sua instância local)
e `supabasePublicKey` como a chave **publishable/anon** dessa instância. Execute `npm start`.
Não use service_role, secret keys, senhas ou tokens administrativos. Não versione valores reais.

Os futuros serviços devem usar `inject(SUPABASE_CLIENT)`, importando o token de
`src/app/core/supabase/supabase-client.ts`. O provider da aplicação cria uma única instância
no primeiro uso; configuração vazia, URL inválida ou chave não pública gera erro antes de criar o cliente.
O login usa e-mail e senha de uma conta local existente. A sessão é restaurada ao
recarregar; as rotas internas aguardam essa restauração. O cabeçalho usa `display_name`
do próprio perfil (`profiles.id` igual ao usuário autenticado), consultado sob RLS.
O botão Sair encerra a sessão deste navegador. Os demais dados das telas ainda são demonstrativos.

Teste manual: abra `/inicio` sem sessão (deve ir para `/login`), tente uma senha
incorreta, entre com a conta local autorizada, confira o nome no cabeçalho, recarregue
uma rota interna e depois saia. Voltar pelo histórico ou abrir uma rota interna deve
exigir login novamente. Não há cadastro público nem alteração de dados no banco.

`npm run build` usa produção, com os valores vazios de `environment.ts` por segurança.
Para configurar produção futuramente, gere `src/environments/environment.production.local.ts`
(também ignorado pelo Git), com a mesma estrutura, e adicione em
`build.configurations.production.fileReplacements` do `angular.json` a substituição de
`src/environments/environment.ts` por esse arquivo. Use apenas URL e chave pública;
esses valores serão visíveis no bundle. Nenhum projeto remoto está configurado agora.

Referências: [ambientes Angular](https://angular.dev/tools/cli/environments) e
[createClient do Supabase](https://supabase.com/docs/reference/javascript/initializing).
