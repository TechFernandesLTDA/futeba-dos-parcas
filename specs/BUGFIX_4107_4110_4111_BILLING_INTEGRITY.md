# BUGFIX: Integridade do ciclo de cobrança e status comercial

**Status:** APPROVED

**Data:** 2026-09-08

**Issues:** #4107, #4110 e #4111

**Autorização:** pedido explícito do usuário para implementar todos os issues abertos, com spec aprovada antes do código.
**Escopo:** Functions de cobrança, backfill em dry-run, filtros comerciais web e testes. Não inclui deploy, execução de backfill, migração de produção ou metadados de release.

## Requisitos e causa

O cron não aplicava `billing_expires_at`, descartava locations sem evidência por ID e tratava dados insuficientes apenas como contadores. O painel priorizava `venue_account_status`, que é uma cópia administrativa, sobre `subscription_status`, atualizado pelo cron. O backfill transformava status inválido em TRIAL e removia vencimento sem incluir os casos na revisão.

Uma location fora da janela contratual não pode gerar ciclo nem ser reativada por pagamento aprovado. Uma location em TRIAL precisa de data de entrada e de pendência legível para revisão; isso não deve criar cobrança, cancelamento ou migração automática.

## Projeto técnico

1. O cron grava um resumo pequeno em `billing_automation_runs/{period_timestamp}` e cada location ignorada ou inconsistente em `locations/{locationId}` nessa execução. Os detalhes são gravados em lotes de no máximo 500 operações, evitando ultrapassar o limite de 1 MiB de um documento Firestore.
2. Inconsistências criam um alerta crítico com ID da execução e contagem. O operador abre os documentos de detalhe da execução para os IDs e motivos.
3. `billing_expires_at` encerra a janela de ciclo no instante da expiração; contratos expirados recebem o texto `contrato expirado` nas superfícies comerciais. Pagamentos aprovados exigem renovação prévia da janela.
4. A ausência legada de status usa `ACTIVE` como compatibilidade. Um status não nulo e inválido da conta comercial resolve para `SUSPENDED`, portanto permanece visível como irregular em vez de ser promovido a saudável.
5. Ao entrar em TRIAL, `trial_started_at` é gravado. Após 30 dias, o painel e o snapshot comercial mostram pendência de trial vencido; se a data estiver ausente, mostram pendência de início não registrado.

O repositório não contém política de duração para trial. O limiar de 30 dias é uma decisão operacional reversível desta correção, limitada a um aviso de revisão e sem transição financeira. A decisão de preço/duração definitiva deve ser consolidada pelo mantenedor em `specs/DECISIONS.md`.

## Arquivos

- `functions/src/locations/location-management.ts`
- `functions/src/locations/venue-account-shared.ts`
- `functions/src/scripts/backfill-venue-commercial-data.ts`
- `functions/test/location-management.test.ts`
- `functions/test/venue-accounts.test.ts`
- `functions/test/backfill-venue-commercial-data.test.ts`
- `web/src/types/location.ts`
- `web/src/pages/locations/manageLocationFilters.ts`
- `web/src/pages/locations/manageLocationFilters.test.ts`

## Verificação

- Jest focado: `location-management`, `backfill-venue-commercial-data` e `venue-accounts`.
- Vitest focado: `manageLocationFilters`.
- ESLint focado nos fontes Functions e `git diff --check`.

Os testes cobrem status ausente/inválido, início e expiração futura/passada, trial sem data e envelhecido, contrato expirado, pagamento bloqueado, precedência individual no painel, pendências independentes de conta/mensalidade e 501 detalhes de skip paginados.

## Estado de implementação

- [x] Requisitos e design técnico
- [x] Implementação
- [x] Testes focados
- [x] Verificação de lint e whitespace
- [x] Build completo de Functions
- [ ] Lint completo de Functions bloqueado por 17 JSDoc ausentes em `src/auth/account-merge.ts`, fora deste escopo
