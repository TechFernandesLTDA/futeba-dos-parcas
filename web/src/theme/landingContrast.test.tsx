import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LaunchPage } from '../pages/launch/LaunchPage';
import { ThemeProvider } from '../contexts/ThemeContext';
import { futebaTheme } from './index';

vi.mock('../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

/**
 * #4069 — contraste DEPOIS de overlays decorativos.
 *
 * O token `primary.main` (#00852A) passa AA "no limite" (4,78:1) — folga de
 * apenas 0,28. Este arquivo valida os pares texto/fundo que a auditoria mediu
 * com pixels reais, compondo alfas/overlays sobre o verde (o que uma checagem
 * só do token cru não enxerga), e trava o guard de CSS que impede o brilho do
 * hero de cobrir texto em viewports empilhadas (xs/sm).
 */

type Rgb = [number, number, number];

function parseHex(value: string): Rgb {
  if (value.length === 4) {
    return [
      Number.parseInt(value.slice(1, 2).repeat(2), 16),
      Number.parseInt(value.slice(2, 3).repeat(2), 16),
      Number.parseInt(value.slice(3, 4).repeat(2), 16),
    ];
  }
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function blend(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((channel, index) => (
    channel * alpha + background[index] * (1 - alpha)
  )) as Rgb;
}

function luminance([red, green, blue]: Rgb): number {
  return [red, green, blue].reduce((sum, channel, index) => {
    const normalized = channel / 255;
    const linear = normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function contrastRatio(first: Rgb, second: Rgb): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

const { primary, common, grey } = futebaTheme.palette;
const brandGreen = parseHex(primary.main);      // #00852A
const brandGreenDark = parseHex(primary.dark);  // #005A1C
const white = parseHex(common.white);           // #FFFFFF

describe('verde da marca — folga AA do token cru (#4069)', () => {
  it('branco sobre primary.main entrega AA (4,78:1 — folga de apenas 0,28)', () => {
    expect(contrastRatio(white, brandGreen)).toBeGreaterThanOrEqual(4.5);
  });

  it('branco sobre primary.dark entrega AA com folga (7,5:1)', () => {
    expect(contrastRatio(white, brandGreenDark)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('#4069 — pares medidos DEPOIS de overlays/alfa (o token cru não basta)', () => {
  it('branco sobre primary.main + overlay branco 0,2 (brilho do hero) reprova AA — overlay jamais pode cobrir texto', () => {
    // Pior caso do radial-gradient (intensidade máxima no centro). A medição
    // em produção pegou rgb(21,143,60) sob o eyebrow → 4,18:1.
    const overlayGreen = blend(white, brandGreen, 0.2);
    expect(contrastRatio(white, overlayGreen)).toBeLessThan(4.5);
  });

  it('branco com alfa 0,8 sobre primary.main (subtítulo do /forgot-password) reprova AA', () => {
    const fadedWhite = blend(white, brandGreen, 0.8);
    expect(contrastRatio(fadedWhite, brandGreen)).toBeLessThan(4.5);
  });

  it('contrastText puro sobre primary.main e primary.dark passa AA (fix do subtítulo)', () => {
    // O painel é gradiente primary.main → primary.dark: o pior ponto é o main.
    expect(contrastRatio(parseHex(primary.contrastText), brandGreen)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(parseHex(primary.contrastText), brandGreenDark)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('#4071 — CTA branco sólido do hero', () => {
  it('texto primary.dark sobre branco e sobre grey.100 (hover) entrega AA', () => {
    expect(contrastRatio(brandGreenDark, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(brandGreenDark, parseHex(grey[100]))).toBeGreaterThanOrEqual(4.5);
  });

  it('botão branco contra o hero verde entrega >= 3:1 (WCAG 1.4.11 non-text; antes 1,25:1)', () => {
    expect(contrastRatio(white, brandGreen)).toBeGreaterThanOrEqual(3);
  });
});

// -----------------------------------------------------------------------------
// Guard de CSS — o brilho decorativo do hero (radial-gradient branco a 20% em
// 82% 20%) só existe a partir de md (900px), quando o grid tem duas colunas e
// o centro do brilho cai sobre a imagem. Em xs/sm o texto ocupa a largura toda
// e o brilho clareava o verde sob o eyebrow para 4,18:1.
// -----------------------------------------------------------------------------

interface BeforeRuleHit {
  media: string | null;
  cssText: string;
}

function collectHeroBeforeRules(heroClass: string): BeforeRuleHit[] {
  const hits: BeforeRuleHit[] = [];
  const visit = (rules: CSSRuleList, media: string | null) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        visit(rule.cssRules, rule.conditionText || rule.media.mediaText);
      } else if (
        rule instanceof CSSStyleRule &&
        rule.selectorText.includes(`${heroClass}::before`)
      ) {
        hits.push({ media, cssText: rule.cssText });
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules, null);
    } catch {
      // stylesheet inacessível — ignora
    }
  }
  return hits;
}

describe('#4069 — guard de CSS: overlay do hero restrito a md+', () => {
  it('pseudo-elemento suprimido em xs/sm (min-width:0) e ativo com gradiente só em @media (min-width:900px)', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <LaunchPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    const hero = screen.getByTestId('landing-hero');
    const heroClass = Array.from(hero.classList).find((cls) => cls.startsWith('css-'));
    expect(heroClass, 'hero Box deve ter classe emotion css-*').toBeDefined();

    const rules = collectHeroBeforeRules(heroClass as string);
    expect(rules.length).toBeGreaterThan(0);

    // xs/sm — o resolver do sx responsive também vira media query (min-width:0px):
    // nessa faixa o pseudo-elemento é suprimido, o brilho não cobre o texto.
    const xsRule = rules.find((rule) => (rule.media ?? '').replace(/\s+/g, '') === '(min-width:0px)');
    expect(xsRule, `deve existir regra xs. Regras: ${JSON.stringify(rules)}`).toBeDefined();
    expect(xsRule?.cssText).toMatch(/content:\s*none/);

    // O pseudo-elemento só pode ATIVAR (content: "") dentro de @media
    // (min-width:900px) — única faixa em que o grid tem duas colunas e o
    // centro do brilho (82% 20%) cai sobre a imagem, nunca sobre o texto.
    const activating = rules.filter((rule) => /content:\s*("|')\1/.test(rule.cssText));
    expect(activating.map((rule) => rule.media)).toHaveLength(1);
    expect(activating[0]?.media ?? '').toMatch(/min-width:\s*900px/);
  });
});
