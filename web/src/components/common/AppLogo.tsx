/**
 * AppLogo — componente padronizado para renderizar a logo do app.
 *
 * Usa /logo-360.webp (derivado do /logo.png, asset canônico, mesmo arquivo do Android ic_app_logo_full).
 * Centraliza tamanho, shape e fallback para garantir consistência visual em
 * sidebar, top bar, login, register e outras telas de branding.
 *
 * Tamanhos padrão (mapa com Android AppLogoSize):
 *  - small  = 32  → top bars, list items
 *  - medium = 64  → cards, headers compactos
 *  - large  = 120 → tela About, dialogs
 *  - xlarge = 180 → splash, onboarding hero
 */
import { Box, SxProps, Theme } from '@mui/material';

export type AppLogoSize = 'small' | 'medium' | 'large' | 'xlarge';
export type AppLogoShape = 'circle' | 'rounded' | 'square';

interface AppLogoProps {
  size?: AppLogoSize;
  shape?: AppLogoShape;
  alt?: string;
  sx?: SxProps<Theme>;
}

const SIZE_MAP: Record<AppLogoSize, number> = {
  small: 32,
  medium: 64,
  large: 120,
  xlarge: 180,
};

const SHAPE_RADIUS: Record<AppLogoShape, string | number> = {
  circle: '50%',
  rounded: 16,
  square: 0,
};

export function AppLogo({
  size = 'medium',
  shape = 'circle',
  alt = 'Futeba dos Parças',
  sx,
}: AppLogoProps) {
  const px = SIZE_MAP[size];
  const radius = SHAPE_RADIUS[shape];

  return (
    <Box
      component="img"
      // WebP 360px (~10 KB) em vez do PNG 512px (~290 KB): o maior uso é 180px
      // (360px cobre 2x). O logo.png segue para SEO/JSON-LD.
      src={px <= 48 ? '/logo-96.webp' : '/logo-360.webp'}
      width={px}
      height={px}
      decoding="async"
      alt={alt}
      sx={{
        width: px,
        height: px,
        borderRadius: radius,
        objectFit: 'cover',
        flexShrink: 0,
        ...sx,
      }}
    />
  );
}
