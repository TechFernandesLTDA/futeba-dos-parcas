// @vitest-environment jsdom
import { describe, beforeEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '../../test/renderWithProviders';
import type { Game } from '../../types/game';
import type { GameRide, UseGameRidesResult } from '../../hooks/useGameRides';
import { GameRidesPanel } from './GameRidesPanel';

// getFirestoreErrorMessage puxa services/firebase (init real do Firebase) —
// substituído por stub para o teste rodar sem credenciais.
vi.mock('../../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (err: unknown) =>
    err instanceof Error ? err.message : 'Erro do Firestore',
}));

const saveRide = vi.fn();
const cancelRide = vi.fn();
const refetch = vi.fn();

const game = {
  id: 'game-1',
  status: 'CONFIRMED',
  locationName: 'Arena Central',
} as Game;

function makeRidesApi(
  overrides: Partial<UseGameRidesResult> = {},
): UseGameRidesResult {
  return {
    rides: [],
    currentUserRide: null,
    loading: false,
    saving: false,
    cancelling: false,
    error: null,
    refetch,
    saveRide,
    cancelRide,
    ...overrides,
  } as unknown as UseGameRidesResult;
}

const offerRide: GameRide = {
  id: 'ride-1',
  type: 'OFFER',
  userName: 'Motorista Parça',
  userPhoto: null,
  originLabel: 'Estação Central',
  destinationLabel: 'Arena Central',
  seats: 3,
  note: 'Saio às 18h',
} as unknown as GameRide;

describe('GameRidesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveRide.mockResolvedValue(undefined);
    cancelRide.mockResolvedValue(undefined);
  });

  it('exibe empty state quando não há caronas', () => {
    renderWithProviders(
      <GameRidesPanel game={game} canUse ridesApi={makeRidesApi()} />,
    );

    expect(screen.getByText('Nenhuma carona combinada ainda')).toBeInTheDocument();
    expect(screen.getByText(/0 ofertas?/)).toBeInTheDocument();
    expect(screen.getByText(/0 pedidos?/)).toBeInTheDocument();
  });

  it('lista caronas com tipo, vagas e rota', () => {
    renderWithProviders(
      <GameRidesPanel
        game={game}
        canUse
        ridesApi={makeRidesApi({ rides: [offerRide] })}
      />,
    );

    expect(screen.getByText('Motorista Parça')).toBeInTheDocument();
    expect(screen.getAllByText('Oferecer carona').length).toBeGreaterThan(0);
    expect(screen.getByText('3 vagas')).toBeInTheDocument();
    expect(
      screen.getByText('Estação Central → Arena Central'),
    ).toBeInTheDocument();
    expect(screen.getByText('Saio às 18h')).toBeInTheDocument();
  });

  it('mostra aviso e esconde o formulário quando o jogador não confirmou presença', () => {
    renderWithProviders(
      <GameRidesPanel game={game} canUse={false} ridesApi={makeRidesApi()} />,
    );

    expect(
      screen.getByText('Confirme presença no jogo para oferecer ou pedir carona.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Publicar carona/ }),
    ).not.toBeInTheDocument();
  });

  it('publica uma oferta de carona com origem preenchida', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <GameRidesPanel game={game} canUse ridesApi={makeRidesApi()} />,
    );

    const origin = screen.getByLabelText('Origem aproximada');
    await user.type(origin, 'Estação Central');
    await user.click(screen.getByRole('button', { name: 'Publicar carona' }));

    await waitFor(() =>
      expect(saveRide).toHaveBeenCalledWith({
        type: 'OFFER',
        originLabel: 'Estação Central',
        destinationLabel: 'Arena Central',
        seats: 1,
        note: '',
      }),
    );
  });

  it('exibe erro do listener com botão de tentar novamente', () => {
    renderWithProviders(
      <GameRidesPanel
        game={game}
        canUse
        ridesApi={makeRidesApi({ error: 'Erro ao carregar caronas' })}
      />,
    );

    expect(screen.getByText('Erro ao carregar caronas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('mostra botão de cancelar quando o usuário já publicou carona', () => {
    renderWithProviders(
      <GameRidesPanel
        game={game}
        canUse
        ridesApi={makeRidesApi({ currentUserRide: offerRide })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancelar carona' })).toBeInTheDocument();
  });
});
