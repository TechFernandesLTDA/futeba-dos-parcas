/**
 * Helper para brasões de nível do jogador
 *
 * Brasões disponíveis:
 * - Níveis 0-20: Brasões únicos para cada nível
 *   Nível 0  (Novato)          → level_0.png
 *   Nível 1  (Iniciante)       → level_1.png
 *   ...                          ...
 *   Nível 10 (Imortal)          → level_10.png
 *   Nível 11 (Garrincha)        → level_11.png
 *   Nível 12 (Zico)             → level_12.png
 *   Nível 13 (Cruyff)           → level_13.png
 *   Nível 14 (Beckham)          → level_14.png
 *   Nível 15 (Ronaldinho)       → level_15.png
 *   Nível 16 (Ronaldo Fenomeno) → level_16.png
 *   Nível 17 (Messi)            → level_17.png
 *   Nível 18 (Cristiano Ronaldo)→ level_18.png
 *   Nível 19 (Diego Maradona)   → level_19.png
 *   Nível 20 (Pelé)             → level_20.png
 */

const MAX_LEVEL = 20;

export function getLevelBadgeImage(level: number): string {
  const clampedLevel = Math.max(0, Math.min(level, MAX_LEVEL));
  return `/images/levels/level_${clampedLevel}.png`;
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
  return level >= 10;
}

/**
 * Retorna todos os níveis de brasão únicos (0-10)
 */
export function getAllBadgeLevels(): number[] {
  return Array.from({ length: MAX_LEVEL + 1 }, (_, i) => i);
}
