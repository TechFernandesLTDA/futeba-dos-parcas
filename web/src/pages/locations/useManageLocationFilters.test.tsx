import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Location } from '../../types/location';
import { useManageLocationFilters } from './useManageLocationFilters';
import { buildActiveFilterChips } from './manageLocationChips';
import { EMPTY_MANAGE_FILTERS } from './manageLocationUrlState';

const venue = (id: string, city: string, state: string, neighborhood: string) =>
  ({ id, name: id, city, state, neighborhood, district: neighborhood }) as Location;

const LOCATIONS = [
  venue('a', 'Curitiba', 'PR', 'Centro'),
  venue('b', 'Londrina', 'PR', 'Centro'),
  venue('c', 'Joinville', 'SC', 'Anita Garibaldi'),
];

function setup(initial = '/locations') {
  let current = '';
  const Probe: React.FC = () => {
    const location = useLocation();
    current = location.pathname + location.search;
    return null;
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>
      <Probe />
      {children}
    </MemoryRouter>
  );
  const hook = renderHook(() => useManageLocationFilters(LOCATIONS), { wrapper });
  return { hook, url: () => current };
}

describe('useManageLocationFilters (filtros na URL)', () => {
  it('lê o estado inicial da URL', () => {
    const { hook } = setup('/locations?uf=PR&cidade=Curitiba&q=jd');
    expect(hook.result.current.filters.stateFilters).toEqual(['PR']);
    expect(hook.result.current.filters.cityFilters).toEqual(['Curitiba']);
    expect(hook.result.current.filters.searchQuery).toBe('jd');
    expect(hook.result.current.activeCount).toBe(3);
  });

  it('atualizar um filtro escreve na URL (link compartilhável)', async () => {
    const { hook, url } = setup();
    act(() => hook.result.current.update({ stateFilters: ['SC'], quickFilters: ['UNVERIFIED'] }));
    await waitFor(() => expect(url()).toBe('/locations?uf=SC&rapido=UNVERIFIED'));
    expect(hook.result.current.filters.stateFilters).toEqual(['SC']);
  });

  it('cascata: trocar a UF derruba cidade e bairro que deixaram de existir', async () => {
    const { hook, url } = setup('/locations?uf=PR&cidade=Curitiba&bairro=Centro');
    act(() => hook.result.current.update({ stateFilters: ['SC'] }));
    await waitFor(() => expect(url()).toBe('/locations?uf=SC'));
    expect(hook.result.current.filters.cityFilters).toEqual([]);
    expect(hook.result.current.filters.neighborhoodFilters).toEqual([]);
  });

  it('limpar tudo zera os filtros mas preserva outros parâmetros e a ordenação', async () => {
    const { hook, url } = setup('/locations?tab=4&uf=PR&q=x&ord=NEWEST');
    act(() => hook.result.current.clearAll());
    await waitFor(() => expect(url()).toBe('/locations?tab=4&ord=NEWEST'));
    expect(hook.result.current.activeCount).toBe(0);
  });

  it('o botão voltar restaura o filtro anterior (cada mudança cria uma entrada)', async () => {
    const { hook, url } = setup();
    act(() => hook.result.current.update({ stateFilters: ['PR'] }));
    await waitFor(() => expect(url()).toBe('/locations?uf=PR'));
    act(() => hook.result.current.update({ stateFilters: ['PR', 'SC'] }));
    await waitFor(() => expect(url()).toBe('/locations?uf=PR&uf=SC'));
  });

  it('digitação da busca usa replace (não polui o histórico)', async () => {
    const { hook, url } = setup();
    act(() => hook.result.current.update({ searchQuery: 'arena' }, { replace: true }));
    await waitFor(() => expect(url()).toBe('/locations?q=arena'));
  });
});

describe('buildActiveFilterChips', () => {
  const t = (key: string, options?: Record<string, unknown>) =>
    options ? `${key}|${JSON.stringify(options)}` : key;

  it('sem filtros não há chips', () => {
    expect(buildActiveFilterChips(EMPTY_MANAGE_FILTERS, t)).toEqual([]);
  });

  it('um chip por seleção, cada um remove só o seu pedaço', () => {
    const state = {
      ...EMPTY_MANAGE_FILTERS,
      searchQuery: 'arena',
      stateFilters: ['PR', 'SC'],
      cityFilters: ['Curitiba'],
      neighborhoodFilters: ['Centro'],
      quickFilters: ['UNVERIFIED' as const],
      publicationFilter: 'DRAFT' as const,
      verifiedFilter: 'NO' as const,
      amenityFilters: ['parking'],
    };
    const chips = buildActiveFilterChips(state, t);
    expect(chips.map((c) => c.key)).toEqual([
      'q', 'uf:PR', 'uf:SC', 'cidade:Curitiba', 'bairro:Centro', 'rapido:UNVERIFIED', 'pub', 'ver', 'comod:parking',
    ]);
    expect(chips.find((c) => c.key === 'uf:PR')?.clear).toEqual({ stateFilters: ['SC'] });
    expect(chips.find((c) => c.key === 'q')?.clear).toEqual({ searchQuery: '' });
    expect(chips.find((c) => c.key === 'pub')?.label).toBe('Rascunho');
    expect(chips.find((c) => c.key === 'comod:parking')?.label).toBe('Estacionamento');
    expect(chips.find((c) => c.key === 'rapido:UNVERIFIED')?.label).toBe('locations.manageFilters.quick.UNVERIFIED');
  });

  it('ordenação e vista não geram chips', () => {
    expect(buildActiveFilterChips({ ...EMPTY_MANAGE_FILTERS, sortBy: 'CITY', view: 'cards' }, t)).toEqual([]);
  });
});
