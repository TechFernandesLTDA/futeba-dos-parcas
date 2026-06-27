import type { Notification } from '../types';

export type NotificationContextKind = 'game' | 'group' | 'achievement' | 'system';

export interface NotificationContextGroup {
  key: string;
  kind: NotificationContextKind;
  labelKey: string;
  fallbackLabel: string;
  latestAt: Date;
  unreadCount: number;
  notifications: Notification[];
}

const GAME_TYPES = new Set([
  'GAME_INVITE',
  'GAME_SUMMON',
  'GAME_CONFIRMED',
  'GAME_REMINDER',
  'GAME_CANCELLED',
  'GAME_UPDATED',
  'GAME_VACANCY',
  'MVP_VOTE',
  'MVP_RECEIVED',
]);

const GROUP_TYPES = new Set([
  'GROUP_INVITE',
  'GROUP_INVITE_ACCEPTED',
  'GROUP_INVITE_DECLINED',
  'MEMBER_JOINED',
  'MEMBER_LEFT',
]);

const ACHIEVEMENT_TYPES = new Set([
  'ACHIEVEMENT',
  'BADGE_UNLOCKED',
  'LEVEL_UP',
  'STREAK_BROKEN',
]);

function getContextKind(notification: Notification): NotificationContextKind {
  if (notification.referenceType === 'game' || GAME_TYPES.has(notification.type)) return 'game';
  if (notification.referenceType === 'group' || GROUP_TYPES.has(notification.type)) return 'group';
  if (notification.referenceType === 'badge' || notification.referenceType === 'level' || ACHIEVEMENT_TYPES.has(notification.type)) {
    return 'achievement';
  }
  return 'system';
}

export function getNotificationContextKey(notification: Notification): string {
  const kind = getContextKind(notification);
  const contextualId = kind === 'group'
    ? notification.groupId || notification.referenceId
    : notification.referenceId;

  return contextualId ? `${kind}:${contextualId}` : `${kind}:${notification.type}`;
}

export function groupNotificationsByContext(notifications: Notification[]): NotificationContextGroup[] {
  const groups = new Map<string, NotificationContextGroup>();

  notifications.forEach((notification) => {
    const kind = getContextKind(notification);
    const key = getNotificationContextKey(notification);
    const existing = groups.get(key);

    if (existing) {
      existing.notifications.push(notification);
      existing.latestAt = existing.latestAt > notification.createdAt ? existing.latestAt : notification.createdAt;
      existing.unreadCount += notification.read ? 0 : 1;
      return;
    }

    groups.set(key, {
      key,
      kind,
      labelKey: `notifications.screen.contextGroups.${kind}`,
      fallbackLabel: notification.title,
      latestAt: notification.createdAt,
      unreadCount: notification.read ? 0 : 1,
      notifications: [notification],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      notifications: [...group.notifications].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    }))
    .sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
      return b.latestAt.getTime() - a.latestAt.getTime();
    });
}
