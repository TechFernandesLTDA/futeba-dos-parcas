import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DeleteAccountBlockedGroupsDialog } from './DeleteAccountBlockedGroupsDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number; name?: string }) =>
      opts?.count !== undefined ? `${key}:${opts.count}` : opts?.name ? `${key}:${opts.name}` : key,
  }),
}));

describe('DeleteAccountBlockedGroupsDialog', () => {
  it('lista cada grupo com link para o detalhe e passa a contagem ao plural', () => {
    render(
      <MemoryRouter>
        <DeleteAccountBlockedGroupsDialog
          open
          groups={[
            { id: 'g1', name: 'Pelada de Quarta' },
            { id: 'g2', name: 'Racha do Sábado' },
          ]}
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('settings.deleteBlockedTitle:2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'settings.deleteBlockedGroupAria:Pelada de Quarta' })).toHaveAttribute('href', '/group/g1');
    expect(screen.getByRole('link', { name: 'settings.deleteBlockedGroupAria:Racha do Sábado' })).toHaveAttribute('href', '/group/g2');
  });

  it('fecha pelo botão', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <DeleteAccountBlockedGroupsDialog open groups={[{ id: 'g1', name: 'A' }]} onClose={onClose} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
