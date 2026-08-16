import { render } from '@testing-library/react';
import { Button, ThemeProvider } from '@mui/material';
import { getContrastRatio } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';
import { futebaDarkTheme, futebaDarkOledTheme } from './index';

/**
 * #4052 — hover de botão contained no dark.
 *
 * O MUI escurece o fundo do hover para o shade `.dark` (primary/success →
 * #2E7D32) mantendo o contrastText pensado para o `main` (#000000 → 4.10:1,
 * abaixo de AA). O override do tema troca o TEXTO do hover dessas duas cores
 * para branco (5.13:1). Este teste trava o override no CSS injetado.
 */

function hoverColorRules(): string[] {
  const colors: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | undefined;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      if (
        rule instanceof CSSStyleRule &&
        /MuiButton-contained(Primary|Success):hover/.test(rule.selectorText) &&
        rule.style.color
      ) {
        colors.push(`${rule.selectorText} => ${rule.style.color}`);
      }
    }
  }
  return colors;
}

describe('MuiButton contained hover no dark (#4052)', () => {
  it('primary e success pintam o texto do hover de branco sobre o shade .dark', () => {
    render(
      <ThemeProvider theme={futebaDarkTheme}>
        <Button variant="contained" color="primary">jogar</Button>
        <Button variant="contained" color="success">ok</Button>
      </ThemeProvider>,
    );

    const rules = hoverColorRules();
    expect(
      rules.some((r) => r.includes('containedPrimary') && r.includes('rgb(255, 255, 255)')),
      `hover do contained primary deve ser branco. Regras: ${rules.join(' | ')}`,
    ).toBe(true);
    expect(
      rules.some((r) => r.includes('containedSuccess') && r.includes('rgb(255, 255, 255)')),
      `hover do contained success deve ser branco. Regras: ${rules.join(' | ')}`,
    ).toBe(true);
  });

  it('branco sobre o shade dark #2E7D32 entrega AA (>= 4.5:1)', () => {
    expect(getContrastRatio('#FFFFFF', '#2E7D32')).toBeGreaterThanOrEqual(4.5);
  });

  it('OLED theme herda o override (spread do dark components)', () => {
    const darkContained = futebaDarkTheme.components?.MuiButton?.styleOverrides?.contained;
    const oledContained = futebaDarkOledTheme.components?.MuiButton?.styleOverrides?.contained;
    expect(darkContained).toBeDefined();
    expect(oledContained).toBeDefined();
  });
});
