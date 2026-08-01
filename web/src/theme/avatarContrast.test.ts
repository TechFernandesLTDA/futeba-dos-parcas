import { describe, expect, it } from 'vitest';
import {
  futebaDarkOledTheme,
  futebaDarkTheme,
  futebaTheme,
} from './index';
import type { Theme } from '@mui/material/styles';

// #3944 — regressão de contraste WCAG AA em avatares com iniciais.
// Antes do fix, <Avatar> sem bgcolor explícito herdados do MUI caiam para
// grey[400] (light, 1.83:1) / grey[600] (dark, 3.87:1) — ambos reprovam AA.
// O override de tema força primary.main + contrastText (>= 4.66:1).
type RootOverride = ((args: { theme: Theme }) => Record<string, unknown>) | undefined;

function resolveAvatarRoot(theme: Theme): Record<string, unknown> {
  const root = theme.components?.MuiAvatar?.styleOverrides?.root as RootOverride;
  expect(typeof root).toBe('function');
  // MUI armazena o callback; invocamos com o próprio tema resolvido.
  return (root as (args: { theme: Theme }) => Record<string, unknown>)({ theme });
}

describe('avatar initials contrast (#3944)', () => {
  it.each([
    ['light', futebaTheme],
    ['dark', futebaDarkTheme],
    ['OLED', futebaDarkOledTheme],
  ])(
    'MuiAvatar root resolve backgroundColor = primary.main no tema %s',
    (_name, theme) => {
      const resolved = resolveAvatarRoot(theme);
      expect(resolved.backgroundColor).toBe(theme.palette.primary.main);
      expect(resolved.color).toBe(theme.palette.primary.contrastText);
    },
  );

  it('usa cores que passam WCAG AA no light (#00852A sobre #FFFFFF = 4.76:1)', () => {
    const resolved = resolveAvatarRoot(futebaTheme);
    expect(resolved.backgroundColor).toBe('#00852A');
    expect(resolved.color).toBe('#FFFFFF');
  });

  it('declara MuiAvatar explicitamente no dark (não apenas via spread)', () => {
    // O spread ...futebaTheme.components já traria o override, mas o dark
    // redeclara para ser auto-explicito. Garantimos que existe no objeto.
    expect(futebaDarkTheme.components?.MuiAvatar).toBeDefined();
    expect(
      typeof futebaDarkTheme.components?.MuiAvatar?.styleOverrides?.root,
    ).toBe('function');
  });
});
