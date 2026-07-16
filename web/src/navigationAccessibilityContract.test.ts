import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('contrato de acessibilidade da navegação', () => {
  it('move o foco no próximo frame e anuncia pathname + search sem document.title', () => {
    const app = source('src/App.tsx');
    const focusBlock = app.slice(app.indexOf('function useFocusOnNavigate'), app.indexOf('function AppRoutes'));
    const announcerBlock = app.slice(app.indexOf('function RouteAnnouncer'), app.indexOf('function SWUpdateListener'));

    expect(focusBlock).toContain('window.requestAnimationFrame');
    expect(focusBlock).toContain('window.cancelAnimationFrame');
    expect(focusBlock).not.toContain('setTimeout');
    expect(focusBlock).toContain('[location.pathname, location.search]');

    expect(announcerBlock).toContain('getActiveNavItem(location.pathname, location.search)');
    expect(announcerBlock).toContain("t('a11y.routeAnnouncement'");
    expect(announcerBlock).not.toContain('document.title');
  });

  it('remove a navegação inferior escondida da árvore interativa', () => {
    const bottomNav = source('src/components/layout/MobileBottomNav.tsx');

    expect(bottomNav).toContain('aria-hidden={trigger ? true : undefined}');
    expect(bottomNav).toContain('tabIndex={trigger ? -1 : undefined}');
    expect(bottomNav).toContain('timeout={reducedMotion ? 0 : undefined}');
    expect(bottomNav).toContain('mountOnEnter');
    expect(bottomNav).toContain('unmountOnExit');
  });

  it('usa propriedades lógicas nos componentes auditados', () => {
    const bottomNav = source('src/components/layout/MobileBottomNav.tsx');
    const topBar = source('src/components/layout/MobileTopBar.tsx');
    const sidebar = source('src/components/layout/AppSidebar.tsx');

    expect(bottomNav).toContain('insetInlineStart');
    expect(bottomNav).toContain('paddingInlineEnd');
    expect(bottomNav).not.toMatch(/\n\s+(left|right|pl|pr):/);
    expect(topBar).toContain('paddingInlineStart');
    expect(topBar).not.toMatch(/\n\s+(pl|pr|mr|ml):/);
    expect(sidebar).toContain('borderInlineEnd');
    expect(sidebar).not.toContain('borderRight:');
  });

  it('não mantém animação infinita em nenhum indicador de notificações', () => {
    const bell = source('src/components/common/NotificationBell.tsx');
    const sidebar = source('src/components/layout/AppSidebar.tsx');

    expect(bell).not.toContain('infinite');
    expect(sidebar).not.toContain('infinite');
    expect(sidebar).toContain('NOTIFICATION_PULSE_CYCLES');
  });
});
