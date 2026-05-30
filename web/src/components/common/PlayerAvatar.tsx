/**
 * #2176: localização canônica do componente PlayerAvatar.
 *
 * A implementação atual vive em `GameCard.tsx`; este módulo reexporta para que
 * novos imports usem `common/PlayerAvatar` em vez de importar de `GameCard`.
 */
export { PlayerAvatar } from './GameCard';
