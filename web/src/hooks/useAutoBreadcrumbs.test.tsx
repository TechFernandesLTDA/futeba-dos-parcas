import React from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useAutoBreadcrumbs } from './useAutoBreadcrumbs';

describe('useAutoBreadcrumbs', () => {
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
});
