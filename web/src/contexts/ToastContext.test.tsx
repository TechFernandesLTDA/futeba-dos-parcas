import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { ToastProvider, useToast } from './ToastContext';

const theme = createTheme();

// Componente auxiliar para disparar toasts
function ToastTrigger() {
  const { showToast, showSuccess, showError, showWarning, showInfo } = useToast();
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
});
