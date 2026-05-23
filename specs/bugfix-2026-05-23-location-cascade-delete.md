# BUGFIX: Location Cascade Delete

**Status**: APPROVED
**Issue**: #1684
**Data**: 2026-05-23

## Requirements

- Delecao de local deve remover subcolecoes `fields`, `reviews`, `availability` e `audit_logs`.
- UI web nao deve usar `deleteDoc` direto para `locations/{id}`.
- Backend deve respeitar limite de batch do Firestore.
- Auditoria deve registrar detalhes da exclusao.

## UX/UI

- Dialog de exclusao continua com loading durante operacao.
- Erros continuam exibindo toast.
- Sem mudanca visual intencional fora do fluxo de delete.

## Technical Design

- Reusar callable `deleteLocation` existente.
- Substituir delete direto em `ManageLocationsScreen` pela callable.
- Paginar delecao de subcolecoes no backend com batches de no maximo 500 writes.
- Adicionar audit log root com actor, location e contagem deletada.

## Tasks

1. Atualizar UI de gerenciamento para chamar `deleteLocation`.
2. Atualizar callable para deletar subcolecoes em paginas.
3. Registrar audit log de delecao.
4. Validar build web e functions.

## Implementation

- `ManageLocationsScreen` agora usa a callable `deleteLocation` em vez de `deleteDoc` direto.
- `deleteLocation` agora deleta subcolecoes em paginas de 500 docs por batch.
- A callable registra audit log root com actor, location e contagem deletada.
- Teste unitario cobre subcolecao com 1200 docs em 3 batches.

## Verify

- [x] `npm run build` em `web/`
- [x] `npm run build` em `functions/`
- [x] `npx jest test/location-management.test.ts --no-coverage`
- [x] ManageLocations sem `deleteDoc` direto para locations
