import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ProfileGate } from './ProfileGate';
import { useAuth } from '../../contexts/AuthContext';
import { useProfileComplete } from '../../hooks/useProfileComplete';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useProfileComplete', () => ({
  useProfileComplete: vi.fn(),
}));

const theme = createTheme();

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderGate(initialPath = '/') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationProbe />
        <ProfileGate>
          <div>Conteúdo protegido</div>
        </ProfileGate>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('ProfileGate', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'user-1', phoneNumber: '+5548999999999' },
    } as ReturnType<typeof useAuth>);

    vi.mocked(useProfileComplete).mockReturnValue({
      profileComplete: false,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  it('leva usuário verificado com perfil incompleto para setup de perfil, não CPF', async () => {
    const user = userEvent.setup();
    renderGate('/');

    expect(screen.getByText('Complete seu Perfil')).toBeInTheDocument();
    expect(screen.getByText(/Conta verificada/)).toBeInTheDocument();
    expect(screen.queryByText(/CPF e telefone/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Completar Perfil' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/profile/setup');
  });

  it('não bloqueia a própria rota de setup de perfil', () => {
    renderGate('/profile/setup');

    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
