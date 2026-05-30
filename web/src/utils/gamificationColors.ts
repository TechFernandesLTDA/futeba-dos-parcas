import type { Theme } from '@mui/material/styles';
import {
  gamificationColors,
  gamificationColorsDark,
  rarityColors,
  rarityColorsDark,
} from '../theme';

/**
 * Retorna a paleta de cores de gamificação correta para o tema atual.
 *
 * Light mode usa cores mais escuras/saturadas (legíveis sobre fundo claro).
 * Dark/OLED usa cores mais brilhantes (`gamificationColorsDark`) para manter
 * contraste WCAG adequado sobre fundos #0F172A / #000000.
 *
 * #2163 / #2271: centraliza a seleção de paleta por tema — antes várias telas
 * usavam `gamificationColors` (light-only) diretamente, quebrando dark/OLED.
 */
export function getGamificationColors(theme: Theme): typeof gamificationColors {
  return theme.palette.mode === 'dark' ? gamificationColorsDark : gamificationColors;
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
