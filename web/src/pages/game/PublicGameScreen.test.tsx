import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders } from '../../test/renderWithProviders';
import { PublicGameScreen } from './PublicGameScreen';
import {
  fetchPublicGame,
  formatPublicGameDate,
  publicGameEndpoint,
  type PublicGame,
} from '../../services/publicGameService';

const GAME: PublicGame = {
  id: 'game-123',
  status: 'SCHEDULED',
  joinMode: 'OPEN',
  date: '2026-11-07',
  time: '19:00',
  endTime: '20:30',
  locationName: 'Arena Parças',
  groupName: 'Pelada de Sábado',
  maxPlayers: 14,
  playersCount: 9,
  spotsLeft: 5,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function LocationProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '';
  return <div data-testid="probe">{`${location.pathname}|${from}`}</div>;
}

function renderScreen() {
  return renderWithProviders(
    <Routes>
      <Route path="/game/:gameId" element={<PublicGameScreen />} />
      <Route path="/login" element={<LocationProbe />} />
      <Route path="/register" element={<LocationProbe />} />
    </Routes>,
    { initialEntries: ['/game/game-123'] },
  );
}

describe('PublicGameScreen (#4408)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loading: mostra skeleton acessível enquanto busca', async () => {
    let resolve: (r: Response) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolve = r; }));
    renderScreen();
    expect(screen.getByLabelText('Carregando jogo')).toHaveAttribute('aria-busy', 'true');
    resolve(jsonResponse(200, { game: GAME }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pelada de Sábado' })).toBeInTheDocument();
  });

  it('success: mostra data, horário, local, grupo e vagas, sem dados de jogadores', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { game: GAME }));
    renderScreen();

    expect(await screen.findByRole('heading', { level: 1, name: 'Pelada de Sábado' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/public-game/game-123', expect.objectContaining({ credentials: 'omit' }));
    expect(screen.getByText(/Sábado, 7 de novembro · 19:00 às 20:30/)).toBeInTheDocument();
    expect(screen.getByText('Arena Parças')).toBeInTheDocument();
    expect(screen.getByText('9 de 14 confirmados · 5 vagas abertas')).toBeInTheDocument();
    expect(screen.getByText('Agendado')).toBeInTheDocument();
    expect(screen.getByText('Aberto para novos jogadores')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar para confirmar presença' })).toBeInTheDocument();
  });

  it('CTA leva ao login preservando o retorno para o jogo', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { game: GAME }));
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar para confirmar presença' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('/login|/game/game-123');
  });

  it('CTA de cadastro também preserva o retorno', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { game: GAME }));
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Criar conta grátis' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('/register|/game/game-123');
  });

  it('jogo encerrado não convida a confirmar presença', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { game: { ...GAME, status: 'FINISHED' } }));
    renderScreen();
    expect(await screen.findByText('Encerrado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrar para confirmar presença' })).not.toBeInTheDocument();
    expect(screen.getByText(/não recebe mais confirmações/)).toBeInTheDocument();
  });

  it('jogo cancelado não mostra modo de entrada nem vagas abertas (#4492)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      game: { ...GAME, status: 'CANCELLED', joinMode: 'OPEN', playersCount: 1, spotsLeft: 13 },
    }));
    renderScreen();
    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
    expect(screen.queryByText('Aberto para novos jogadores')).not.toBeInTheDocument();
    expect(screen.queryByText(/vagas? abertas?/)).not.toBeInTheDocument();
    expect(screen.getByText('1 de 14 confirmados')).toBeInTheDocument();
  });

  it('lista cheia e sem limite de vagas', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { game: { ...GAME, playersCount: 14, spotsLeft: 0 } }));
    const { unmount } = renderScreen();
    expect(await screen.findByText('14 de 14 confirmados · Lista cheia')).toBeInTheDocument();
    unmount();

    fetchMock.mockResolvedValue(jsonResponse(200, {
      game: { ...GAME, maxPlayers: null, spotsLeft: null, playersCount: 1, groupName: null },
    }));
    renderScreen();
    expect(await screen.findByText('1 confirmado')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Pelada' })).toBeInTheDocument();
  });

  it('empty: jogo privado/inexistente (404) mostra estado indisponível com CTA', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: 'not_found' }));
    renderScreen();
    expect(await screen.findByText('Jogo indisponível')).toBeInTheDocument();
    expect(screen.getByText(/privado ou não existe mais/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('/login|/game/game-123');
  });

  it('error: falha do servidor mostra erro e o retry busca de novo', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, { error: 'unavailable' }));
    renderScreen();
    expect(await screen.findByText('Não foi possível carregar o jogo.')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { game: GAME }));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pelada de Sábado' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renderiza texto vindo da API como texto, nunca como HTML', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      game: { ...GAME, groupName: '<img src=x onerror=alert(1)>' },
    }));
    const { container } = renderScreen();
    expect(await screen.findByRole('heading', { level: 1, name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it('compartilhar usa a Web Share API com o link canônico do jogo', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share });
    fetchMock.mockResolvedValue(jsonResponse(200, { game: GAME }));
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Compartilhar' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://futebadosparcas.com.br/game/game-123',
    })));
  });
});

describe('publicGameService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('codifica o id no endpoint', () => {
    expect(publicGameEndpoint('a/b')).toBe('/api/public-game/a%2Fb');
  });

  it('404 vira null e resposta não-JSON vira erro', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(404, { error: 'not_found' }))
      .mockResolvedValueOnce(new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchPublicGame('g')).resolves.toBeNull();
    await expect(fetchPublicGame('g')).rejects.toThrow('HTTP 200');
  });
});

describe('formatPublicGameDate', () => {
  it('formata a data local sem deslocar o dia por fuso', () => {
    expect(formatPublicGameDate('2026-11-07', 'pt-BR')).toBe('Sábado, 7 de novembro');
    expect(formatPublicGameDate(null, 'pt-BR')).toBeNull();
    expect(formatPublicGameDate('07/11/2026', 'pt-BR')).toBeNull();
  });
});
