// @vitest-environment jsdom
import { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QrCheckInScreen } from './QrCheckInScreen';

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  checkInToGame: vi.fn(),
  showError: vi.fn(),
  goBack: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'game-ref'),
  getDoc: mocks.getDoc,
}));

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../services/cloudFunctions', () => ({ checkInToGame: mocks.checkInToGame }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'user-1' } }),
}));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showError: mocks.showError }),
}));
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('../../hooks/useNavigateBack', () => ({ useNavigateBack: () => mocks.goBack }));

const position: GeolocationPosition = {
  coords: {
    latitude: -23.55,
    longitude: -46.63,
    accuracy: 12,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({}),
  },
  timestamp: 1,
  toJSON: () => ({}),
};

function setGeolocation(getCurrentPosition: Geolocation['getCurrentPosition']) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });
}

function renderScreen(token = 'valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/checkin/game-1/${token}`]}>
      <Routes>
        <Route path="/checkin/:gameId/:token" element={<QrCheckInScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('QrCheckInScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        location_name: 'Arena dos Parças',
        checkin_qr_token: 'valid-token',
        status: 'LIVE',
      }),
    });
    mocks.checkInToGame.mockResolvedValue({ data: { success: true } });
    setGeolocation(((success) => success(position)) as Geolocation['getCurrentPosition']);
  });

  it('permite voltar à confirmação após falha de GPS sem chamar o backend', async () => {
    const user = userEvent.setup();
    setGeolocation(((_success, error) => {
      error?.({ message: 'Permissão de localização negada' } as GeolocationPositionError);
    }) as Geolocation['getCurrentPosition']);
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Confirmar Check-in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Permissão de localização negada');
    expect(mocks.showError).toHaveBeenCalledWith('Permissão de localização negada');
    expect(mocks.checkInToGame).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(screen.getByRole('button', { name: 'Confirmar Check-in' })).toBeEnabled();
    expect(screen.getByText('Arena dos Parças')).toBeVisible();
    expect(mocks.checkInToGame).not.toHaveBeenCalled();
  });

  it('reexecuta uma tentativa completa uma única vez após retry', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    setGeolocation(((success, error) => {
      attempts += 1;
      if (attempts === 1) {
        error?.({ message: 'GPS indisponível' } as GeolocationPositionError);
        return;
      }
      success(position);
    }) as Geolocation['getCurrentPosition']);
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Confirmar Check-in' }));
    await user.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar Check-in' }));

    expect(await screen.findByText('Check-in realizado com sucesso!')).toBeVisible();
    expect(mocks.checkInToGame).toHaveBeenCalledOnce();
    expect(mocks.checkInToGame).toHaveBeenCalledWith({
      gameId: 'game-1',
      qrToken: 'valid-token',
      lat: -23.55,
      lng: -46.63,
      accuracy: 12,
    });
  });

  it('não oferece retry quando o token falha na validação inicial', async () => {
    renderScreen('invalid-token');

    expect(await screen.findByRole('alert')).toHaveTextContent('Link de check-in inválido ou expirado');
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar ao início' })).toBeEnabled();
    expect(mocks.checkInToGame).not.toHaveBeenCalled();
  });

  it('bloqueia dois cliques concorrentes antes do próximo render', async () => {
    let resolvePosition: PositionCallback | undefined;
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      resolvePosition = success;
    });
    setGeolocation(getCurrentPosition as Geolocation['getCurrentPosition']);
    renderScreen();

    const confirmButton = await screen.findByRole('button', { name: 'Confirmar Check-in' });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(confirmButton).toBeDisabled();

    await act(async () => resolvePosition?.(position));
    await waitFor(() => expect(mocks.checkInToGame).toHaveBeenCalledOnce());
  });

  it('oferece retry quando a validação server-side rejeita a tentativa', async () => {
    const user = userEvent.setup();
    mocks.checkInToGame.mockRejectedValue(new Error('Fora do raio permitido'));
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Confirmar Check-in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Fora do raio permitido');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled();
    expect(mocks.checkInToGame).toHaveBeenCalledOnce();
  });
});
