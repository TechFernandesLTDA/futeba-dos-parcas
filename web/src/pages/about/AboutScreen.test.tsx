import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'user@test.com' } }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../components/feedback/FeedbackDialog', () => ({
  FeedbackDialog: () => null,
}));

import { AboutScreen } from './AboutScreen';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('AboutScreen', () => {
  it('renderiza nome do app', () => {
    renderWithTheme(<AboutScreen />);
    expect(screen.getByText('Futeba dos Parças')).toBeInTheDocument();
  });

  it('renderiza descrição do app', () => {
    renderWithTheme(<AboutScreen />);
    expect(screen.getByText('Organize suas peladas com os amigos')).toBeInTheDocument();
  });

  it('mostra versão e build', () => {
    renderWithTheme(<AboutScreen />);
    expect(screen.getByText('Sobre')).toBeInTheDocument();
  });

  it('renderiza link de Termos de Uso', () => {
    renderWithTheme(<AboutScreen />);
    expect(screen.getByText('Termos de Uso')).toBeInTheDocument();
  });

  it('renderiza link de Política de Privacidade', () => {
    renderWithTheme(<AboutScreen />);
    expect(screen.getByText('Política de Privacidade')).toBeInTheDocument();
  });

  it('renderiza link de Segurança Infantil', () => {
    renderWithTheme(<AboutScreen />);
    expect(screen.getByText('Segurança Infantil')).toBeInTheDocument();
  });

  it('renderiza Excluir Conta', () => {
    renderWithTheme(<AboutScreen />);
    expect(screen.getByText('Excluir Conta')).toBeInTheDocument();
  });

  it('renderiza botão de voltar', () => {
    renderWithTheme(<AboutScreen />);
    expect(screen.getByLabelText('Voltar')).toBeInTheDocument();
  });
});
