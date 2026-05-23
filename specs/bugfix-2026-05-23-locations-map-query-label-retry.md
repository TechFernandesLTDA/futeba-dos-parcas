# BUGFIX: Locations Map Query Label Retry

**Status**: APPROVED
**Issue**: #1689
**Data**: 2026-05-23

## Requirements

- Garantir query limitada no mapa de locais.
- Exibir label human-readable para tipo de campo.
- Error state deve permitir retry real.

## UX/UI

- Chip de tipo deve mostrar `Society`, `Futsal`, etc.
- Retry deve tentar recarregar os locais novamente.
- Sem mudanca visual estrutural.

## Technical Design

- Manter `limit(200)` existente.
- Usar `FIELD_TYPE_CONFIG` para resolver label.
- Adicionar `retryCount` como dependencia do listener para reassinar a query.

## Tasks

1. Confirmar `limit(200)`.
2. Mapear tipo para label.
3. Corrigir retry para disparar novo listener.
4. Validar build web.

## Implementation

- `limit(200)` ja estava presente e foi mantido.
- Chip de tipo agora usa `FIELD_TYPE_CONFIG` com fallback para `OUTROS`.
- Retry incrementa `retryCount`, refazendo o listener `onSnapshot`.

## Verify

- [x] `npm run build` em `web/`
- [x] Chip usa label human-readable
- [x] Retry refaz listener
