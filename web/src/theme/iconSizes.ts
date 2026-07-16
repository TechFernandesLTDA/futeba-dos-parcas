/**
 * Tokens centralizados de tamanhos de ícones.
 * Substitui valores inline/hardcoded como `fontSize={64}` por referências semânticas.
 *
 * Mapeamento aproximado para MUI icon sizes:
 *   xs=14 (MUI fontSize="small" com scale),
 *   sm=16 (chips/listas inline),
 *   md=20 (MUI fontSize="small"),
 *   lg=24 (MUI default),
 *   xl=36 (headers/destaques),
 *   xxl=48 (empty states/feature icons),
 *   hero=64 (grandes — splash/onboarding)
 */
export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 36,
  xxl: 48,
  hero: 64,
  sidebar: 28,
} as const;

export type IconSize = keyof typeof iconSizes;

/**
 * Tamanhos de avatar centralizados.
 */
export const avatarSizes = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
  xxl: 120,
  sidebar: 36,
  sidebarCompact: 28,
} as const;

export type AvatarSize = keyof typeof avatarSizes;
