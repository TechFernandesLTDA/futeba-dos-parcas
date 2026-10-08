// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../../test/renderWithProviders';
import type { Game } from '../../types/game';
import { GameInfoPanel } from './GameInfoPanel';

const paidGame = {
  id: 'game-1',
  status: 'CONFIRMED',
  gameType: 'Pelada semanal',
  date: '2026-11-15',
  time: '19:00',
  endTime: '20:00',
  locationName: 'Arena Central',
  locationAddress: 'Rua das Bolas, 123',
  locationLat: -23.55,
  locationLng: -46.63,
  pixKey: 'pix@parcas.com',
  playersCount: 10,
  maxPlayers: 14,
  goalkeepersCount: 2,
  maxGoalkeepers: 2,
  totalCost: 210,
  dailyPrice: 0,
  priceManualOverride: false,
} as Game;

describe('GameInfoPanel', () => {
  it('renderiza local, endereço e contagem de jogadores', () => {
    renderWithProviders(<GameInfoPanel game={paidGame} />);

    expect(screen.getByText('Arena Central')).toBeInTheDocument();
    expect(screen.getByText('Rua das Bolas, 123')).toBeInTheDocument();
    expect(screen.getByText('Jogadores')).toBeInTheDocument();
    expect(screen.getByText('10/14')).toBeInTheDocument();
    expect(screen.getByText('Goleiros: 2/2')).toBeInTheDocument();
    expect(screen.getByText('Pelada semanal')).toBeInTheDocument();
  });

  it('exibe o valor por jogador e a chave Pix quando há custo', () => {
    renderWithProviders(<GameInfoPanel game={paidGame} />);

    // resolveExpectedPayment: totalCost 210 / 14 jogadores = R$ 15,00
    expect(screen.getByText('R$ 15.00 por jogador')).toBeInTheDocument();
    expect(screen.getByText(/Pix: pix@parcas\.com/)).toBeInTheDocument();
  });

  it('abre o Google Maps ao clicar em "Navegar"', async () => {
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => null);
    const user = userEvent.setup();
    renderWithProviders(<GameInfoPanel game={paidGame} />);

    await user.click(screen.getByRole('button', { name: 'Navegar' }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(url).toContain('google.com/maps/dir/');
    expect(url).toContain('destination=-23.55,-46.63');
    expect(target).toBe('_blank');
    expect(features).toContain('noopener');
    openSpy.mockRestore();
  });

  it('não exibe pagamento nem botão de navegação quando o jogo é gratuito e sem coordenadas', () => {
    const freeGame = {
      ...paidGame,
      totalCost: 0,
      dailyPrice: 0,
      pixKey: '',
      locationLat: undefined,
      locationLng: undefined,
    } as Game;
    renderWithProviders(<GameInfoPanel game={freeGame} />);

    expect(screen.queryByText(/por jogador/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Navegar' })).not.toBeInTheDocument();
  });
});
