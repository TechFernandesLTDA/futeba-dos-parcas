import { describe, expect, it } from 'vitest';
import { futebaTheme, futebaDarkTheme, futebaDarkOledTheme } from './index';

// #4114: color-scheme ficava "light" em body/#root nos temas dark e OLED
// porque a regra incondicional 'html, body, #root' fixava colorScheme:'light'
// e a correção por atributo (data-resolved-theme) mirava só o <html>. Como o
// glifo do seletor de data/hora nativo (::-webkit-calendar-picker-indicator)
// é desenhado pelo user agent a partir do color-scheme computado do elemento
// mais próximo, o resultado era um glifo preto sobre fundo escuro (1,18:1 no
// dark, 1:1 no OLED — abaixo do piso de 3,0:1 do repo).
describe('MuiCssBaseline color-scheme (#4114)', () => {
  const themes = {
    futebaTheme,
    futebaDarkTheme,
    futebaDarkOledTheme,
  };

  it.each(Object.entries(themes))(
    '%s: a regra incondicional "html, body, #root" não declara colorScheme',
    (_name, theme) => {
      const overrides = theme.components?.MuiCssBaseline?.styleOverrides as Record<
        string,
        Record<string, unknown>
      >;
      expect(overrides['html, body, #root']).not.toHaveProperty('colorScheme');
    },
  );

  it.each(Object.entries(themes))(
    '%s: o seletor de colorScheme dark cobre html, body E #root',
    (_name, theme) => {
      const overrides = theme.components?.MuiCssBaseline?.styleOverrides as Record<
        string,
        Record<string, unknown>
      >;
      const darkSelector = Object.keys(overrides).find(
        (selector) =>
          selector.includes('data-resolved-theme="dark"') &&
          selector.includes(' body') &&
          selector.includes(' #root'),
      );
      expect(darkSelector).toBeDefined();
      expect(overrides[darkSelector as string]).toMatchObject({ colorScheme: 'dark' });
    },
  );

  it.each(Object.entries(themes))(
    '%s: o seletor de colorScheme light cobre html, body E #root',
    (_name, theme) => {
      const overrides = theme.components?.MuiCssBaseline?.styleOverrides as Record<
        string,
        Record<string, unknown>
      >;
      const lightSelector = Object.keys(overrides).find(
        (selector) =>
          selector.includes('data-resolved-theme="light"') &&
          selector.includes(' body') &&
          selector.includes(' #root'),
      );
      expect(lightSelector).toBeDefined();
      expect(overrides[lightSelector as string]).toMatchObject({ colorScheme: 'light' });
    },
  );

  it('futebaTheme: backgroundColor "#FCFCFC" continua exclusivo do html[data-resolved-theme="light"]', () => {
    const overrides = futebaTheme.components?.MuiCssBaseline?.styleOverrides as Record<
      string,
      Record<string, unknown>
    >;
    expect(overrides['html[data-resolved-theme="light"]']).toMatchObject({
      backgroundColor: '#FCFCFC',
    });
  });
});
