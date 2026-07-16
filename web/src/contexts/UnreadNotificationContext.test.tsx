import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUnreadHook = vi.fn();

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../hooks/useNotifications', () => ({
  useUnreadNotificationCount: (userId?: string) => mockUnreadHook(userId),
}));

import {
  UnreadNotificationProvider,
  useUnreadNotificationSummary,
} from './UnreadNotificationContext';

function Consumer({ name }: { name: string }) {
  const { unreadCount } = useUnreadNotificationSummary();
  return <span>{name}:{unreadCount}</span>;
}

describe('UnreadNotificationProvider', () => {
  beforeEach(() => {
    mockUnreadHook.mockReset();
    mockUnreadHook.mockReturnValue({ unreadCount: 4, loading: false, error: null });
  });

  it('compartilha uma única assinatura entre múltiplos consumidores', () => {
    render(
      <UnreadNotificationProvider>
        <Consumer name="shell" />
        <Consumer name="sidebar" />
      </UnreadNotificationProvider>,
    );

    expect(screen.getByText('shell:4')).toBeInTheDocument();
    expect(screen.getByText('sidebar:4')).toBeInTheDocument();
    expect(mockUnreadHook).toHaveBeenCalledTimes(1);
    expect(mockUnreadHook).toHaveBeenCalledWith('user-1');
  });
});
