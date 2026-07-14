# BUGFIX: restauração de grupo preserva status `DELETED`

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Data:** 2026-07-13
> **Issue:** #3608

## Problema

`restoreDeletedGroup` remove `deleted_at` e `deleted_by`, mas não informa um
status de restauração ao helper. Como a deleção em cascata grava
`status: "DELETED"`, o grupo continua indisponível para fluxos que validam o
status, incluindo o fechamento mensal de caixa.

## Invariante e solução

Um grupo restaurado deve voltar ao estado operacional `ACTIVE`. O callable deve
chamar `restoreSoftDeleted` com `{ restoreStatus: "ACTIVE" }`, mantendo as
regras atuais de autenticação, permissão e exigência de `deleted_at`.

## Critérios de aceitação

- Restauração válida encaminha `restoreStatus: "ACTIVE"` ao helper.
- O helper persiste `status: "ACTIVE"` e os metadados de restauração.
- Grupo que não está deletado continua rejeitado com `failed-precondition`.
- Usuário que não é autor da deleção, dono ou admin continua rejeitado com
  `permission-denied`.
- Restauração por admin continua funcionando.

## Verificação

- `cd functions && npm run build`
- `cd functions && npm run lint`
- `cd functions && npx jest --no-coverage test/soft-delete.test.ts test/maintenance/soft-delete-callables.test.ts`

## Risco e release

Mudança restrita ao backend e compatível com dados existentes: documentos
restaurados passam a receber o mesmo estado ativo usado pelos demais fluxos de
grupos. Requer deploy de Functions; não altera schema nem versão de clientes.
