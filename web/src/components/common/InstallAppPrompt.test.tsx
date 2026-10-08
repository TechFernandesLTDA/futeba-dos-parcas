/**
 * #4189 — o convite de instalação PWA é um banner inline: não pode virar um
 * overlay modal nem esconder o <main> de leitores de tela.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';

const pwa = {
  canPrompt: false,
  dismiss: vi.fn(),
  install: vi.fn(),
  platform: 'android' as const,
  shouldShow: true,
};

vi.mock('../../hooks/usePwaInstall', () => ({ usePwaInstall: () => pwa }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'pwa.installTitle': 'Usar como app',
      'pwa.installAction': 'Instalar',
      'pwa.androidInstallHint': 'Toque em Instalar app',
      'a11y.close': 'Fechar',
    } as Record<string, string>)[key] ?? key,
  }),
}));

import { InstallAppPrompt } from './InstallAppPrompt';

function renderPrompt() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <main data-testid="page-main">
        <h1>Página</h1>
        <InstallAppPrompt />
      </main>
    </ThemeProvider>,
  );
}

describe('InstallAppPrompt — acessibilidade (#4189)', () => {
  beforeEach(() => {
    pwa.canPrompt = false;
    pwa.shouldShow = true;
    pwa.dismiss.mockClear();
    pwa.install.mockClear();
  });

  it('é inline: não usa role=dialog/aria-modal e não esconde o <main>', () => {
    renderPrompt();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('[aria-modal]')).toBeNull();
    expect(screen.getByTestId('page-main')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Página' })).toBeInTheDocument();
    expect(Array.from(document.body.children).some((el) => el.getAttribute('aria-hidden') === 'true')).toBe(false);
    expect(screen.getByText('Toque em Instalar app')).toBeInTheDocument();
  });

  it('dispensa pelo botão Fechar e instala quando o navegador permite', () => {
    pwa.canPrompt = true;
    renderPrompt();

    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(pwa.install).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(pwa.dismiss).toHaveBeenCalledTimes(1);
  });

  it('não renderiza quando shouldShow é falso', () => {
    pwa.shouldShow = false;
    renderPrompt();

    expect(screen.queryByText('Usar como app')).not.toBeInTheDocument();
  });
});
