import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';
import { futebaTheme } from '../../theme';
import { PageContainer, type PageWidth } from './PageContainer';

/**
 * #4047 — contrato de envelope por tier.
 *
 * O override 1320px(lg)/1500px(xl) só pode existir nos tiers LARGOS
 * (list/detail/dashboard). Antes, o carve-out listava só `focused` e o tier
 * `form` renderizava 1500px — idêntico a dashboard — tornando o sistema de 5
 * tiers um sistema de 2. Em 1920px o envelope esperado é:
 *   focused (444px) < form (900px) < list/detail/dashboard (1500px)
 *
 * Como o jsdom não aplica media queries no computed style, o contrato lê as
 * regras CSS que o Emotion injeta para as classes do container renderizado.
 */

interface RuleHit {
  media: string;
  cssText: string;
}

function rulesForElement(element: HTMLElement): RuleHit[] {
  const classes = element.className.split(/\s+/).filter(Boolean);
  const hits: RuleHit[] = [];

  const visit = (rules: CSSRuleList, media: string) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        visit(rule.cssRules, rule.media.mediaText);
      } else if (rule instanceof CSSStyleRule) {
        const matches = rule.selectorText
          .split(',')
          .some((selector) => classes.some((cls) => selector.includes(`.${cls}`)));
        if (matches) hits.push({ media, cssText: rule.style.cssText });
      }
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | undefined;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // stylesheet cross-origin/inacessível
    }
    if (rules) visit(rules, '');
  }
  return hits;
}

/** Todos os valores de max-width declarados numa dada media query. */
function maxWidthValuesAt(hits: RuleHit[], media: string): string[] {
  const normalizedMedia = media.replace(/\s+/g, '');
  return hits
    .filter((hit) => hit.media.replace(/\s+/g, '') === normalizedMedia)
    .flatMap((hit) => {
      const match = hit.cssText.match(/max-width:\s*([^;]+);?/i);
      return match ? [match[1].trim()] : [];
    });
}

function renderContainerTier(tier: PageWidth): { el: HTMLElement; hits: RuleHit[] } {
  const { container } = render(
    <ThemeProvider theme={futebaTheme}>
      <PageContainer maxWidth={tier}>content</PageContainer>
    </ThemeProvider>,
  );
  const el = container.querySelector<HTMLElement>('.MuiContainer-root');
  if (!el) throw new Error(`MuiContainer não encontrado para tier ${tier}`);
  return { el, hits: rulesForElement(el) };
}

function px(value: string): number {
  return Number.parseFloat(value.replace(/[^\d.]/g, ''));
}

describe('PageContainer — envelope por tier (#4047)', () => {
  it('tiers largos (list/detail/dashboard) mantêm o override 1320/1500px', () => {
    for (const tier of ['list', 'detail', 'dashboard'] as PageWidth[]) {
      const { hits } = renderContainerTier(tier);
      expect(maxWidthValuesAt(hits, '(min-width: 1200px)'), `${tier} @lg`).toContain('min(100%, 1320px)');
      expect(maxWidthValuesAt(hits, '(min-width: 1536px)'), `${tier} @xl`).toContain('min(100%, 1500px)');
    }
  });

  it('tiers estreitos (focused/form) NÃO recebem o override de largura', () => {
    for (const tier of ['focused', 'form'] as PageWidth[]) {
      const { el, hits } = renderContainerTier(tier);
      const wideOverride = hits.find(
        (hit) => hit.media !== '' && /1320px|1500px/.test(hit.cssText),
      );
      expect(wideOverride, `${tier} não deve ter override 1320/1500 em media queries`).toBeUndefined();
      // o cap do próprio breakpoint segue valendo
      expect(el.className).toContain(
        tier === 'form' ? 'MuiContainer-maxWidthMd' : 'MuiContainer-maxWidthXs',
      );
    }
  });

  it('envelope em 1920px: focused (444) < form (900) < wide (1500)', () => {
    const caps: Record<string, number> = {};

    for (const tier of ['focused', 'form', 'list', 'detail', 'dashboard'] as PageWidth[]) {
      const { hits } = renderContainerTier(tier);
      const allValues = hits.flatMap((hit) => maxWidthValuesAt([hit], hit.media));
      if (tier === 'focused') {
        expect(allValues).toContain('444px');
        caps[tier] = 444;
      } else if (tier === 'form') {
        expect(allValues).toContain('900px');
        expect(allValues.some((v) => px(v) > 900), 'form não pode passar de 900px').toBe(false);
        caps[tier] = 900;
      } else {
        const xl = maxWidthValuesAt(hits, '(min-width: 1536px)');
        expect(xl).toContain('min(100%, 1500px)');
        caps[tier] = 1500;
      }
    }

    expect(caps.focused).toBeLessThan(caps.form);
    expect(caps.form).toBeLessThan(caps.list);
    expect(caps.list).toBe(caps.detail);
    expect(caps.detail).toBe(caps.dashboard);
  });
});
