/**
 * Helper para brasões de nível do jogador
 *
 * Brasões disponíveis (0-20):
 *   Nível 0  (Novato)                → level_0.png
 *   Nível 1  (Iniciante)             → level_1.png
 *   Nível 2  (Amador)                → level_2.png
 *   Nível 3  (Regular)               → level_3.png
 *   Nível 4  (Experiente)            → level_4.png
 *   Nível 5  (Habilidoso)            → level_5.png
 *   Nível 6  (Profissional)          → level_6.png
 *   Nível 7  (Expert)                → level_7.png
 *   Nível 8  (Mestre)                → level_8.png
 *   Nível 9  (Lenda)                 → level_9.png
 *   Nível 10 (Imortal)               → level_10.png
 *   Nível 11 (Garrincha)             → level_11.png   [cartoon]
 *   Nível 12 (Zico)                  → level_12.png   [cartoon]
 *   Nível 13 (Cruyff)                → level_13.png   [cartoon]
 *   Nível 14 (Beckham)               → level_14.png   [cartoon]
 *   Nível 15 (Ronaldinho)            → level_15.png   [cartoon]
 *   Nível 16 (Ronaldo Fenômeno)      → level_16.png   [cartoon]
 *   Nível 17 (Messi)                 → level_17.png   [cartoon]
 *   Nível 18 (Cristiano Ronaldo)     → level_18.png   [cartoon]
 *   Nível 19 (Diego Maradona)        → level_19.png   [cartoon]
 *   Nível 20 (Pelé)                  → level_20.png   [cartoon]
 *
 * Níveis 11-20 são "Lendas do Futebol" com ilustrações cartoon.
 * Enquanto as imagens não existirem, o fallback onError no <img>
 * redireciona para level_10.png (Imortal).
 */

const MAX_LEVEL = 20;

/** Badge usado como fallback quando a imagem específica não existe */
export const FALLBACK_BADGE = '/images/levels/level_10.png';

export function getLevelBadgeImage(level: number): string {
  const clampedLevel = Math.max(0, Math.min(level, MAX_LEVEL));
  return `/images/levels/level_${clampedLevel}.png`;
}

/**
 * Handler para o evento onError de <img>.
 * Faz fallback para o badge do Imortal quando a imagem do nível não existe.
 * Uso: <img src={getLevelBadgeImage(n)} onError={handleBadgeImageError} />
 */
export function handleBadgeImageError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  if (img.src !== FALLBACK_BADGE) {
    img.src = FALLBACK_BADGE;
  }
}

/**
 * Retorna descrição do brasão para acessibilidade
 */
export function getLevelBadgeDescription(level: number, levelName: string): string {
  return `Brasão de nível ${level} - ${levelName}`;
}

/**
 * Verifica se o nível está na faixa Lendas do Futebol (11+)
 */
export function isLegendBadge(level: number): boolean {
  return level >= 11;
}

/**
 * Retorna todos os níveis de brasão únicos (0-20)
 */
export function getAllBadgeLevels(): number[] {
  return Array.from({ length: MAX_LEVEL + 1 }, (_, i) => i);
}
