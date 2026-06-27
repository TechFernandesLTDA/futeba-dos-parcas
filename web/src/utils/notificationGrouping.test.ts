import { describe, expect, it } from 'vitest';
import type { Notification } from '../types';
import { groupNotificationsByContext } from './notificationGrouping';

function notification(overrides: Partial<Notification>): Notification {
  return {
    id: overrides.id ?? 'notification-1',
    userId: 'user-1',
    type: overrides.type ?? 'SYSTEM',
    title: overrides.title ?? 'Aviso',
    message: overrides.message ?? 'Mensagem',
    read: overrides.read ?? false,
    createdAt: overrides.createdAt ?? new Date('2026-06-27T12:00:00Z'),
    ...overrides,
  };
}

describe('groupNotificationsByContext', () => {
  it('agrupa notificações de um mesmo jogo pelo referenceId', () => {
    const groups = groupNotificationsByContext([
      notification({ id: 'invite', type: 'GAME_INVITE', referenceId: 'game-1', createdAt: new Date('2026-06-27T12:00:00Z') }),
      notification({ id: 'update', type: 'GAME_UPDATED', referenceId: 'game-1', createdAt: new Date('2026-06-27T13:00:00Z'), read: true }),
      notification({ id: 'system', type: 'SYSTEM', createdAt: new Date('2026-06-27T14:00:00Z') }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.key === 'game:game-1')?.notifications.map((item) => item.id)).toEqual(['update', 'invite']);
    expect(groups.find((group) => group.key === 'game:game-1')?.unreadCount).toBe(1);
  });

  it('prioriza contextos com não-lidas antes de contextos apenas recentes', () => {
    const groups = groupNotificationsByContext([
      notification({ id: 'read-recent', type: 'SYSTEM', read: true, createdAt: new Date('2026-06-27T15:00:00Z') }),
      notification({ id: 'unread-old', type: 'ACHIEVEMENT', read: false, createdAt: new Date('2026-06-27T10:00:00Z') }),
    ]);

    expect(groups[0].key).toBe('achievement:ACHIEVEMENT');
    expect(groups[1].key).toBe('system:SYSTEM');
  });
});
