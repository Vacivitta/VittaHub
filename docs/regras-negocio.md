# Vacivitta — Regras de negócio

Atualizado em: 24/09/2026
Status: regras confirmadas e pontos pendentes para o protótipo.

## 1. Perfis de usuário

O sistema terá três perfis:
- Membro.
- Gestor.
- Administrador.

A autenticação não concede automaticamente acesso a todos os recursos.

Administradores autorizam quais usuários podem criar e administrar quadros.

Apenas gestores e administradores podem criar grupos de chat e administrar seus participantes.

## 2. Pendências

Cada pendência deverá ter:
- Título.
- Criador.
- Responsável.
- Prazo.
- Estado de negócio.

Os campos adicionais deverão seguir a especificação técnica original.

## 3. Estados

Estados previstos:
- aguardando_aceite
- a_fazer
- fazendo
- aguardando_terceiro
- concluido

Não criar novos estados sem aprovação.

## 4. Aceite e recusa

Uma pendência atribuída começa aguardando aceite do responsável.

Ao aceitar, o responsável confirma que assumiu a pendência.

O responsável também pode recusar a atribuição, mas deve informar uma justificativa.

A recusa deve:
- Ser registrada no histórico.
- Preservar a justificativa.
- Devolver a pendência ao criador para reatribuição.

PENDENTE: definir como representar uma pendência recusada enquanto aguarda novo responsável, sem acrescentar um estado não aprovado.

## 5. Colunas do Kanban

As colunas podem ser:
- Organizacionais, sem vínculo com um estado.
- Vinculadas a um dos estados de negócio.

Mover um card para uma coluna vinculada deve solicitar a transição correspondente.

A transição somente será concluída quando as regras de negócio forem satisfeitas.

Se faltarem informações obrigatórias, a interface deverá solicitá-las.

Se a transição não for permitida, o card permanecerá na coluna anterior.

PENDENTE: definir a matriz completa de transições permitidas.

## 6. Prazos e adiamentos

As pendências devem ter prazo.

Prazos vencidos deverão receber sinalização visual no protótipo.

O sistema deverá permitir solicitações de adiamento e seu tratamento conforme a especificação técnica original.

As notificações automáticas não fazem parte do protótipo.

## 7. Conclusão e reabertura

A conclusão deve ser registrada no histórico.

Pendências concluídas podem ser reabertas por:
- Responsável.
- Criador.
- Administrador.

A conclusão anterior deve continuar registrada.

PENDENTE: definir o estado de retorno e se a reabertura exige justificativa.

## 8. Comentários e histórico

O sistema deverá registrar comentários e as principais ações sobre pendências.

Aceites, recusas, reatribuições, mudanças de estado, adiamentos, conclusões e reaberturas devem ser rastreáveis.

## 9. Privacidade

Itens privados serão acessíveis ao criador e aos administradores.

O acesso deverá ser protegido no banco por políticas RLS, não apenas por controles visuais.

Usuários não poderão consultar conversas das quais não participam.

## 10. Regras de implementação

- Consultar a especificação original para os detalhes não reproduzidos neste resumo.
- Não transformar pontos pendentes em decisões definitivas.
- Não permitir que uma movimentação visual contorne validações de negócio.
- Não implementar permissões apenas no frontend.
- Usar dados fictícios durante o desenvolvimento.
