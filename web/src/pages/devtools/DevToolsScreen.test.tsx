import React from 'react';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../test/renderWithProviders';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('../../hooks/useNavigateBack', () => ({
  useNavigateBack: () => vi.fn(),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../utils/errorLogger', () => ({
  logError: vi.fn(async () => 'err-1'),
}));

vi.mock('../../utils/errorFeedbackReporter', () => ({
  submitErrorFeedbackReport: vi.fn(async () => ({ ok: true })),
}));

import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { DevToolsScreen } from './DevToolsScreen';
import { clearDeveloperCache } from './devToolsCache';

describe('DevToolsScreen', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserva auth, fila offline e drafts ao limpar cache em produção', () => {
    const local = window.localStorage;
    const session = window.sessionStorage;

    local.clear();
    session.clear();

    local.setItem('firebase:authUser:test', 'auth');
    local.setItem('offline_write_queue', 'queue');
    local.setItem('offline_queue_enc_key', 'enc');
    local.setItem('draft:test-form', 'draft');
    local.setItem('game_draft_create_game', 'game-draft');
    local.setItem('transient', 'remove-me');
    session.setItem('firebase:redirect:test', 'auth-session');
    session.setItem('transient-session', 'remove-me');

    clearDeveloperCache('production', local, session);

    expect(local.getItem('firebase:authUser:test')).toBe('auth');
    expect(local.getItem('offline_write_queue')).toBe('queue');
    expect(local.getItem('offline_queue_enc_key')).toBe('enc');
    expect(local.getItem('draft:test-form')).toBe('draft');
    expect(local.getItem('game_draft_create_game')).toBe('game-draft');
    expect(local.getItem('transient')).toBeNull();
    expect(session.getItem('firebase:redirect:test')).toBe('auth-session');
    expect(session.getItem('transient-session')).toBeNull();
  });

  it('simula erro disparando o error boundary global', async () => {
    renderWithProviders(
      <ErrorBoundary>
        <DevToolsScreen />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Simular Erro'));

    await waitFor(() => {
      expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
    });
  });
});
