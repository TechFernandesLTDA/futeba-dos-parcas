import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { ReleaseNoteContent } from './ReleaseNoteContent';
import { ReleaseNote } from '../../types/releaseNotes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'whatsNew.sectionAdded': 'Novidades',
      'whatsNew.sectionImproved': 'Melhorias',
      'whatsNew.sectionFixed': 'Correções',
    } as Record<string, string>)[key] ?? key,
  }),
}));

const baseNote: ReleaseNote = {
  platform: 'web',
  version: '1.56.0',
  buildNumber: null,
  releaseDate: 1750000000000,
  type: 'minor',
  headline: '**Carona mais discreta** por padrão',
  highlights: [
    { icon: 'star', title: 'Destaque', description: '**Painel** atrás de um ícone' },
  ],
  added: ['**Gestor confirma jogadores**: organizadores agora veem a lista'],
  improved: [],
  fixed: [],
  issueRefs: [],
  showPopup: true,
};

function renderNote(note: ReleaseNote, showHeadline = true) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <ReleaseNoteContent note={note} showHeadline={showHeadline} />
    </ThemeProvider>,
  );
}

describe('ReleaseNoteContent — Markdown lite (#3876)', () => {
  it('não exibe asteriscos literais no headline', () => {
    renderNote(baseNote);
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
    expect(screen.getByText('Carona mais discreta')).toBeInTheDocument();
  });

  it('não exibe asteriscos literais na descrição do highlight', () => {
    renderNote(baseNote);
    expect(screen.getByText('Painel')).toBeInTheDocument();
  });

  it('não exibe asteriscos literais nos itens de seção (Novidades/Melhorias/Correções)', () => {
    renderNote(baseNote);
    expect(screen.getByText('Gestor confirma jogadores')).toBeInTheDocument();
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it('renderiza texto sem marcação normalmente (sem regressão)', () => {
    const plainNote: ReleaseNote = {
      ...baseNote,
      headline: 'Texto simples sem marcação',
      highlights: [],
      added: ['Item simples'],
    };
    renderNote(plainNote);
    expect(screen.getByText('Texto simples sem marcação')).toBeInTheDocument();
    expect(screen.getByText('Item simples')).toBeInTheDocument();
  });
});
