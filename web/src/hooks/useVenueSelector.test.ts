import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Location } from '../types/location';

const mockFetchCityVenues = vi.fn();
const mockFetchAllVenues = vi.fn();
const mockFetchStateVenues = vi.fn();
const mockFetchVenuesNear = vi.fn();
let mockUser: Record<string, unknown> | null = null;

vi.mock('../services/venueCatalog', () => ({
  fetchCityVenues: (...args: unknown[]) => mockFetchCityVenues(...args),
  fetchAllVenues: (...args: unknown[]) => mockFetchAllVenues(...args),
  fetchStateVenues: (...args: unknown[]) => mockFetchStateVenues(...args),
  fetchVenuesNear: (...args: unknown[]) => mockFetchVenuesNear(...args),
}));

vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

import { useStateCities, useVenueSelector } from './useVenueSelector';

const venue = (id: string, name: string, extra: Partial<Location> = {}) =>
  ({ id, name, city: 'Curitiba', state: 'PR', isActive: true, isVerified: true, ...extra }) as Location;

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

function setGeolocation(impl: ((ok: PositionCallback, fail: PositionErrorCallback) => void) | null) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: impl ? { getCurrentPosition: impl } : undefined,
  });
}

const CURITIBA_VENUES = [
  venue('z', 'Zeta Arena'),
  venue('a', 'Alfa Society', { neighborhood: 'Centro' }),
  venue('m', 'Meio Futsal'),
];

describe('useVenueSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUser = null;
    setGeolocation(null);
    mockFetchCityVenues.mockResolvedValue(CURITIBA_VENUES);
    mockFetchAllVenues.mockResolvedValue([]);
    mockFetchVenuesNear.mockResolvedValue([]);
  });

  afterEach(() => setGeolocation(null));

  it('1) usa a geolocalização: cidade/UF da quadra mais próxima', async () => {
    setGeolocation((ok) => ok({ coords: { latitude: -23.55, longitude: -46.63 } } as GeolocationPosition));
    mockFetchVenuesNear.mockResolvedValue([
      venue('sp', 'Arena SP', { city: 'São Paulo', state: 'SP', latitude: -23.56, longitude: -46.64 }),
    ]);
    mockUser = { city: 'Londrina', state: 'PR' };

    const { result } = renderHook(() => useVenueSelector({ searchQuery: '', recentIds: [] }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.citySource).toBe('geolocation'));
    expect(result.current.city).toEqual({ city: 'São Paulo', state: 'SP' });
    expect(mockFetchCityVenues).toHaveBeenLastCalledWith({ city: 'São Paulo', state: 'SP' });
  });

  it('2) sem geolocalização usa a cidade do perfil', async () => {
    mockUser = { city: 'Londrina', state: 'PR' };
    const { result } = renderHook(() => useVenueSelector({ searchQuery: '', recentIds: [] }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.city).toEqual({ city: 'Londrina', state: 'PR' }));
    expect(result.current.citySource).toBe('profile');
  });

  it('geolocalização negada cai para o perfil', async () => {
    setGeolocation((_ok, fail) => fail({ code: 1, message: 'denied' } as GeolocationPositionError));
    mockUser = { city: 'Londrina', state: 'PR' };
    const { result } = renderHook(() => useVenueSelector({ searchQuery: '', recentIds: [] }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.citySource).toBe('profile'));
  });

  it('3) sem perfil usa a última cidade escolhida (salva)', async () => {
    localStorage.setItem('venue_selector_city', JSON.stringify({ city: 'Joinville', state: 'SC' }));
    const { result } = renderHook(() => useVenueSelector({ searchQuery: '', recentIds: [] }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.city).toEqual({ city: 'Joinville', state: 'SC' }));
    expect(result.current.citySource).toBe('saved');
  });

  it('sem nenhuma fonte não há cidade nem consulta', async () => {
    const { result } = renderHook(() => useVenueSelector({ searchQuery: '', recentIds: [] }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.resolvingCity).toBe(false));
    expect(result.current.city).toBeNull();
    expect(mockFetchCityVenues).not.toHaveBeenCalled();
  });

  it('"Trocar cidade" vale na hora e é salva para a próxima vez', async () => {
    mockUser = { city: 'Londrina', state: 'PR' };
    const { result } = renderHook(() => useVenueSelector({ searchQuery: '', recentIds: [] }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.citySource).toBe('profile'));

    act(() => result.current.changeCity({ city: 'Belém', state: 'PA' }));

    await waitFor(() => expect(result.current.citySource).toBe('manual'));
    expect(result.current.city).toEqual({ city: 'Belém', state: 'PA' });
    expect(JSON.parse(localStorage.getItem('venue_selector_city') ?? '{}')).toEqual({ city: 'Belém', state: 'PA' });
  });

  it('lista da cidade: últimas utilizações primeiro, depois alfabético', async () => {
    mockUser = { city: 'Curitiba', state: 'PR' };
    const { result } = renderHook(
      () => useVenueSelector({ searchQuery: '', recentIds: ['z'] }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.inCity).toHaveLength(3));
    expect(result.current.inCity.map((v) => v.id)).toEqual(['z', 'a', 'm']);
    expect(mockFetchAllVenues).not.toHaveBeenCalled();
  });

  it('busca com resultado na cidade não consulta outras cidades', async () => {
    mockUser = { city: 'Curitiba', state: 'PR' };
    const { result } = renderHook(
      () => useVenueSelector({ searchQuery: 'soc centro', recentIds: [] }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.inCity.map((v) => v.id)).toEqual(['a']));
    expect(mockFetchAllVenues).not.toHaveBeenCalled();
    expect(result.current.otherCities).toEqual([]);
  });

  it('busca sem resultado na cidade procura em outras cidades', async () => {
    mockUser = { city: 'Curitiba', state: 'PR' };
    mockFetchAllVenues.mockResolvedValue([
      ...CURITIBA_VENUES,
      venue('lon', 'Arena Jardim Europa', { city: 'Londrina' }),
    ]);
    const { result } = renderHook(
      () => useVenueSelector({ searchQuery: 'jd europa', recentIds: [] }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.otherCities.map((v) => v.id)).toEqual(['lon']));
    expect(result.current.inCity).toEqual([]);
    expect(mockFetchAllVenues).toHaveBeenCalledTimes(1);
  });
});

describe('useStateCities', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agrupa as quadras da UF em cidades com contagem', async () => {
    mockFetchStateVenues.mockResolvedValue([
      venue('1', 'A', { city: 'Curitiba' }),
      venue('2', 'B', { city: 'Curitiba' }),
      venue('3', 'C', { city: 'Londrina' }),
    ]);
    const { result } = renderHook(() => useStateCities('PR'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.cities).toHaveLength(2));
    expect(result.current.cities.map((c) => [c.city, c.count])).toEqual([['Curitiba', 2], ['Londrina', 1]]);
    expect(mockFetchStateVenues).toHaveBeenCalledWith('PR');
  });

  it('sem UF ou desligado não consulta', () => {
    renderHook(() => useStateCities('', true), { wrapper: createWrapper() });
    renderHook(() => useStateCities('PR', false), { wrapper: createWrapper() });
    expect(mockFetchStateVenues).not.toHaveBeenCalled();
  });
});
