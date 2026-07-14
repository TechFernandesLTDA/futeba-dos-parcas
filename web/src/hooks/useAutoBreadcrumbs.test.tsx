import React from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAutoBreadcrumbs } from './useAutoBreadcrumbs';

describe('useAutoBreadcrumbs', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
  });

  function renderBreadcrumbs(pathname: string) {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
    );
    return renderHook(() => useAutoBreadcrumbs(), { wrapper }).result;
  }

  it('evita label duplicada quando um segmento de ID repete o pai dinâmico', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/group/abcdefghijk/settings']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useAutoBreadcrumbs(), { wrapper });

    expect(result.current).toEqual([
      { label: 'Grupo', to: '/group/abcdefghijk' },
      { label: 'Configurações', to: '/group/abcdefghijk/settings' },
    ]);
  });

  it('resolve sub-rota estática longa antes da heurística de ID', () => {
    const result = renderBreadcrumbs('/group/abcdefghijk/challenges');

    expect(result.current).toEqual([
      { label: 'Grupo', to: '/group/abcdefghijk' },
      { label: 'Desafios', to: '/group/abcdefghijk/challenges' },
    ]);
    expect(result.current.map((item) => item.label)).not.toContain('abcdefghijk');
  });

  it.each([
    ['/settings/gamification', 'Gamificação'],
    ['/settings/notifications', 'Notificações'],
  ])('traduz o segmento estático em %s', (pathname, expectedLabel) => {
    const result = renderBreadcrumbs(pathname);

    expect(result.current).toEqual([
      { label: 'Configurações', to: '/settings' },
      { label: expectedLabel, to: pathname },
    ]);
  });

  it('omite IDs de pais desconhecidos em vez de exibir valor técnico', () => {
    const result = renderBreadcrumbs('/group/abcdefghijk/post/zyxwvutsrqp');

    expect(result.current).toEqual([
      { label: 'Grupo', to: '/group/abcdefghijk' },
    ]);
    expect(result.current.some((item) => /abcdefghijk|zyxwvutsrqp|post/.test(item.label))).toBe(false);
  });

  it.each([
    ['en', 'Settings', 'Notifications'],
    ['es', 'Configuración', 'Notificaciones'],
  ])('mantém labels traduzidos no locale %s', async (locale, settings, notifications) => {
    await i18n.changeLanguage(locale);
    const result = renderBreadcrumbs('/settings/notifications');

    expect(result.current.map((item) => item.label)).toEqual([settings, notifications]);
  });
});
