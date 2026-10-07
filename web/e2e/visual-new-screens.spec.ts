/**
 * Visual QA — telas novas de administração e quadras.
 *
 * Estes testes não fazem comparação pixel-perfect. Eles protegem o que mais
 * costuma quebrar a experiência no Futeba web: overflow horizontal no celular,
 * conteúdo principal fora da viewport, ações pequenas demais para toque e tela
 * aparentemente vazia depois do carregamento.
 *
 * Executa nos projetos `chromium` e `mobile-chrome` definidos em
 * `playwright.config.ts`, cobrindo desktop e mobile com o mesmo contrato visual.
 */

import { Page, expect } from '@playwright/test';
import { test } from './fixtures';

type VisualRoute = {
  route: string;
  description: string;
  role: 'admin' | 'fieldOwner' | 'player';
  expectedPattern: RegExp;
};

type VisualReport = {
  viewportWidth: number;
  viewportHeight: number;
  horizontalOverflow: number;
  visibleElementCount: number;
  offscreenElements: Array<{
    tag: string;
    text: string;
    left: number;
    right: number;
    width: number;
  }>;
  touchTargetViolations: Array<{
    tag: string;
    label: string;
    type: string | null;
    className: string;
    targetTag: string;
    targetClassName: string;
    width: number;
    height: number;
  }>;
};

const visualRoutes: VisualRoute[] = [
  {
    route: '/locations',
    description: 'lista de quadras',
    role: 'admin',
    expectedPattern: /locais|quadras/i,
  },
  {
    route: '/location/create',
    description: 'cadastro completo de quadra',
    role: 'admin',
    expectedPattern: /novo local|nova quadra|local/i,
  },
  {
    route: '/owner/dashboard',
    description: 'dashboard do dono de quadra',
    role: 'fieldOwner',
    expectedPattern: /dashboard|quadras|locais/i,
  },
  {
    route: '/owner/onboarding',
    description: 'onboarding do dono de quadra',
    role: 'fieldOwner',
    expectedPattern: /quadra|dono|começar|comecar|onboarding/i,
  },
  {
    route: '/admin/users',
    description: 'gerenciamento de usuários do administrador',
    role: 'admin',
    expectedPattern: /usuários|usuarios|admin/i,
  },
  // /admin/performance foi removida do produto (App.tsx: Navigate para
  // /admin/users) — entrada obsoleta retirada da triagem R2 (06/10).
];

async function assertVisualContract(page: Page, route: VisualRoute): Promise<void> {
  await page.waitForLoadState('domcontentloaded');

  await expect(page.locator('body')).toContainText(route.expectedPattern, {
    timeout: 10000,
  });

  const report = await page.evaluate<VisualReport>(`(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const horizontalOverflow = Math.max(
      document.documentElement.scrollWidth - viewportWidth,
      document.body.scrollWidth - viewportWidth
    );

    const ignoredTags = new Set(['HTML', 'BODY', 'SCRIPT', 'STYLE', 'NOSCRIPT']);
    const visibleElements = Array.from(document.body.querySelectorAll('*'))
      .filter((element) => {
        if (ignoredTags.has(element.tagName)) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      });

    const hasHorizontalScrollAncestor = (element) => {
      let current = element.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        const canScroll = ['auto', 'scroll'].includes(style.overflowX);
        if (canScroll && current.scrollWidth > current.clientWidth + 1) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    };

    const offscreenElements = visibleElements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.getAttribute('aria-label') || '').trim();
        return {
          tag: element.tagName.toLowerCase(),
          text: text.slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          inHorizontalScroller: hasHorizontalScrollAncestor(element),
        };
      })
      .filter((item) => {
        const visuallyHidden = item.left < -1000;
        const decorative = item.text.length === 0;
        return (
          !visuallyHidden &&
          !decorative &&
          !item.inHorizontalScroller &&
          (item.left < -2 || item.right > viewportWidth + 2)
        );
      })
      .slice(0, 10);

    const touchTargetViolations = Array.from(
      document.body.querySelectorAll(
        'button, a[href], [role="button"], input, select, textarea'
      )
    )
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const href = element.getAttribute('href');
        const isSkipLink =
          href === '#main-content' || Boolean(element.closest('[aria-label="Pular navegação"]'));
        const isDisabled =
          element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
        const isVisible =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0;
        const isInlineTextLink =
          element.tagName === 'A' &&
          rect.height < 32 &&
          (element.innerText || '').trim().length > 24;

        return isVisible && !isDisabled && !isInlineTextLink && !isSkipLink;
      })
      .map((element) => {
        const target =
          element.closest('label') ||
          element.closest('.MuiButtonBase-root') ||
          element.closest('.MuiInputBase-root') ||
          element;
        const rect = target.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          label: (
            element.getAttribute('aria-label') ||
            element.innerText ||
            element.getAttribute('placeholder') ||
            ''
          )
            .trim()
            .slice(0, 80),
          type: element.getAttribute('type'),
          className: String(element.className || '').slice(0, 120),
          targetTag: target.tagName.toLowerCase(),
          targetClassName: String(target.className || '').slice(0, 120),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((item) => item.width < 44 || item.height < 44)
      .slice(0, 10);

    return {
      viewportWidth,
      viewportHeight,
      horizontalOverflow,
      visibleElementCount: visibleElements.length,
      offscreenElements,
      touchTargetViolations,
    };
  })()`);

  expect(report.visibleElementCount, `${route.route} deve renderizar conteúdo visível`).toBeGreaterThan(
    8
  );
  expect(report.horizontalOverflow, `${route.route} não pode gerar scroll horizontal`).toBeLessThanOrEqual(
    1
  );
  expect(report.offscreenElements, `${route.route} tem elementos saindo da viewport`).toEqual([]);

  if (report.viewportWidth <= 600) {
    expect(
      report.touchTargetViolations,
      `${route.route} tem ações menores que 44x44 no mobile`
    ).toEqual([]);
  }
}

async function openVisualRoute(page: Page, route: VisualRoute): Promise<void> {
  await page.goto(route.route);
  await expect(page).toHaveURL(new RegExp(`${route.route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), {
    timeout: 10000,
  });
}

test.describe('Visual QA — novas telas web desktop e mobile', () => {
  for (const route of visualRoutes) {
    if (route.role === 'admin') {
      test(`${route.description} (${route.route}) respeita contrato visual`, async ({ adminPage }) => {
        await openVisualRoute(adminPage, route);
        await assertVisualContract(adminPage, route);
      });
    }

    if (route.role === 'fieldOwner') {
      test(`${route.description} (${route.route}) respeita contrato visual`, async ({
        fieldOwnerPage,
      }) => {
        await openVisualRoute(fieldOwnerPage, route);
        await assertVisualContract(fieldOwnerPage, route);
      });
    }

    if (route.role === 'player') {
      test(`${route.description} (${route.route}) respeita contrato visual`, async ({ playerPage }) => {
        await openVisualRoute(playerPage, route);
        await assertVisualContract(playerPage, route);
      });
    }
  }
});
