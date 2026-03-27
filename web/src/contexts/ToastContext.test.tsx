import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { ToastProvider, useToast } from './ToastContext';

const theme = createTheme();

const mockActionClick = vi.fn();

// Componente auxiliar para disparar toasts
function ToastTrigger() {
  const { showToast, showSuccess, showError, showWarning, showInfo, dismissToast, showWithAction } = useToast();
  return (
    <div>
      <button onClick={() => showSuccess('Sucesso!')}>success</button>
      <button onClick={() => showError('Erro!')}>error</button>
      <button onClick={() => showWarning('Atenção!')}>warning</button>
      <button onClick={() => showInfo('Informação!')}>info</button>
      <button onClick={() => showToast('Toast genérico', 'success')}>generic</button>
      <button onClick={() => {
        showSuccess('Toast 1');
        showError('Toast 2');
      }}>multiple</button>
      <button onClick={() => showWithAction('Ação disponível', { label: 'Desfazer', onClick: mockActionClick }, 'info')}>with-action</button>
      <button onClick={() => showToast('Toast curto', 'info', 500)}>short-duration</button>
      <button onClick={() => {
        showSuccess('Queue 1');
        showWarning('Queue 2');
        showError('Queue 3');
      }}>queue-three</button>
    </div>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <ToastProvider>
        {ui}
      </ToastProvider>
    </ThemeProvider>
  );
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('showSuccess exibe mensagem de sucesso', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('success'));
    expect(await screen.findByText('Sucesso!')).toBeInTheDocument();
  });

  it('showError exibe mensagem de erro', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('error'));
    expect(await screen.findByText('Erro!')).toBeInTheDocument();
  });

  it('showWarning exibe mensagem de aviso', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('warning'));
    expect(await screen.findByText('Atenção!')).toBeInTheDocument();
  });

  it('showInfo exibe mensagem informativa', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('info'));
    expect(await screen.findByText('Informação!')).toBeInTheDocument();
  });

  it('showToast exibe toast com severity customizada', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('generic'));
    expect(await screen.findByText('Toast genérico')).toBeInTheDocument();
  });

  it('múltiplos toasts podem ser exibidos simultaneamente', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('multiple'));
    expect(await screen.findByText('Toast 1')).toBeInTheDocument();
    expect(await screen.findByText('Toast 2')).toBeInTheDocument();
  });

  it('contexto é acessível nos componentes filhos', () => {
    renderWithProviders(<ToastTrigger />);

    // Verifica que os botões renderizam (contexto acessível)
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('useToast lança erro quando usado fora do ToastProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <ThemeProvider theme={theme}>
          <ToastTrigger />
        </ThemeProvider>
      );
    }).toThrow('useToast must be used within a ToastProvider');

    consoleSpy.mockRestore();
  });

  it('dismissToast remove o toast ao clicar no botão fechar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('success'));
    expect(await screen.findByText('Sucesso!')).toBeInTheDocument();

    // Clicar no botão fechar do Alert (ícone de fechar)
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[closeButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('Sucesso!')).not.toBeInTheDocument();
    });
  });

  it('showWithAction exibe toast com botão de ação', async () => {
    const user = userEvent.setup();
    mockActionClick.mockClear();
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('with-action'));
    expect(await screen.findByText('Ação disponível')).toBeInTheDocument();
    expect(screen.getByText('Desfazer')).toBeInTheDocument();
  });

  it('showWithAction executa callback ao clicar na ação', async () => {
    const user = userEvent.setup();
    mockActionClick.mockClear();
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('with-action'));
    await screen.findByText('Ação disponível');

    await user.click(screen.getByText('Desfazer'));

    expect(mockActionClick).toHaveBeenCalledTimes(1);

    // Após clicar na ação, o toast deve ser removido
    await waitFor(() => {
      expect(screen.queryByText('Ação disponível')).not.toBeInTheDocument();
    });
  });

  it('toast com autoHideDuration é removido automaticamente', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('short-duration'));
    expect(await screen.findByText('Toast curto')).toBeInTheDocument();

    // Avançar o tempo além da duração (500ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.queryByText('Toast curto')).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('múltiplos toasts são enfileirados e exibidos simultaneamente', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('queue-three'));

    expect(await screen.findByText('Queue 1')).toBeInTheDocument();
    expect(await screen.findByText('Queue 2')).toBeInTheDocument();
    expect(await screen.findByText('Queue 3')).toBeInTheDocument();
  });

  it('toast pode ser fechado via botão close', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTrigger />);

    await user.click(screen.getByText('success'));
    expect(await screen.findByText('Sucesso!')).toBeInTheDocument();

    // Fechar o toast via botão close
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Sucesso!')).not.toBeInTheDocument();
    });
  });
});
