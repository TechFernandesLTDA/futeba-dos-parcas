import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('contrato de acessibilidade da navegação', () => {
  it('move o foco após a transição e anuncia pathname + search sem document.title', () => {
    const app = source('src/App.tsx');
    const focusBlock = app.slice(app.indexOf('function useFocusOnNavigate'), app.indexOf('function AppRoutes'));
    const announcerBlock = app.slice(app.indexOf('function RouteAnnouncer'), app.indexOf('function SWUpdateListener'));

    expect(focusBlock).toContain('return useCallback');
    expect(focusBlock).not.toContain('setTimeout');
    expect(focusBlock).toContain('[location.pathname, location.search]');
    expect(app).toContain('onTransitionComplete={focusMainContent}');

    expect(app).toContain('function getRouteAnnouncementTitle(');
    expect(app).toContain("if (pathname === '/guide') return t('page.title.appGuide');");
    expect(app).toContain("if (pathname.startsWith('/checkin/')) return t('page.title.qrCheckIn');");
    expect(announcerBlock).toContain('getRouteAnnouncementTitle(');
    expect(announcerBlock).toContain("t('a11y.routeAnnouncement'");
    expect(announcerBlock).not.toContain('document.title');

    const publicRoutesBlock = app.slice(
      app.indexOf('PUBLIC_ROUTE_TITLES'),
      app.indexOf('function RouteAnnouncer'),
    );
    expect(publicRoutesBlock).toMatch(/if \(publicTitle\) return t\(publicTitle\);/);

    const publicRoutes = [...app.matchAll(
      /<Route\s+path="([^"]+)"\s+element=\{<PublicRoute>/g,
    )].map((m) => m[1]);

    const mappedEntries = [...publicRoutesBlock.matchAll(
      /'([^']+)':\s*'([^']+)'/g,
    )].map((m) => ({ path: m[1], key: m[2] }));

    expect(publicRoutes.length).toBeGreaterThan(0);
    const unmappedPublicRoutes = publicRoutes.filter(
      (route) => !mappedEntries.some((entry) => entry.path === route),
    );
    expect(unmappedPublicRoutes).toEqual([]);

    const ptBR = JSON.parse(source('src/i18n/locales/pt-BR.json')) as unknown;
    const hasI18nKey = (dotted: string): boolean => {
      let cursor: unknown = ptBR;
      for (const part of dotted.split('.')) {
        if (typeof cursor !== 'object' || cursor === null) return false;
        cursor = (cursor as Record<string, unknown>)[part];
      }
      return cursor !== undefined;
    };
    const orphanKeys = mappedEntries
      .map((entry) => entry.key)
      .filter((key) => !hasI18nKey(key));
    expect(orphanKeys).toEqual([]);

    expect(app).toMatch(/path="\/launch"/);
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

  it('redireciona o painel técnico de performance para a administração útil', () => {
    const app = source('src/App.tsx');

    expect(app).toContain(
      '<Route path="/admin/performance" element={<AdminRoute><Navigate to="/admin/users" replace /></AdminRoute>} />',
    );
    expect(app).not.toContain("import('./pages/admin/PerformanceDashboard')");
  });
});
