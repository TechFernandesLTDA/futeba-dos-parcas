import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { WelcomeScreen } from './WelcomeScreen';

// NÃO mockar react-i18next aqui: o setup global já inicializa i18n com pt-BR real.
// Mock local que retornava a chave (ex: 'auth.createAccountTitle') fazia os testes
// falharem porque as asserções esperam o texto traduzido. #2330

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

const theme = createTheme();

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}

describe('WelcomeScreen', () => {
  it('renderiza o nome do app', () => {
    renderWithProviders(<WelcomeScreen />);
    expect(screen.getByText('Futeba dos Parças')).toBeInTheDocument();
  });

  it('renderiza botão Criar Conta', () => {
    renderWithProviders(<WelcomeScreen />);
    expect(screen.getByText('Criar Conta')).toBeInTheDocument();
  });

  it('renderiza botão Já tenho conta', () => {
    renderWithProviders(<WelcomeScreen />);
    expect(screen.getByText('Já tenho conta')).toBeInTheDocument();
  });

  it('renderiza descrição do app', () => {
    renderWithProviders(<WelcomeScreen />);
    expect(screen.getByText(/Organize suas peladas/)).toBeInTheDocument();
  });

  it('renderiza termos de uso como link', () => {
    renderWithProviders(<WelcomeScreen />);
    expect(screen.getByText('Termos de Uso')).toBeInTheDocument();
  });

  it('renderiza política de privacidade como link', () => {
    renderWithProviders(<WelcomeScreen />);
    expect(screen.getByText('Política de Privacidade')).toBeInTheDocument();
  });

  it('Criar Conta é um link para /register', () => {
    renderWithProviders(<WelcomeScreen />);
    const btn = screen.getByText('Criar Conta');
    expect(btn.closest('a')).toBeNull();
    expect(btn).toBeInTheDocument();
  });

  it('Já tenho conta é link para /login', () => {
    renderWithProviders(<WelcomeScreen />);
    const btn = screen.getByText('Já tenho conta');
    expect(btn).toBeInTheDocument();
  });

  it('renderiza ícone do soccer', () => {
    renderWithProviders(<WelcomeScreen />);
    const icon = document.querySelector('[data-testid="SportsSoccerIcon"]');
    expect(icon).toBeInTheDocument();
  });

  it('não crasha ao renderizar', () => {
    expect(() => renderWithProviders(<WelcomeScreen />)).not.toThrow();
  });
});
