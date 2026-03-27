/**
 * Helper para brasões de nível do jogador
 *
 * Brasões disponíveis:
 * - Níveis 0-10: Brasões únicos para cada nível
 * - Níveis 11-20: Usam o mesmo brasão do nível 10 (Imortal)
 */

const MAX_LEVEL_WITH_UNIQUE_BADGE = 10;
const MAX_LEVEL = 20;

/**
 * Retorna o caminho da imagem do brasão para o nível especificado
 */
export function getLevelBadgeImage(level: number): string {
  const clampedLevel = Math.max(0, Math.min(level, MAX_LEVEL));
  const badgeLevel = clampedLevel > MAX_LEVEL_WITH_UNIQUE_BADGE
    ? MAX_LEVEL_WITH_UNIQUE_BADGE
    : clampedLevel;
  return `/images/levels/level_${badgeLevel}.png`;
}

/**
 * Retorna descrição do brasão para acessibilidade
 */
export function getLevelBadgeDescription(level: number, levelName: string): string {
  return `Brasão de nível ${level} - ${levelName}`;
}

/**
 * Verifica se o nível usa o brasão do Imortal (nível 10+)
 */
export function isImmortalBadge(level: number): boolean {
  return level >= MAX_LEVEL_WITH_UNIQUE_BADGE;
}

/**
 * Retorna todos os níveis de brasão únicos (0-10)
 */
export function getAllBadgeLevels(): number[] {
  return Array.from({ length: MAX_LEVEL_WITH_UNIQUE_BADGE + 1 }, (_, i) => i);
}
