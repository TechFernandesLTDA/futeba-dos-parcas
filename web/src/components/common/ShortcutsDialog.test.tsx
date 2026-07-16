import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { ShortcutsDialog } from './ShortcutsDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'shortcuts.title': 'Atalhos de teclado',
      'shortcuts.tip': 'Dica',
      'shortcuts.colShortcut': 'Atalho',
      'shortcuts.colAction': 'Ação',
      'shortcuts.globalSearch': 'Busca global',
      'shortcuts.createGame': 'Criar jogo',
      'shortcuts.createGroup': 'Criar grupo',
      'shortcuts.settings': 'Configurações',
      'shortcuts.showShortcuts': 'Mostrar atalhos',
      'shortcuts.closeOrBack': 'Fechar ou voltar',
      'common.close': 'Fechar',
      'a11y.close': 'Fechar diálogo',
    } as Record<string, string>)[key] ?? key,
  }),
}));

describe('ShortcutsDialog', () => {
  it('expõe cabeçalhos de coluna para a tabela de atalhos', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <ShortcutsDialog open onClose={vi.fn()} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('columnheader', { name: 'Atalho' })).toHaveAttribute('scope', 'col');
    expect(screen.getByRole('columnheader', { name: 'Ação' })).toHaveAttribute('scope', 'col');
    expect(screen.getAllByRole('row')).toHaveLength(7);
  });
});
