/**
 * #2176: localização canônica dos componentes de loading inline (shimmer).
 *
 * A implementação atual vive em `GameCard.tsx` por razões históricas; este
 * módulo reexporta para que novos imports usem `common/LoadingState` em vez de
 * importar de `GameCard`. Quando a fonte for movida para cá, os consumidores
 * existentes continuam funcionando via este barrel.
 *
 * Guia de uso (ver também #2176):
 * - `LoadingState` / `ShimmerLoading`: skeleton inline para listas.
 * - `LoadingScreen` (em `common/LoadingScreen.tsx`): loading full-page.
 * - `ScreenSkeletons` (em `common/ScreenSkeletons.tsx`): skeletons por tela.
 */
export { LoadingState, ShimmerLoading, GameCardSkeleton } from './GameCard';
