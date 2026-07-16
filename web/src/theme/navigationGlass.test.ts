import { describe, expect, it } from 'vitest';
import { alpha } from '@mui/material/styles';
import { futebaDarkOledTheme, futebaDarkTheme, futebaTheme } from './index';
import { getNavigationGlassStyles, navigationGlassTokens } from './navigationGlass';

describe('navigationGlass', () => {
  it.each([
    ['light', futebaTheme],
    ['dark', futebaDarkTheme],
    ['OLED', futebaDarkOledTheme],
  ])('mantém o vidro de navegação ativo no tema %s', (_name, theme) => {
    const styles = getNavigationGlassStyles(theme, 'desktop');

    expect(styles.backdropFilter).toBe(`blur(${navigationGlassTokens.desktop.blurPx}px)`);
    expect(styles.WebkitBackdropFilter).toBe(styles.backdropFilter);
    expect(styles.backgroundColor).toBe(
      alpha(theme.palette.background.paper, navigationGlassTokens.desktop.surfaceOpacity),
    );
  });

  it('documenta raios distintos para mobile e desktop', () => {
    expect(navigationGlassTokens.mobile.blurPx).toBe(12);
    expect(navigationGlassTokens.desktop.blurPx).toBe(16);
  });

  it.each(['mobile', 'desktop'] as const)('deriva fallback e redução de transparência do token %s', (surface) => {
    const styles = getNavigationGlassStyles(futebaTheme, surface);
    const filter = `blur(${navigationGlassTokens[surface].blurPx}px)`;
    const unsupportedQuery = `@supports not ((backdrop-filter: ${filter}) or (-webkit-backdrop-filter: ${filter}))`;

    expect(styles[unsupportedQuery]).toEqual({
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      backgroundColor: futebaTheme.palette.background.paper,
    });
    expect(styles['@media (prefers-reduced-transparency: reduce)']).toEqual({
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      backgroundColor: futebaTheme.palette.background.paper,
    });
  });
});
