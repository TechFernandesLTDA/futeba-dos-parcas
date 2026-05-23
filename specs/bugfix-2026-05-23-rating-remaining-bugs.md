# BUGFIX: Remaining Rating Bugs

**Status**: APPROVED
**Issues**: #1692, #1693, #1697, #1701, #1702
**Data**: 2026-05-23

## Requirements

- Corrigir escala do `overallRating` no player card web.
- Diferenciar rating manual nao definido de rating manual definido como `0.0`.
- Calcular auto-ratings via Cloud Function quando `statistics/{userId}` muda.
- Penalizar cartao vermelho com peso maior que amarelo no calculo de disciplina.
- Calcular confianca de auto-rating por posicao, evitando que amostra global domine funcoes pouco relevantes.

## UX/UI

- Player card deve exibir overall em escala 0-99.
- Ratings manuais zero devem ser respeitados quando o usuario ja editou ratings.
- Web-only users devem receber auto-ratings sem abrir Android.

## Technical Design

- Converter rating medio 0-5 para 0-99 em `usePlayerCard`.
- Adicionar flags `*_rating_set` no modelo `User` para preservar zero manual explicito.
- Escrever flags em updates web/Android quando ratings sao editados.
- Adicionar trigger `onStatisticsWrittenForAutoRatings` em Cloud Functions.
- Usar cartoes ponderados (`yellow + red * 3`) em modelos de statistics.
- Atenuar confianca de atacante/meia/goleiro pela relevancia do auto-rating da propria posicao; manter zagueiro baseado em amostra global.

## Tasks

1. Corrigir escala web player card.
2. Adicionar flags de rating manual no modelo compartilhado e mapeamentos.
3. Adicionar trigger backend de auto-ratings.
4. Corrigir peso de cartoes vermelhos.
5. Corrigir confianca por posicao.
6. Validar web/functions/android compile quando possivel.

## Implementation

- `usePlayerCard` converte media 0-5 para overall 0-99.
- `User` compartilhado ganhou flags `*_rating_set`; `getEffectiveRating()` agora respeita rating manual `0.0` quando explicitamente definido.
- Web/Android passam a gravar flags de rating manual ao salvar ratings.
- Cloud Function `onStatisticsWrittenForAutoRatings` recalcula auto-ratings a partir de `statistics/{userId}`.
- Calculo de disciplina usa `yellow + red * 3` em modelos compartilhado e Android.
- `getAutoRatingConfidence(role)` agora usa confianca global somente para zagueiro; atacante/meia/goleiro sao atenuados pelo auto-rating da propria posicao.

## Verify

- [x] `npm run build` em `web/`
- [x] `npm run build` em `functions/`
- [x] `npx jest test/auto-ratings.test.ts test/location-management.test.ts --no-coverage`
- [x] `./gradlew :shared:compileKotlinIosSimulatorArm64 :app:compileDebugKotlin`
- [x] `./gradlew :app:testDebugUnitTest --tests "com.futebadosparcas.domain.model.UserTest"`
