# Tarefa 27B — segurança e provisionamento do master

Nenhum master é designado pelas migrations. Executar o procedimento abaixo somente
em ambiente explicitamente autorizado, por operador com conexão PostgreSQL confiável.
Nunca executar pelo Angular, nem usar service_role no cliente. Os quatro arquivos
históricos protegidos não foram alterados.

## Designação inicial ou transferência

Pré-condições: conta já criada pelo Supabase Auth, perfil provisionado com papel
`administrador` e `is_active=true`. Conferir o UUID com o responsável. Não inferir
por e-mail, ordem de criação ou primeiro login.

Em psql administrativo, substituir os valores solicitados interativamente. Este
procedimento não cria ou promove contas. Para transferência, conferir também o
master anterior exibido antes de confirmar COMMIT. A mudança de designação não
altera papéis ou estado dos perfis e não apaga histórico.

```sql
\prompt 'UUID do administrador ativo aprovado: ' approved_master
begin;
select pg_advisory_xact_lock(2727,1);
select user_id as previous_master from vittahub_private.master_account for update;
select id, display_name, role, is_active from public.profiles
where id=:'approved_master'::uuid for update;
-- Se a identidade não corresponder à aprovação, executar ROLLBACK e interromper.
insert into vittahub_private.master_account(singleton,user_id)
values(true,:'approved_master'::uuid)
on conflict(singleton) do update set user_id=excluded.user_id;
insert into vittahub_private.employee_security_events(actor_id,target_id,action,details)
values(null,:'approved_master'::uuid,'master_designated',
 jsonb_build_object('database_operator',session_user));
-- Conferir o resultado antes de confirmar. A trigger exige administrador ativo.
select * from vittahub_private.master_account;
commit;
```

Registrar externamente aprovação, operador, ambiente, master anterior e novo UUID.
Não registrar credenciais. Um operador privilegiado pode recuperar a designação,
mas a aplicação não possui RPC para designar master. Nunca desabilitar RLS/triggers.
Para alteração administrativa de papel/situação fora da aplicação, adquirir o mesmo
advisory lock antes de bloquear/alterar perfis. A trigger revoga delegações ao perder
elegibilidade e protege o master. Não apagar o registro master como procedimento normal.

Sem master válido, operações delegadas falham fechadas. Indisponibilidade de login
por banimento ou exclusão lógica no Auth também invalida o master. Perda de credenciais
exige recuperação pelo operador; não há sucessor automático nem detecção
de presença online. O master não precisa estar conectado para os delegados operarem.

## Sessões e revogação

Ativação e desativação gravam `employee_session_cutoffs.login_after`. Para contas que
possuem corte, o helper verifica o `session_id` assinado contra `auth.sessions`, com
mesmo usuário e `created_at` posterior ao corte. Renovação de JWT da sessão anterior
não atende ao requisito. Não há exclusão manual em tabelas internas do Auth nem
dependência de invalidação privilegiada de sessões para bloquear dados da aplicação.

O navegador revalida a cada 60 segundos, em retorno à aba, restauração, renovação e
navegação protegida. O banco bloqueia independentemente desse intervalo. Dados já
recebidos não podem ser retirados de um cliente adulterado. Postgres Changes continua
sujeito à RLS de mensagens; não se depende de fechar o socket para autorização.

As RPCs anteriores foram preservadas como `vittahub_private.impl_*`, sem EXECUTE
para clientes, e expostas por wrappers autenticados. Novas RPCs operacionais devem
usar o mesmo controle. O lock transacional `(2727,1)` serializa RPCs para evitar
corridas com revogação; é uma escolha adequada ao MVP de quatro usuários, não um
modelo de alta concorrência. Leituras RLS não bloqueiam consultas já em andamento.

## Validação completa manual

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
npx.cmd supabase test db --local
node supabase/tests/employee_security_concurrency.mjs
```

Não usar db reset/db push. Para validar com interface e Realtime, usar somente contas
fictícias autorizadas no local: manter duas sessões, desativar uma pelo master ou
delegado, verificar rejeição de SELECT/RPC com JWT antigo e ausência de novos INSERT
de mensagens na assinatura antiga; reativar e confirmar que só novo login libera.
O teste de publicação SQL isolado não comprova entrega nem bloqueio do WebSocket.

O teste de concorrência usa duas conexões locais, sem gravar dados: enquanto a
transação detém o lock de segurança, revogação, desativação e mutações antigas
aguardam o mesmo lock. A suíte pgTAP verifica as decisões e atomicidade; esse teste
complementar verifica a serialização, não simula todos os interleavings possíveis.
