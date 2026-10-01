/**
 * SISTEMA DE NOTIFICAÇÕES FCM - Barrel Export
 * Futeba dos Parças
 *
 * Re-exporta todos os módulos de notificações
 * de forma organizada.
 */

// Helpers: tipos, enums, constantes, funções de envio
export {
  NotificationType,
  sendNotificationToUser,
  sendNotificationToUsers,
  saveNotificationToFirestore,
  sendAndSaveNotification,
  isTransientError,
  isInvalidTokenError,
} from "./helpers";
export type {
  FcmNotification,
  NotificationPayload,
} from "./helpers";

// Game notifications: criação, atualização, vagas
export {
  onGameCreated,
  onGameUpdatedNotification,
  onGameVacancy,
  onGameVacancyDeleted,
} from "./game-notifications";

// Presence notifications: confirmações, convites,
// membros, caixa
export {
  onGameConfirmed,
  onGroupInviteCreated,
  cleanupExpiredInvites,
  onGroupInviteResponse,
  onMemberJoined,
  onMemberLeft,
  onCashboxTransaction,
} from "./presence-notifications";

// Achievement notifications: level up, badges,
// MVP, divisões, streaks
export {
  onLevelUp,
  onBadgeAwarded,
  STREAK_MILESTONES,
  sendStreakNotificationIfMilestone,
  notifyMvpAwardedDirect,
  onMvpAwarded,
  onDivisionChanged,
} from "./achievement-notifications";

// Callable functions: teste e debug
export {
  sendTestNotification,
  createFakeGameNotifications,
} from "./callable";

// Registro privado de tokens por instalação
export {
  cleanupExpiredPushTokens,
  registerPushToken,
  unregisterPushToken,
} from "./push-token-registry";

// Batch sender (já existia como módulo separado)
export {
  enqueueNotification,
  enqueueNotifications,
  processNotificationBatch,
  enqueueNotificationCallable,
  cleanupNotificationQueue,
} from "./batch-sender";
export type {
  QueuedNotification,
} from "./batch-sender";
