import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { ErrorBoundary } from './ErrorBoundary';

vi.mock('../../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
  messagingPromise: Promise.resolve(null),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const theme = createTheme();

// Componente que lança erro
function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Erro de teste');
  }
  return <div>Conteúdo OK</div>;
}

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Suprimir erro esperado no console durante testes de ErrorBoundary
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renderiza filhos quando não há erro', () => {
    renderWithTheme(
      <ErrorBoundary>
        <div>Conteúdo filho</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Conteúdo filho')).toBeInTheDocument();
  });

  it('captura erros de renderização', () => {
    renderWithTheme(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Deve exibir UI de erro em vez do componente quebrado
    expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
  });

  it('exibe UI de erro com mensagem e botões', () => {
    renderWithTheme(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
    expect(screen.getByText(/Ocorreu um erro inesperado/)).toBeInTheDocument();
    expect(screen.getByText('Recarregar')).toBeInTheDocument();
    expect(screen.getByText('Ir para Início')).toBeInTheDocument();
  });

  it('botão Recarregar chama window.location.reload', async () => {
    const user = userEvent.setup();
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    renderWithTheme(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    await user.click(screen.getByText('Recarregar'));
    expect(reloadMock).toHaveBeenCalled();
  });

  it('possui role="alert" no container de erro', () => {
    renderWithTheme(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renderiza fallback customizado quando fornecido', () => {
    const customFallback = <div>Fallback customizado</div>;

    renderWithTheme(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Fallback customizado')).toBeInTheDocument();
    expect(screen.queryByText('Ops! Algo deu errado')).not.toBeInTheDocument();
  });
});
