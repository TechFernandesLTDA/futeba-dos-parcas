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

    // #3971: enumera as rotas públicas (auth) que o anúncio deve cobrir.
    // Antes só /guide era checado literalmente, então /login, /register e
    // /forgot-password caíam em "Não encontrado" sem o CI perceber.
    const publicRoutesBlock = app.slice(
      app.indexOf('PUBLIC_ROUTE_TITLES'),
      app.indexOf('function RouteAnnouncer'),
    );
    expect(publicRoutesBlock).toContain("'/login': 'page.title.login'");
    expect(publicRoutesBlock).toContain("'/register': 'page.title.register'");
    expect(publicRoutesBlock).toContain("'/forgot-password': 'auth.forgotPasswordTitle'");
    expect(publicRoutesBlock).toMatch(/if \(publicTitle\) return t\(publicTitle\);/);
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
