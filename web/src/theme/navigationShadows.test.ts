import { describe, expect, it } from 'vitest';
import {
  futebaDarkOledTheme,
  futebaDarkTheme,
  futebaTheme,
} from './index';

describe('navigation shadow tokens', () => {
  it('uses directional shadows for the top and bottom mobile bars', () => {
    expect(futebaTheme.shadowsCustom.navTop).toContain('0 1px');
    expect(futebaTheme.shadowsCustom.navBottom).toContain('0 -1px');
  });

  it.each([
    ['dark', futebaDarkTheme],
    ['OLED', futebaDarkOledTheme],
  ])('adds a visible light boundary in the %s theme', (_name, theme) => {
    expect(theme.shadowsCustom.navTop).toContain('rgba(255,255,255');
    expect(theme.shadowsCustom.navBottom).toContain('rgba(255,255,255');
    expect(theme.shadowsCustom.navTop).not.toBe(futebaTheme.shadowsCustom.navTop);
    expect(theme.shadowsCustom.navBottom).not.toBe(futebaTheme.shadowsCustom.navBottom);
  });
});
