# Financeiro mensal de grupos

Issue de rastreio: [#3530](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/3530)

## Objetivo

O financeiro mensal separa três conceitos que não podem ser confundidos:

- membros do grupo: todas as pessoas com membership ativa;
- mensalistas: subconjunto escolhido pelo owner/admin para participar do rateio;
- caixa realizado: entradas e saídas que efetivamente aconteceram.

Assim, um grupo pode ter mais jogadores do que mensalistas sem alterar o valor
individual indevidamente. Todos os valores autoritativos são inteiros em
centavos; o resto da divisão é distribuído deterministicamente por UID e a soma
das cobranças sempre coincide com o custo da quadra.

## Modos de cálculo

### Valor mensal fixo

O contrato da quadra é um total do mês. O total não muda se a agenda tiver três,
quatro ou cinco ocorrências; a quantidade de jogos altera apenas os indicadores
por jogo. Um mês com custo positivo e nenhuma ocorrência válida não pode ser
fechado.

### Valor por jogo

O total é a soma das ocorrências incluídas. Cada ocorrência pode ter custo
próprio; quando ele não existe, a configuração pode fornecer um valor padrão.
Um custo padrão não é obrigatório quando todas as ocorrências têm custo
explícito.

## Agenda, recorrência e feriados

O snapshot mensal combina, em ordem de precedência:

1. jogos já materializados no Firestore;
2. horários recorrentes ativos de `schedules`;
3. ocorrências ainda futuras de séries recorrentes de jogos.

As fontes são deduplicadas por série/agenda e data. Isso permite calcular o mês
completo antes de a engine de recorrência materializar a próxima partida. O
planejador respeita frequência semanal, quinzenal ou mensal, limite/encerramento
da série e exceções cadastradas.

Enquanto o período estiver `DRAFT`, o gestor pode marcar uma ocorrência como
feriado/fora do cálculo ou informar seu custo específico. A alteração recalcula
período e pagadores na mesma transação. Depois da primeira baixa, o snapshot é
imutável para impedir que pagamentos já realizados mudem de significado.

## Ciclo do período

| Estado | Comportamento |
| --- | --- |
| `DRAFT` | configuração, mensalistas, agenda e custos podem ser recalculados |
| `FINALIZED` | existe ao menos uma baixa e ainda há saldo em aberto |
| `CLOSED` | todas as cobranças do snapshot foram quitadas |

Configuração e roster têm revisões independentes, persistidas no período. A
baixa compara essas revisões antes de escrever; se outro cliente alterar a
configuração ou os mensalistas no intervalo, a operação falha e exige novo
cálculo. Essa trava evita finalizar um snapshot obsoleto em cenários com vários
gestores conectados ao mesmo tempo.

## Baixa, retry e estorno

- `settleMonthlyCharge` atualiza pagador, período, caixa, resumo e settlement de
  auditoria em uma única transação.
- Cada baixa usa `requestId`; uma reentrega idêntica retorna o resultado salvo e
  uma intenção diferente com o mesmo ID é rejeitada.
- O settlement permanente preserva a idempotência mesmo depois do TTL do
  marcador operacional do caixa.
- `voidCashboxEntry` estorna entrada, resumo, pagador, período e settlement na
  mesma transação. O período volta para `FINALIZED` e o saldo reabre exatamente
  no valor estornado.

O caixa é o ledger realizado. O período mensal é o plano/snapshot de cobrança;
nenhum cliente grava diretamente em qualquer um dos dois domínios.

Os cinco callables mensais passam por `secureCallable`: App Check com token de
uso limitado e proteção contra replay, rate limits separados para gestão,
rebuild e baixa, além de audit log enriquecido com grupo, competência, pagador,
ocorrência e `requestId` quando aplicáveis.

## Contrato Firestore

```text
groups/{groupId}/monthly_finance_config/current
groups/{groupId}/monthly_member_roster/{userId}
groups/{groupId}/monthly_finance_periods/{AAAA-MM}
groups/{groupId}/monthly_finance_periods/{AAAA-MM}/payers/{userId}
groups/{groupId}/monthly_finance_periods/{AAAA-MM}/settlements/{requestId}
groups/{groupId}/cashbox/{entryId}
groups/{groupId}/cashbox_summary/current
```

Configuração e agregados são legíveis por membros ativos. Valores de um pagador
e settlements são legíveis somente por ele, pelo owner/admin do grupo ou por
admin global. Todos os writes mensais e do caixa são exclusivos do Admin SDK.

## Operação na Web

1. O owner/admin abre o Caixa do grupo e configura valor mensal ou por jogo.
2. Seleciona quais membros ativos são mensalistas.
3. Recalcula o mês e revisa todas as ocorrências, inclusive as ainda planejadas.
4. Marca feriados/exclusões e custos específicos antes de qualquer pagamento.
5. Usa **Dar baixa** na cobrança individual; membros comuns veem somente o
   próprio valor.
6. Se necessário, estorna a entrada correspondente no histórico do caixa.

Períodos anteriores são históricos: a interface usa o snapshot de pagadores do
próprio período, nunca o roster atual.

## Gates obrigatórios

- Deploy: publicar os índices compostos de `games`, `schedules` e
  `settlements` primeiro e aguardar todos ficarem `READY` antes de publicar as
  Functions mensais.
- Functions: cálculo puro para 3/4/5 ocorrências, centavos, recorrência,
  feriado, concorrência, retry, baixa parcial/integral e estorno.
- Rules: leitura própria versus terceiros, queries gerenciais e bloqueio total
  de writes do cliente.
- Web: mapper do snapshot, histórico, estados `DRAFT`/`FINALIZED`/`CLOSED`,
  edição de ocorrência e baixa idempotente.
- Smoke pós-deploy: duas sessões simultâneas no mesmo grupo, alteração de
  configuração concorrente e atualização realtime de baixa/estorno.
