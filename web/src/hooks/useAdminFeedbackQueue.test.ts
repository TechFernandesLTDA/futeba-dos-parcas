import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminFeedbackQueue } from './useAdminFeedbackQueue';
import { useAuth } from '../contexts/AuthContext';

const mockOnSnapshot = vi.fn();
const mockUpdateDoc = vi.fn();
const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();

vi.mock('../services/firebase', () => ({
  db: { app: 'test-db' },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
  }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args) => ({ kind: 'collection', args })),
  doc: vi.fn((...args) => ({ kind: 'doc', args })),
  limit: vi.fn((value) => ({ kind: 'limit', value })),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  orderBy: vi.fn((field, direction) => ({ kind: 'orderBy', field, direction })),
  query: vi.fn((...args) => ({ kind: 'query', args })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
}));

function mockAdminUser() {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'admin-1', role: 'ADMIN' },
  } as ReturnType<typeof useAuth>);
}

describe('useAdminFeedbackQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminUser();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('loads admin feedbacks and normalizes legacy statuses', async () => {
    mockOnSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        docs: [
          {
            id: 'feedback-1',
            data: () => ({
              user_id: 'user-1',
              user_email: 'u@test.com',
              type: 'bug',
              title: 'Erro no login',
              description: 'Falha ao entrar',
              severity: 'critical',
              status: 'resolved',
              github_issue_number: 3304,
              created_at: { toDate: () => new Date('2026-07-01T12:00:00.000Z') },
              context: { platform: 'web', route: '/login' },
            }),
          },
        ],
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useAdminFeedbackQueue());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.feedbacks).toHaveLength(1);
    expect(result.current.feedbacks[0]).toMatchObject({
      id: 'feedback-1',
      status: 'released',
      legacyStatus: 'resolved',
      githubIssueNumber: 3304,
    });
    expect(result.current.summary).toMatchObject({
      total: 1,
      critical: 1,
      released: 1,
    });
  });

  it('updates feedback triage fields with server timestamps', async () => {
    mockOnSnapshot.mockImplementation((_query, onNext) => {
      onNext({ docs: [] });
      return vi.fn();
    });

    const { result } = renderHook(() => useAdminFeedbackQueue());

    await act(async () => {
      await result.current.updateFeedback('feedback-1', {
        status: 'issue_created',
        assignee: 'Renan',
        githubIssueNumber: 3315,
        githubIssueUrl: 'https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/3315',
        githubPrNumber: null,
        githubPrUrl: '',
        releaseVersion: '',
        releaseUrl: '',
        suspectedDuplicateOf: 'feedback-0',
        adminNotes: 'Criar issue de acompanhamento.',
      });
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'doc' }),
      expect.objectContaining({
        status: 'issue_created',
        updated_at: 'SERVER_TIMESTAMP',
        triaged_at: 'SERVER_TIMESTAMP',
        assignee: 'Renan',
        github_issue_number: 3315,
        github_issue_url: 'https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/3315',
        github_pr_number: null,
        suspected_duplicate_of: 'feedback-0',
        admin_notes: 'Criar issue de acompanhamento.',
      }),
    );
    expect(mockShowSuccess).toHaveBeenCalledWith('Feedback atualizado.');
  });
});
