import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));

vi.mock('../../utils/firestoreHelpers', () => ({
  snakeToCamel: (obj: unknown) => obj,
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../types/gamification', () => ({
  getLevelForXp: () => 1,
}));

vi.mock('../../utils/dateFormatters', () => ({
  formatGameDate: () => 'Hoje',
}));

vi.mock('../../contexts', () => ({
  useToast: () => ({ showError: vi.fn() }),
}));

vi.mock('../common/GameCard', () => ({
  LoadingState: () => <div data-testid="loading-state">Carregando...</div>,
}));

import { CommandPalette } from './CommandPalette';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('CommandPalette', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza dialog quando aberto', () => {
    renderWithTheme(
      <CommandPalette open={true} onOpen={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.getByText('Busca global')).toBeInTheDocument();
  });

  it('não renderiza conteúdo quando fechado', () => {
    renderWithTheme(
      <CommandPalette open={false} onOpen={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.queryByText('Busca global')).not.toBeInTheDocument();
  });

  it('mostra Esc como dica de teclado', () => {
    renderWithTheme(
      <CommandPalette open={true} onOpen={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('tem botão fechar', () => {
    renderWithTheme(
      <CommandPalette open={true} onOpen={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.getByLabelText('Fechar busca')).toBeInTheDocument();
  });

  it('chama onClose ao clicar no botão fechar', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithTheme(
      <CommandPalette open={true} onOpen={vi.fn()} onClose={onClose} />
    );

    await user.click(screen.getByLabelText('Fechar busca'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('chama onClose ao pressionar Escape (MUI nativo)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithTheme(
      <CommandPalette open={true} onOpen={vi.fn()} onClose={onClose} />
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('chama onOpen quando Cmd+K é pressionado', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderWithTheme(
      <CommandPalette open={false} onOpen={onOpen} onClose={vi.fn()} />
    );

    await user.keyboard('{Meta>}k{/Meta}');

    expect(onOpen).toHaveBeenCalled();
  });

  it('renderiza SearchPanel interno quando aberto', () => {
    renderWithTheme(
      <CommandPalette open={true} onOpen={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.getByText('Criar jogo')).toBeInTheDocument();
  });
});
