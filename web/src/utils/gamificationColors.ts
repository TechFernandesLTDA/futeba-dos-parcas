import type { Theme } from '@mui/material/styles';
import {
  gamificationColors,
  gamificationColorsDark,
  gamificationColorsOnLight,
  rarityColors,
  rarityColorsDark,
} from '../theme';

/**
 * Retorna a paleta de cores de gamificação correta para o tema atual.
 *
 * Light mode usa os metais canônicos (pensados como FUNDO — medalha, barra de
 * progresso); Dark/OLED usa cores mais brilhantes (`gamificationColorsDark`)
 * para manter contraste WCAG adequado sobre fundos #0F172A / #000000.
 *
 * ⚠️ #4041: no LIGHT esses metais NÃO servem como cor de TEXTO sobre fundo
 * claro (silver #E0E0E0 = 1.32:1, gold #FFD700 = 1.40:1). Para foreground use
 * `getGamificationTextColors(theme)`.
 *
 * #2163 / #2271: centraliza a seleção de paleta por tema — antes várias telas
 * usavam `gamificationColors` (light-only) diretamente, quebrando dark/OLED.
 */
export function getGamificationColors(theme: Theme): typeof gamificationColors {
  return theme.palette.mode === 'dark' ? gamificationColorsDark : gamificationColors;
}

/**
 * Paleta de gamificação segura como cor de TEXTO no tema atual (#4041).
 *
 * Light → `gamificationColorsOnLight` (tons escuros dos mesmos matizes,
 * todos >= 4.5:1 sobre background.paper/default); Dark → `gamificationColorsDark`
 * (tons brilhantes que já passam sobre #0F172A / #1E293B).
 */
export function getGamificationTextColors(theme: Theme): typeof gamificationColors {
  return theme.palette.mode === 'dark' ? gamificationColorsDark : gamificationColorsOnLight;
}

/** Cor de TEXTO de um token de gamificação, theme-aware e AA (#4041). */
export function getGamificationTextColor(
  token: keyof typeof gamificationColors,
  theme: Theme,
): string {
  return getGamificationTextColors(theme)[token];
}

/**
 * Retorna a paleta de cores de raridade (badges/cards) correta para o tema.
 */
export function getRarityColors(theme: Theme): Record<string, string> {
  return theme.palette.mode === 'dark' ? rarityColorsDark : rarityColors;
}

/** Cor de uma raridade específica, theme-aware. Fallback para COMUM. */
export function getRarityColor(rarity: string, theme: Theme): string {
  const colors = getRarityColors(theme);
  return colors[rarity] ?? colors.COMUM;
}
