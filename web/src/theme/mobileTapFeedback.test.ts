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
});
