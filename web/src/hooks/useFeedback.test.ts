import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const mockAddDoc = vi.fn();
const mockCollection = vi.fn();
const mockLimit = vi.fn((...args: unknown[]) => args[0]);
const mockOnSnapshot = vi.fn();
const mockOrderBy = vi.fn();
const mockQuery = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _seconds: 0 }));
const mockWhere = vi.fn();
const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  serverTimestamp: () => mockServerTimestamp(),
  where: (...args: unknown[]) => mockWhere(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: {
      uid: 'user-1',
      email: 'user-1@example.com',
    },
  }),
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

import { useFeedback } from './useFeedback';

describe('useFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue('feedback-collection');
    mockWhere.mockReturnValue('where');
    mockOrderBy.mockReturnValue('orderBy');
    mockQuery.mockReturnValue('feedback-query');
    mockOnSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        docs: [],
      });
      return vi.fn();
    });
    mockAddDoc.mockResolvedValue({ id: 'feedback-1' });
  });

  it('rejeita feedback só com espaços em branco', async () => {
    const { result } = renderHook(() => useFeedback(), { wrapper: createTestWrapper() });

    await act(async () => {
      const feedbackId = await result.current.submitFeedback({
        type: 'bug',
        title: '   ',
        description: '\n\t',
        severity: 'medium',
        context: {},
      });
      expect(feedbackId).toBeNull();
    });

    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(mockShowError).toHaveBeenCalledWith('Preencha título e descrição com conteúdo válido.');
  });

  it('bloqueia feedback duplicado recente', async () => {
    const now = new Date(Date.now() - (2 * 60 * 1000));
    mockOnSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        docs: [{
          id: 'existing-feedback',
          data: () => ({
            type: 'bug',
            title: 'Falha no upload',
            description: 'Mesmo erro ao anexar foto',
            created_at: { toDate: () => now },
            updated_at: { toDate: () => now },
          }),
        }],
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useFeedback(), { wrapper: createTestWrapper() });

    await act(async () => {
      const feedbackId = await result.current.submitFeedback({
        type: 'bug',
        title: '  Falha   no upload ',
        description: 'Mesmo erro ao anexar foto',
        severity: 'medium',
        context: {},
      });
      expect(feedbackId).toBeNull();
    });

    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(mockShowError).toHaveBeenCalledWith('Você já enviou um feedback igual recentemente.');
  });
});
