import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  limit: vi.fn((...args) => args[0]),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));

// GamificationSettingsScreen requer role ADMIN para renderizar (guarda no componente). #2330
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'ADMIN' } }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../utils/firestoreHelpers', () => ({
  snakeToCamel: (obj: unknown) => obj,
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'settings.gamification.saveSuccess': 'Configurações salvas',
        'settings.saveError': 'Erro ao salvar',
        'settings.gamification.animationsSpeed': 'Velocidade',
        'common.back': 'Voltar',
        'xp': 'XP',
      };
      return map[key] || key;
    },
  }),
}));

mockGetDoc.mockResolvedValue({ exists: () => false });

import { GamificationSettingsScreen } from './GamificationSettingsScreen';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('GamificationSettingsScreen', () => {
  it('renderiza título da tela', () => {
    renderWithTheme(<GamificationSettingsScreen />);
    expect(screen.getByText('Gamificação')).toBeInTheDocument();
  });

  it('mostra switches de notificação de gamificação', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    renderWithTheme(<GamificationSettingsScreen />);

    const switches = await screen.findAllByRole('checkbox');
    expect(switches.length).toBeGreaterThan(0);
  });

  it('mostra botão salvar configurações', async () => {
    renderWithTheme(<GamificationSettingsScreen />);

    const salvar = await screen.findByText('Salvar Configurações');
    expect(salvar).toBeInTheDocument();
  });

  it('mostra valores de XP do sistema', async () => {
    renderWithTheme(<GamificationSettingsScreen />);

    expect(await screen.findByText(/Participação/)).toBeInTheDocument();
  });

  it('mostra botão de voltar', () => {
    renderWithTheme(<GamificationSettingsScreen />);
    expect(screen.getByLabelText('Voltar')).toBeInTheDocument();
  });

  it('exibe loading state inicial', () => {
    mockGetDoc.mockImplementation(() => new Promise(() => {}));
    renderWithTheme(<GamificationSettingsScreen />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
