export const NOTIFICATION_PULSE_CYCLES = 3;

export function shouldAnimateNotificationBell(unreadCount: number, reducedMotion: boolean): boolean {
  return unreadCount > 0 && !reducedMotion;
}
