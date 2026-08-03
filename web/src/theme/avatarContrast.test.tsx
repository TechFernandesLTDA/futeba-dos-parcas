import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Avatar, ThemeProvider, CssBaseline } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import {
  futebaDarkOledTheme,
  futebaDarkTheme,
  futebaTheme,
} from './index';

// #3944 — regressão de contraste WCAG AA em avatares com iniciais.
// Antes do fix, <Avatar> sem bgcolor explícito herdados do MUI caiam para
// grey[400] (light, 1.83:1) / grey[600] (dark, 3.87:1) — ambos reprovam AA.
// O override de tema força primary.main + contrastText (>= 4.66:1) no slot
// `colorDefault`.
//
// #3970 — o slot `root` pintava de verde TODOS os avatares, inclusive os com
// foto. O resolver do MUI só aplica `colorDefault` quando não há <img>, então
// é o slot correto. Estes testes travam ambas as propriedades:
//   (a) avatares com iniciais ficam com fundo primary.main (contraste AA);
//   (b) avatares com foto NÃO pegam o fundo (permanecem transparentes).

type ColorDefaultOverride =
  | ((args: { theme: Theme }) => Record<string, unknown>)
  | undefined;

function resolveAvatarColorDefault(theme: Theme): Record<string, unknown> {
  const fn = theme.components?.MuiAvatar?.styleOverrides
    ?.colorDefault as ColorDefaultOverride;
  expect(typeof fn).toBe('function');
  return (fn as (args: { theme: Theme }) => Record<string, unknown>)({ theme });
}

/**
 * Renderiza um <Avatar> sob o tema real e lê o background computado pelo jsdom.
 * Em jsdom, emotion injeta <style> com a classe do slot e getComputedStyle
 * resolve a regra estática — suficiente para distinguir colorDefault de root.
 */
function renderAvatarInTheme(ui: React.ReactElement, theme: Theme) {
  const { container } = render(
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme={false} />
      {ui}
    </ThemeProvider>,
  );
  const avatarEl = container.querySelector('.MuiAvatar-root');
  expect(avatarEl).not.toBeNull();
  return getComputedStyle(avatarEl as Element).backgroundColor;
}

describe('avatar initials contrast (#3944) + foto não-pintada (#3970)', () => {
  describe('objeto de tema — slot colorDefault', () => {
    it.each([
      ['light', futebaTheme],
      ['dark', futebaDarkTheme],
      ['OLED', futebaDarkOledTheme],
    ])(
      'MuiAvatar colorDefault resolve backgroundColor = primary.main no tema %s',
      (_name, theme) => {
        const resolved = resolveAvatarColorDefault(theme);
        expect(resolved.backgroundColor).toBe(theme.palette.primary.main);
        expect(resolved.color).toBe(theme.palette.primary.contrastText);
      },
    );

    it('usa cores que passam WCAG AA no light (#00852A sobre #FFFFFF = 4.76:1)', () => {
      const resolved = resolveAvatarColorDefault(futebaTheme);
      expect(resolved.backgroundColor).toBe('#00852A');
      expect(resolved.color).toBe('#FFFFFF');
    });

    it('declara MuiAvatar (colorDefault) explicitamente no dark (não apenas via spread)', () => {
      // O spread ...futebaTheme.components já traria o override, mas o dark
      // redeclara para ser auto-explicito. Garantimos que existe no objeto.
      expect(futebaDarkTheme.components?.MuiAvatar).toBeDefined();
      expect(
        typeof futebaDarkTheme.components?.MuiAvatar?.styleOverrides?.colorDefault,
      ).toBe('function');
    });

    // #3970: regressão guard — garantir que NINGUÉM reabra o bug movendo o
    // override de volta para o slot `root` (que pinta também avatares com foto).
    it('NÃO declara o override no slot root (pintaria avatares com foto)', () => {
      expect(futebaTheme.components?.MuiAvatar?.styleOverrides?.root).toBeUndefined();
      expect(
        futebaDarkTheme.components?.MuiAvatar?.styleOverrides?.root,
      ).toBeUndefined();
    });
  });

  describe('render — avatares com iniciais ficam verdes (alvo do #3944)', () => {
    it.each([
      ['light', futebaTheme, 'rgb(0, 133, 42)'],
      ['dark', futebaDarkTheme, 'rgb(74, 222, 128)'],
    ])(
      '<Avatar>AB</Avatar> pega fundo primary.main no tema %s',
      (_name, theme, expectedRgb) => {
        const bg = renderAvatarInTheme(<Avatar>AB</Avatar>, theme);
        expect(bg).toBe(expectedRgb);
      },
    );
  });

  describe('render — avatares com foto NÃO pegam fundo (#3970)', () => {
    it.each([
      ['light', futebaTheme],
      ['dark', futebaDarkTheme],
    ])(
      '<Avatar src /> permanece transparente (não primary.main) no tema %s',
      (_name, theme) => {
        const bg = renderAvatarInTheme(
          <Avatar src="https://example.com/badge.png" alt="time" />,
          theme,
        );
        // Sem override em `root`, o background do avatar com foto é transparente.
        // Aceitamos tanto 'transparent' quanto rgba(0,0,0,0) (mesma cor) — mas
        // jamais o primary.main (regressão do bug original).
        expect(bg).not.toBe(`rgb(${0}, 133, 42)`);
        expect(bg).not.toBe('rgb(0, 133, 42)');
        expect(bg).not.toBe('rgb(74, 222, 128)');
        expect(bg).toMatch(/^(transparent|rgba\(0, 0, 0, 0\)|rgba\(0,0,0,0\))$/);
      },
    );
  });
});
