/**
 * #4189 — regressão de acessibilidade: o pop-up "Novidades" abre sozinho e não
 * pode esconder a página (`<main>`) de leitores de tela (aria-hidden), como
 * fazia o Dialog modal do MUI.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { WhatsNewDialog } from './WhatsNewDialog';
import type { ReleaseNote } from '../../types/releaseNotes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'whatsNew.popupDismiss': 'Entendi',
      'common.close': 'Fechar',
      'whatsNew.popupEyebrow': 'Novidades da versão',
    } as Record<string, string>)[key] ?? key,
  }),
}));

vi.mock('../../utils/analytics', () => ({ trackEvent: vi.fn() }));

const note: ReleaseNote = {
  platform: 'web',
  version: '1.57.0',
  buildNumber: null,
  releaseDate: 1750000000000,
  type: 'minor',
  headline: 'Grupos mais rápidos',
  highlights: [],
  added: ['Fila de espera visível'],
  improved: [],
  fixed: [],
  issueRefs: [],
  showPopup: true,
};

function renderWithMain(props: { open: boolean; onClose?: () => void; note?: ReleaseNote }) {
  const onClose = props.onClose ?? vi.fn();
  const utils = render(
    <ThemeProvider theme={createTheme()}>
      <main data-testid="page-main">
        <h1>Conteúdo da página</h1>
      </main>
      <WhatsNewDialog note={props.note ?? note} open={props.open} onClose={onClose} />
    </ThemeProvider>,
  );
  return { ...utils, onClose };
}

describe('WhatsNewDialog — não-modal (#4189)', () => {
  it('não marca <main> nem o container com aria-hidden quando abre', () => {
    const { container } = renderWithMain({ open: true });

    const main = screen.getByTestId('page-main');
    expect(main).not.toHaveAttribute('aria-hidden');
    expect(container).not.toHaveAttribute('aria-hidden');
    // A página continua exposta na árvore de acessibilidade.
    expect(screen.getByRole('heading', { level: 1, name: 'Conteúdo da página' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBe(main);
    // Nenhum irmão do body ficou escondido.
    const hidden = Array.from(document.body.children).filter((el) => el.getAttribute('aria-hidden') === 'true');
    expect(hidden).toEqual([]);
  });

  it('expõe um painel role=dialog não-modal nomeado pelo headline', () => {
    renderWithMain({ open: true });

    const dialog = screen.getByRole('dialog', { name: 'Grupos mais rápidos' });
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(dialog).toHaveFocus();
  });

  it('sem headline, é nomeado pelo eyebrow da versão', () => {
    renderWithMain({ open: true, note: { ...note, headline: '' } });

    expect(screen.getByRole('dialog', { name: /Novidades da versão/ })).toBeInTheDocument();
  });

  it('fecha pelo botão Entendi, pelo X e por Esc', () => {
    const onClose = vi.fn();
    renderWithMain({ open: true, onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('não renderiza nada quando fechado e remove o listener de Esc', () => {
    const onClose = vi.fn();
    const { rerender } = renderWithMain({ open: true, onClose });
    rerender(
      <ThemeProvider theme={createTheme()}>
        <main />
        <WhatsNewDialog note={note} open={false} onClose={onClose} />
      </ThemeProvider>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
