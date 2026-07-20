import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAutoBreadcrumbs } from './useAutoBreadcrumbs';
import {
  BreadcrumbEntityProvider,
  useBreadcrumbEntityLabel,
} from '../contexts/BreadcrumbEntityContext';

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

  it('preserva pai e detalhe sem expor o ID técnico', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/group/abcdefghijk/settings']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useAutoBreadcrumbs(), { wrapper });

    expect(result.current).toEqual([
      { label: 'Grupo', to: '/?tab=2' },
      { label: 'Detalhes', to: '/group/abcdefghijk' },
      { label: 'Configurações', to: '/group/abcdefghijk/settings' },
    ]);
  });

  it('substitui o fallback pelo nome de grupo já carregado pela tela', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/group/abcdefghijk/settings']}>
        <BreadcrumbEntityProvider>{children}</BreadcrumbEntityProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => {
      useBreadcrumbEntityLabel('group', 'abcdefghijk', 'Parças da Vila');
      return useAutoBreadcrumbs();
    }, { wrapper });

    await waitFor(() => expect(result.current[1]?.label).toBe('Parças da Vila'));
    expect(result.current).toEqual([
      { label: 'Grupo', to: '/?tab=2' },
      { label: 'Parças da Vila', to: '/group/abcdefghijk' },
      { label: 'Configurações', to: '/group/abcdefghijk/settings' },
    ]);
  });

  it('usa fallback acessível em rota profunda de usuário e aceita o nome já carregado', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/weekly-recap/abcdefghijk']}>
        <BreadcrumbEntityProvider>{children}</BreadcrumbEntityProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => {
      useBreadcrumbEntityLabel('user', 'abcdefghijk', 'Rubens Craque');
      return useAutoBreadcrumbs();
    }, { wrapper });

    await waitFor(() => expect(result.current[1]?.label).toBe('Rubens Craque'));
    expect(result.current).toEqual([
      { label: 'Resumo Semanal', to: '/weekly-recap' },
      { label: 'Rubens Craque', to: '/weekly-recap/abcdefghijk' },
    ]);
    expect(result.current.some((item) => item.label === 'abcdefghijk')).toBe(false);
  });

  it('resolve sub-rota estática longa antes da heurística de ID', () => {
    const result = renderBreadcrumbs('/group/abcdefghijk/challenges');

    expect(result.current).toEqual([
      { label: 'Grupo', to: '/?tab=2' },
      { label: 'Detalhes', to: '/group/abcdefghijk' },
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

  it('omite IDs técnicos e mantém o rótulo conhecido da publicação', () => {
    const result = renderBreadcrumbs('/group/abcdefghijk/post/zyxwvutsrqp');

    expect(result.current).toEqual([
      { label: 'Grupo', to: '/?tab=2' },
      { label: 'Detalhes', to: '/group/abcdefghijk' },
      { label: 'Publicação', to: undefined },
    ]);
    expect(result.current.some((item) => /abcdefghijk|zyxwvutsrqp/.test(item.label))).toBe(false);
  });

  it.each(['/game/abcdefghijk', '/group/abcdefghijk', '/profile/abcdefghijk', '/location/abcdefghijk'])(
    'mantém breadcrumb hierárquico em %s',
    (pathname) => {
      const result = renderBreadcrumbs(pathname);
      expect(result.current).toHaveLength(2);
      expect(result.current[1]).toEqual({ label: 'Detalhes', to: pathname });
    },
  );

  it.each(['/level-journey/abcdefghijk', '/weekly-recap/abcdefghijk', '/evolution/abcdefghijk'])(
    'mantém fallback traduzido sem expor ID no deep link %s',
    (pathname) => {
      const result = renderBreadcrumbs(pathname);
      expect(result.current.at(-1)).toEqual({ label: 'Detalhes', to: pathname });
      expect(result.current.some((item) => item.label === 'abcdefghijk')).toBe(false);
    },
  );

  it.each([
    ['en', 'Settings', 'Notifications'],
    ['es', 'Configuración', 'Notificaciones'],
  ])('mantém labels traduzidos no locale %s', async (locale, settings, notifications) => {
    await i18n.changeLanguage(locale);
    const result = renderBreadcrumbs('/settings/notifications');

    expect(result.current.map((item) => item.label)).toEqual([settings, notifications]);
  });

  it('não cria link para o agrupador /map inexistente', () => {
    const result = renderBreadcrumbs('/map/locations');

    expect(result.current).toEqual([
      { label: 'Mapa', to: undefined },
      { label: 'Quadras', to: '/map/locations' },
    ]);
  });

  it.each([
    ['/admin/users', ['Administração', 'Usuários']],
    ['/admin/feedback', ['Administração', 'Feedback']],
    ['/admin/game-reviews', ['Administração', 'Revisões de jogos']],
    ['/dev', ['Início', 'Ferramentas de desenvolvimento']],
    ['/owner/dashboard', ['Proprietário', 'Painel']],
    ['/owner/onboarding', ['Proprietário', 'Cadastro']],
    ['/messages/abcdefghijk', ['Mensagens', 'Conversa']],
    ['/players/nearby', ['Jogadores', 'Por perto']],
  ])('gera uma trilha completa para %s', (pathname, labels) => {
    const result = renderBreadcrumbs(pathname);

    expect(result.current.map((item) => item.label)).toEqual(labels);
  });

  it.each([
    ['pt-BR', '/profile/edit', ['Perfil', 'Editar']],
    ['en', '/map/locations', ['Map', 'Fields']],
    ['es', '/admin/users', ['Administración', 'Usuarios']],
  ])('traduz toda a trilha de %s em %s', async (locale, pathname, labels) => {
    await i18n.changeLanguage(locale);
    const result = renderBreadcrumbs(pathname);

    expect(result.current.map((item) => item.label)).toEqual(labels);
  });

  it('usa Conquistas de forma consistente no breadcrumb em pt-BR', () => {
    const result = renderBreadcrumbs('/badges');
    expect(result.current).toEqual([{ label: 'Conquistas', to: '/badges' }]);
  });
});
