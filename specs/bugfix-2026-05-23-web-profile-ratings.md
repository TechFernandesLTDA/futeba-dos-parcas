# BUGFIX: Web Profile Ratings

**Status**: APPROVED
**Issues**: #1696, #1698
**Data**: 2026-05-23

## Requirements

- `User` web deve expor ratings automaticos com defaults seguros.
- EditProfile web deve permitir editar ratings manuais por posicao.
- Sliders devem usar escala 0-100 e persistir 0.0-5.0 no Firestore.
- Dirty detection deve considerar ratings manuais.

## UX/UI

- Manter secao `Habilidades por Posicao`.
- Exibir valor manual em 0.0-5.0.
- Mostrar auto-rating como referencia quando existir.

## Technical Design

- Completar defaults em `AuthContext.normalizeUserData`.
- Incluir campos auto-rating no estado local de `EditProfileScreen` apenas para exibicao.
- Converter slider `0..100` para rating `0..5` com `value / 20`.

## Tasks

1. Normalizar defaults de ratings no auth user.
2. Carregar auto-ratings no EditProfile.
3. Ajustar sliders para escala 0-100.
4. Incluir ratings no dirty guard.
5. Validar build web.

## Implementation

- `AuthContext.normalizeUserData` agora aplica defaults para ratings manuais e automaticos.
- `EditProfileScreen` carrega auto-ratings para exibir como referencia.
- Sliders usam escala 0-100 e persistem `value / 20` no Firestore.
- Dirty guard considera alteracoes nos ratings manuais.

## Verify

- [x] `npm run build` em `web/`
- [x] Sliders editam ratings manuais
- [x] Auto-rating aparece como referencia quando disponivel
