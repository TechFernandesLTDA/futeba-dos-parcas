import { describe, expect, it } from 'vitest';
import { futebaTheme } from './index';

describe('mobile tap feedback', () => {
  it('remove o highlight cinza do Safari e preserva active em controles não-MUI', () => {
    const overrides = futebaTheme.components?.MuiCssBaseline?.styleOverrides as Record<string, Record<string, unknown>>;
    expect(overrides['html, body, #root']).toMatchObject({
      WebkitTapHighlightColor: 'transparent',
    });
    expect(overrides['@media (hover: none) and (pointer: coarse)']).toHaveProperty(
      'a[href]:not(.MuiButtonBase-root):active, button:not(.MuiButtonBase-root):active, [role="button"]:not(.MuiButtonBase-root):active',
    );
  });

  it('garante área de toque de 44px em chips, tabs e toggles no touch (#4407)', () => {
    const overrides = futebaTheme.components?.MuiCssBaseline?.styleOverrides as Record<string, Record<string, Record<string, unknown>>>;
    const coarse = overrides['@media (hover: none) and (pointer: coarse)'];
    expect(coarse['.MuiTab-root.MuiTab-root, .MuiToggleButton-root.MuiToggleButton-root']).toMatchObject({ minHeight: 44 });
    expect(coarse['.MuiChip-clickable, .MuiChip-deletable']).toHaveProperty('&::after');
  });
});
