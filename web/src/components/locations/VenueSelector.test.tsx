import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from 'i18next';
import type { Location } from '../../types/location';

const mockFetchStateVenues = vi.fn();
vi.mock('../../services/venueCatalog', () => ({
  fetchStateVenues: (...args: unknown[]) => mockFetchStateVenues(...args),
  fetchCityVenues: vi.fn(),
  fetchAllVenues: vi.fn(),
  fetchVenuesNear: vi.fn(),
}));
vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

import { VenueSelector, VenueSelectorProps } from './VenueSelector';

const venue = (id: string, name: string, extra: Partial<Location> = {}) =>
  ({ id, name, city: 'Curitiba', state: 'PR', isActive: true, isVerified: true, ...extra }) as Location;

function renderSelector(overrides: Partial<VenueSelectorProps> = {}) {
  const props: VenueSelectorProps = {
    label: 'Quadra / Local',
    city: { city: 'Curitiba', state: 'PR' },
    citySource: 'geolocation',
    resolvingCity: false,
    onChangeCity: vi.fn(),
    inCity: [],
    otherCities: [],
    recentIds: [],
    loading: false,
    loadingOtherCities: false,
    onSearchQueryChange: vi.fn(),
    selectedVenue: null,
    customSelected: false,
    customLabel: 'Outro local (digitar manualmente)',
    onSelectVenue: vi.fn(),
    onSelectCustom: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <VenueSelector {...props} />
    </QueryClientProvider>,
  );
  return props;
}

describe('VenueSelector', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('pt-BR');
  });

  it('separa "Últimas utilizações" das demais quadras da cidade', async () => {
    const user = userEvent.setup();
    renderSelector({
      inCity: [venue('r', 'Recente Arena'), venue('a', 'Alfa Society'), venue('b', 'Beta Futsal')],
      recentIds: ['r'],
    });

    await user.click(screen.getByRole('combobox', { name: /quadra \/ local/i }));

    expect(screen.getByText('Últimas utilizações')).toBeInTheDocument();
    expect(screen.getByText('Quadras de Curitiba - PR')).toBeInTheDocument();
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options[0]).toContain('Recente Arena');
    expect(options[1]).toContain('Alfa Society');
    expect(options[2]).toContain('Beta Futsal');
  }, 15000);

  it('mostra "Resultados em outras cidades" com a cidade de cada quadra', async () => {
    const user = userEvent.setup();
    renderSelector({
      otherCities: [venue('lon', 'Arena Jardim Europa', { city: 'Londrina', state: 'PR' })],
    });

    await user.click(screen.getByRole('combobox', { name: /quadra \/ local/i }));

    expect(screen.getByText('Resultados em outras cidades')).toBeInTheDocument();
    const option = screen.getByRole('option', { name: /arena jardim europa/i });
    expect(within(option).getByText('Londrina - PR')).toBeInTheDocument();
  }, 15000);

  it('sem resultados mostra o aviso e ainda oferece o local manual', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole('combobox', { name: /quadra \/ local/i }));

    expect(screen.getByText(/nenhuma quadra encontrada/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /outro local/i })).toBeInTheDocument();
  }, 15000);

  it('escolher uma quadra chama onSelectVenue e o local manual chama onSelectCustom', async () => {
    const user = userEvent.setup();
    const alfa = venue('a', 'Alfa Society');
    const props = renderSelector({ inCity: [alfa] });

    await user.click(screen.getByRole('combobox', { name: /quadra \/ local/i }));
    await user.click(screen.getByRole('option', { name: /alfa society/i }));
    expect(props.onSelectVenue).toHaveBeenCalledWith(alfa);

    await user.click(screen.getByRole('combobox', { name: /quadra \/ local/i }));
    await user.click(screen.getByRole('option', { name: /outro local/i }));
    expect(props.onSelectCustom).toHaveBeenCalled();
  }, 15000);

  it('digitar atualiza a busca', async () => {
    const user = userEvent.setup();
    const props = renderSelector({ inCity: [venue('a', 'Alfa Society')] });

    await user.type(screen.getByRole('combobox', { name: /quadra \/ local/i }), 'soc');

    expect(props.onSearchQueryChange).toHaveBeenLastCalledWith('soc');
  }, 15000);

  it('"Trocar cidade" abre UF → cidade e devolve a cidade escolhida', async () => {
    mockFetchStateVenues.mockResolvedValue([
      venue('1', 'A', { city: 'Curitiba' }),
      venue('2', 'B', { city: 'Londrina' }),
      venue('3', 'C', { city: 'Londrina' }),
    ]);
    const user = userEvent.setup();
    const props = renderSelector();

    await user.click(screen.getByRole('button', { name: /trocar cidade/i }));

    const dialog = await screen.findByRole('dialog');
    // UF já vem preenchida com a do estado atual (PR) e lista as cidades com contagem
    expect(await within(dialog).findByText('Londrina')).toBeInTheDocument();
    expect(within(dialog).getByText('2 quadras')).toBeInTheDocument();
    expect(mockFetchStateVenues).toHaveBeenCalledWith('PR');

    await user.click(within(dialog).getByText('Londrina'));

    expect(props.onChangeCity).toHaveBeenCalledWith({ city: 'Londrina', state: 'PR' });
  }, 20000);

  it('sem cidade mostra o aviso e mantém o botão "Trocar cidade"', () => {
    renderSelector({ city: null, citySource: null });
    expect(screen.getByText('Escolha uma cidade para ver as quadras')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trocar cidade/i })).toBeInTheDocument();
  });
});
