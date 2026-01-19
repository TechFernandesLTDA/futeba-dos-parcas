/**
 * SISTEMA DE NOTIFICAÇÕES FCM
 * Futeba dos Parças
 */

import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

// Lazy initialization para evitar erro de initializeApp
const getDb = () => admin.firestore();
const getFcm = () => admin.messaging();

// ==========================================
// CONSTANTES DE RETRY
// ==========================================

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 1000;

// Tempo de expiração de convites de grupo (48 horas em milissegundos)
const INVITE_EXPIRATION_MS = 48 * 60 * 60 * 1000;

// ==========================================
// TIPOS DE NOTIFICAÇÃO
// ==========================================

export enum NotificationType {
  GAME_INVITE = "GAME_INVITE",
  GAME_CONFIRMED = "GAME_CONFIRMED",
  GAME_CANCELLED = "GAME_CANCELLED",
  GAME_SUMMON = "GAME_SUMMON",
  GAME_REMINDER = "GAME_REMINDER",
  GAME_UPDATED = "GAME_UPDATED",
  GROUP_INVITE = "GROUP_INVITE",
  GROUP_INVITE_ACCEPTED = "GROUP_INVITE_ACCEPTED",
  GROUP_INVITE_DECLINED = "GROUP_INVITE_DECLINED",
  ACHIEVEMENT = "ACHIEVEMENT",
  LEVEL_UP = "LEVEL_UP",
  RANKING_CHANGED = "RANKING_CHANGED",
  MVP_RECEIVED = "MVP_RECEIVED",
}

// ==========================================
// INTERFACES
// ==========================================

interface FcmNotification {
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, string>;
  imageUrl?: string;
}

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  gameId?: string;
  groupId?: string;
  senderId?: string;
  senderName?: string;
  action?: string;
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Verifica se um erro FCM é transiente e pode ser retentado
 */
function isTransientError(error: any): boolean {
  const code = error?.code || error?.errorInfo?.code || "";
  return (
    code === "messaging/server-unavailable" ||
    code === "messaging/internal-error" ||
    code === "messaging/unknown-error" ||
    // Erros de rede também são transientes
    error?.message?.includes("ECONNRESET") ||
    error?.message?.includes("ETIMEDOUT") ||
    error?.message?.includes("socket hang up")
  );
}

/**
 * Verifica se um erro FCM indica token inválido que deve ser removido
 */
function isInvalidTokenError(error: any): boolean {
  const code = error?.code || error?.errorInfo?.code || "";
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    code === "messaging/invalid-argument"
  );
}

/**
 * Aguarda um tempo especificado (para backoff)
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envia uma mensagem FCM com retry e exponential backoff para erros transientes
 */
async function sendWithRetry(
  message: admin.messaging.Message,
  maxRetries: number = MAX_RETRY_ATTEMPTS
): Promise<{ success: boolean; error?: any }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await getFcm().send(message);
      return { success: true };
    } catch (e: any) {
      const errorCode = e?.code || e?.errorInfo?.code || "unknown";

      if (isTransientError(e) && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * INITIAL_BACKOFF_MS;
        console.log(
          `FCM retry ${attempt}/${maxRetries} apos erro transiente (${errorCode}). ` +
          `Aguardando ${backoffMs}ms...`
        );
        await sleep(backoffMs);
        continue;
      }

      // Erro não transiente ou esgotaram as tentativas
      if (attempt === maxRetries && isTransientError(e)) {
        console.error(
          `FCM falhou apos ${maxRetries} tentativas (${errorCode}): ${e.message}`
        );
      }

      return { success: false, error: e };
    }
  }
  return { success: false };
}

/**
 * Remove token FCM inválido do usuário no Firestore
 */
async function removeInvalidToken(userId: string, token: string): Promise<void> {
  try {
    console.log(`Removendo token invalido do usuario ${userId}`);
    await getDb().collection("users").doc(userId).update({
      fcm_token: admin.firestore.FieldValue.delete(),
    });
  } catch (e) {
    console.error(`Erro ao remover token invalido do usuario ${userId}:`, e);
  }
}

async function getUserFcmToken(userId: string): Promise<string | null> {
  try {
    const userDoc = await getDb().collection("users").doc(userId).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    return userData?.fcm_token || userData?.fcmToken || null;
  } catch (e) {
    console.error("Erro ao buscar token FCM do usuario " + userId + ":", e);
    return null;
  }
}

/**
 * Interface para mapear tokens FCM aos seus respectivos usuários
 */
interface TokenUserMapping {
  token: string;
  userId: string;
}

/**
 * Busca tokens FCM de múltiplos usuários com mapeamento token->userId
 */
async function getUserFcmTokensWithMapping(
  userIds: string[]
): Promise<TokenUserMapping[]> {
  const mappings: TokenUserMapping[] = [];
  const chunks: string[][] = [];

  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    try {
      const snapshot = await getDb().collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", chunk)
        .get();

      snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const token = data?.fcm_token || data?.fcmToken;
        if (token) {
          mappings.push({ token, userId: doc.id });
        }
      });
    } catch (e) {
      console.error("Erro ao buscar tokens em lote:", e);
    }
  }

  return mappings;
}

export async function sendNotificationToUser(
  userId: string,
  notification: FcmNotification
): Promise<boolean> {
  const token = await getUserFcmToken(userId);
  if (!token) {
    console.log("Usuario " + userId + " nao tem token FCM");
    return false;
  }

  const message: admin.messaging.Message = {
    token: token,
    notification: {
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl,
    },
    data: {
      type: notification.type,
      ...notification.data,
    },
    android: {
      priority: "high",
      notification: {
        channelId: notification.type,
        sound: "default",
        clickAction: notification.data?.action || "FLUTTER_NOTIFICATION_CLICK",
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: notification.title,
            body: notification.body,
          },
          sound: "default",
          badge: 1,
        },
      },
    },
  };

  // Usar retry com exponential backoff
  const result = await sendWithRetry(message);

  if (result.success) {
    console.log(`Notificacao enviada para ${userId}`);
    return true;
  }

  // Tratar erros de token inválido
  if (result.error && isInvalidTokenError(result.error)) {
    console.log(`Token invalido para ${userId}, limpando...`);
    await removeInvalidToken(userId, token);
  } else if (result.error) {
    console.error(`Erro ao enviar notificacao para ${userId}:`, result.error);
  }

  return false;
}

export async function sendNotificationToUsers(
  userIds: string[],
  notification: FcmNotification
): Promise<number> {
  if (userIds.length === 0) return 0;

  // Buscar tokens com mapeamento para identificar usuários com tokens inválidos
  const tokenMappings = await getUserFcmTokensWithMapping(userIds);
  if (tokenMappings.length === 0) {
    console.log("Nenhum token FCM encontrado");
    return 0;
  }

  // Criar mapa de token -> userId para limpeza de tokens inválidos
  const tokenToUserMap = new Map<string, string>();
  tokenMappings.forEach((m) => tokenToUserMap.set(m.token, m.userId));

  const tokens = tokenMappings.map((m) => m.token);

  // Dividir em chunks de 500 (limite do FCM para multicast)
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  let totalSuccess = 0;
  const invalidTokensToRemove: { token: string; userId: string }[] = [];
  const transientFailures: { token: string; userId: string }[] = [];

  for (const chunk of chunks) {
    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: chunk,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: {
          type: notification.type,
          ...notification.data,
        },
        android: {
          priority: "high",
          notification: {
            channelId: notification.type,
            sound: "default",
          },
        },
      };

      const response = await getFcm().sendEachForMulticast(message);
      totalSuccess += response.successCount;

      // Processar falhas individuais
      if (response.failureCount > 0) {
        console.log(
          `Multicast: ${response.successCount} sucesso, ${response.failureCount} falhas`
        );

        response.responses.forEach((sendResponse, index) => {
          if (!sendResponse.success && sendResponse.error) {
            const failedToken = chunk[index];
            const userId = tokenToUserMap.get(failedToken);
            const errorCode = sendResponse.error.code || "unknown";

            if (userId) {
              if (isInvalidTokenError(sendResponse.error)) {
                // Token inválido - marcar para remoção
                console.log(
                  `Token invalido detectado (${errorCode}) para usuario ${userId}`
                );
                invalidTokensToRemove.push({ token: failedToken, userId });
              } else if (isTransientError(sendResponse.error)) {
                // Erro transiente - marcar para retry individual
                console.log(
                  `Erro transiente (${errorCode}) para usuario ${userId}, agendando retry`
                );
                transientFailures.push({ token: failedToken, userId });
              } else {
                // Outro erro - apenas logar
                console.error(
                  `Falha ao enviar para usuario ${userId}: ${errorCode} - ${sendResponse.error.message}`
                );
              }
            }
          }
        });
      }
    } catch (e) {
      console.error("Erro ao enviar multicast:", e);
    }
  }

  // Limpar tokens inválidos em paralelo
  if (invalidTokensToRemove.length > 0) {
    console.log(`Removendo ${invalidTokensToRemove.length} tokens invalidos...`);
    await Promise.all(
      invalidTokensToRemove.map(({ token, userId }) =>
        removeInvalidToken(userId, token)
      )
    );
  }

  // Retry para falhas transientes com exponential backoff
  if (transientFailures.length > 0) {
    console.log(
      `Tentando retry para ${transientFailures.length} falhas transientes...`
    );

    for (const { token, userId } of transientFailures) {
      const retryMessage: admin.messaging.Message = {
        token: token,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: {
          type: notification.type,
          ...notification.data,
        },
        android: {
          priority: "high",
          notification: {
            channelId: notification.type,
            sound: "default",
          },
        },
      };

      const result = await sendWithRetry(retryMessage);

      if (result.success) {
        console.log(`Retry bem-sucedido para usuario ${userId}`);
        totalSuccess++;
      } else if (result.error && isInvalidTokenError(result.error)) {
        // Token se tornou inválido durante retry
        console.log(`Token invalido detectado no retry para usuario ${userId}`);
        await removeInvalidToken(userId, token);
      } else {
        console.error(
          `Retry falhou para usuario ${userId}: ${result.error?.message || "erro desconhecido"}`
        );
      }
    }
  }

  console.log(`Total de notificacoes enviadas com sucesso: ${totalSuccess}`);
  return totalSuccess;
}

export async function saveNotificationToFirestore(
  userId: string,
  payload: NotificationPayload
): Promise<string> {
  const notificationRef = getDb().collection("notifications").doc();

  await notificationRef.set({
    id: notificationRef.id,
    user_id: userId,
    title: payload.title,
    body: payload.body,
    type: payload.type,
    game_id: payload.gameId || null,
    group_id: payload.groupId || null,
    sender_id: payload.senderId || null,
    sender_name: payload.senderName || null,
    action: payload.action || null,
    read: false,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return notificationRef.id;
}

export async function sendAndSaveNotification(
  userId: string,
  payload: NotificationPayload
): Promise<boolean> {
  await saveNotificationToFirestore(userId, payload);

  return await sendNotificationToUser(userId, {
    title: payload.title,
    body: payload.body,
    type: payload.type,
    data: {
      gameId: payload.gameId || "",
      groupId: payload.groupId || "",
      senderId: payload.senderId || "",
      action: payload.action || "",
    },
  });
}

// ==========================================
// CLOUD FUNCTIONS TRIGGERS
// ==========================================

export const onGameCreated = onDocumentCreated("games/{gameId}", async (event) => {
  const game = event.data?.data();
  if (!game) return;

  const gameId = event.params.gameId;
  const ownerId = game.owner_id;

  if (game.group_id) {
    try {
      const membersSnap = await getDb().collection("groups")
        .doc(game.group_id)
        .collection("members")
        .where("role", "in", ["MEMBER", "ADMIN", "OWNER"])
        .get();

      const memberIds = membersSnap.docs
        .map((doc: any) => doc.id)
        .filter((id: string) => id !== ownerId);

      if (memberIds.length > 0) {
        const ownerDoc = await getDb().collection("users").doc(ownerId).get();
        const ownerName = ownerDoc.exists
          ? (ownerDoc.data()?.name || ownerDoc.data()?.nickname || "Alguem")
          : "Alguem";

        await sendNotificationToUsers(memberIds, {
          title: "Novo jogo criado!",
          body: ownerName + " criou um novo jogo. Confirme sua presenca!",
          type: NotificationType.GAME_INVITE,
          data: {
            gameId: gameId,
            action: "game_detail/" + gameId,
          },
        });
      }
    } catch (e) {
      console.error("Erro ao notificar membros do grupo:", e);
    }
  }
});

export const onGameUpdatedNotification = onDocumentUpdated("games/{gameId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const gameId = event.params.gameId;

  if (before.status !== "CANCELLED" && after.status === "CANCELLED") {
    try {
      const confirmationsSnap = await getDb().collection("confirmations")
        .where("game_id", "==", gameId)
        .where("status", "==", "CONFIRMED")
        .get();

      const userIds = confirmationsSnap.docs.map((doc: any) => doc.data().user_id || doc.data().userId);

      if (userIds.length > 0) {
        await sendNotificationToUsers(userIds, {
          title: "Jogo cancelado",
          body: "O jogo foi cancelado pelo organizador.",
          type: NotificationType.GAME_CANCELLED,
          data: {
            gameId: gameId,
          },
        });
      }
    } catch (e) {
      console.error("Erro ao notificar cancelamento:", e);
    }
  }

  if (before.date !== after.date || before.location_id !== after.location_id) {
    try {
      const confirmationsSnap = await getDb().collection("confirmations")
        .where("game_id", "==", gameId)
        .where("status", "==", "CONFIRMED")
        .get();

      const userIds = confirmationsSnap.docs.map((doc: any) => doc.data().user_id || doc.data().userId);

      if (userIds.length > 0) {
        await sendNotificationToUsers(userIds, {
          title: "Jogo atualizado",
          body: "Os detalhes do jogo mudaram. Confira no app.",
          type: NotificationType.GAME_UPDATED,
          data: {
            gameId: gameId,
          },
        });
      }
    } catch (e) {
      console.error("Erro ao notificar atualizacao:", e);
    }
  }
});

export const onGameConfirmed = onDocumentCreated(
  "confirmations/{confirmationId}",
  async (event) => {
    const confirmation = event.data?.data();
    if (!confirmation || confirmation.status !== "CONFIRMED") return;

    const gameId = confirmation.game_id || confirmation.gameId;
    const userId = confirmation.user_id || confirmation.userId;

    try {
      const gameDoc = await getDb().collection("games").doc(gameId).get();
      if (!gameDoc.exists) return;

      const game = gameDoc.data();
      if (!game) return;

      if (game.owner_id !== userId) {
        const userDoc = await getDb().collection("users").doc(userId).get();
        const userName = userDoc.exists
          ? (userDoc.data()?.name || userDoc.data()?.nickname || "Um jogador")
          : "Um jogador";

        await sendNotificationToUser(game.owner_id, {
          title: "Nova confirmacao!",
          body: userName + " confirmou presenca no jogo.",
          type: NotificationType.GAME_CONFIRMED,
          data: {
            gameId: gameId,
          },
        });
      }
    } catch (e) {
      console.error("Erro ao notificar confirmacao:", e);
    }
  }
);

export const onLevelUp = onDocumentUpdated("users/{userId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const userId = event.params.userId;

  const beforeLevel = before.level || 0;
  const afterLevel = after.level || 0;

  if (afterLevel > beforeLevel) {
    const levelNames = [
      "Novato", "Iniciante", "Amador", "Regular", "Experiente",
      "Habilidoso", "Profissional", "Expert", "Mestre", "Lenda", "Imortal"
    ];
    const levelName = levelNames[afterLevel] || "Nivel " + afterLevel;

    await sendNotificationToUser(userId, {
      title: "Subiu de nivel!",
      body: "Parabens! Voce agora e " + levelName + "!",
      type: NotificationType.LEVEL_UP,
      imageUrl: "https://firebasestorage.googleapis.com/v0/b/futeba-dos-parcas.appspot.com/o/badges%2Flevel_up.png?alt=media",
    });
  }
});

export const sendTestNotification = onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Usuario nao autenticado");
  }

  const userId = context.auth.uid;
  const { title, body, type } = data;

  if (!title || !body) {
    throw new HttpsError("invalid-argument", "Titulo e corpo sao obrigatorios");
  }

  const success = await sendNotificationToUser(userId, {
    title,
    body,
    type: type || NotificationType.GAME_INVITE,
  });

  return { success, message: success ? "Notificacao enviada!" : "Falha ao enviar" };
});

export const createFakeGameNotifications = onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Usuario nao autenticado");
  }

  const userId = context.auth.uid;
  const { count = 3 } = data;

  const userDoc = await getDb().collection("users").doc(userId).get();
  const userName = userDoc.exists
    ? (userDoc.data()?.name || userDoc.data()?.nickname || "Jogador")
    : "Jogador";

  const fakeGames = [
    {
      title: "Pelada de Sexta!",
      body: userName + ", voce foi convidado para a pelada de sexta as 18h!",
      time: "Sexta, 18:00",
      location: "Campo do Clube",
    },
    {
      title: "Futebol no Sabado",
      body: "Vem jogar " + userName + "! Sabado as 10h no campo society.",
      time: "Sabado, 10:00",
      location: "Society Center",
    },
    {
      title: "Domingo de Bola",
      body: "Domingo tem jogo! " + userName + ", confirma ai?",
      time: "Domingo, 09:00",
      location: "Quadra do Parque",
    },
    {
      title: "Pelada Noturna",
      body: "Hoje a noite " + userName + "! 20h na quadra iluminada.",
      time: "Hoje, 20:00",
      location: "Quadra Iluminada",
    },
    {
      title: "Campeonato Interno",
      body: "Seu grupo esta organizando um campeonato. Participe!",
      time: "Proximo sabado",
      location: "Centro Esportivo",
    },
  ];

  const created: any[] = [];

  for (let i = 0; i < Math.min(count, fakeGames.length); i++) {
    const game = fakeGames[i];
    const notificationId = await saveNotificationToFirestore(userId, {
      userId,
      title: game.title,
      body: game.body,
      type: NotificationType.GAME_INVITE,
      action: "game_detail/fake",
      senderId: "system",
      senderName: "Sistema",
    });

    created.push({
      id: notificationId,
      title: game.title,
      body: game.body,
    });
  }

  if (created.length > 0) {
    await sendNotificationToUser(userId, {
      title: created[0].title,
      body: created[0].body,
      type: NotificationType.GAME_INVITE,
    });
  }

  return {
    success: true,
    created: created.length,
    notifications: created,
  };
});

// ==========================================
// BADGE NOTIFICATION TRIGGER
// ==========================================

/**
 * Trigger quando uma badge é desbloqueada.
 * Envia notificação push e salva no Firestore.
 */
export const onBadgeAwarded = onDocumentCreated(
  "user_badges/{badgeDocId}",
  async (event) => {
    const userBadge = event.data?.data();
    if (!userBadge) {
      console.log("[onBadgeAwarded] No data in event, skipping");
      return;
    }

    const badgeDocId = event.params.badgeDocId;
    const userId = userBadge.user_id;
    const badgeId = userBadge.badge_id;

    if (!userId || !badgeId) {
      console.error("[onBadgeAwarded] Missing user_id or badge_id in document", badgeDocId);
      return;
    }

    console.log(`[onBadgeAwarded] Badge ${badgeId} awarded to user ${userId}`);

    try {
      // Buscar dados da badge para nome e icone
      const badgeDoc = await getDb().collection("badges").doc(badgeId).get();
      const badge = badgeDoc.exists ? badgeDoc.data() : null;

      const badgeName = badge?.name || badge?.title || badgeId;
      const badgeIconUrl = badge?.icon_url || badge?.iconUrl || null;

      // Enviar notificação push
      const notificationSent = await sendNotificationToUser(userId, {
        title: "Conquista Desbloqueada!",
        body: `Voce desbloqueou: ${badgeName}!`,
        type: NotificationType.ACHIEVEMENT,
        imageUrl: badgeIconUrl || undefined,
        data: {
          action: "badges",
          badgeId: badgeId,
        },
      });

      console.log(`[onBadgeAwarded] Push notification sent: ${notificationSent}`);

      // Salvar notificação no Firestore para histórico
      await saveNotificationToFirestore(userId, {
        userId,
        title: "Conquista Desbloqueada!",
        body: `Voce desbloqueou: ${badgeName}!`,
        type: NotificationType.ACHIEVEMENT,
        action: "badges",
      });

      console.log(`[onBadgeAwarded] Notification saved to Firestore for user ${userId}`);
    } catch (error) {
      console.error(`[onBadgeAwarded] Error processing badge notification:`, error);
    }
  }
);

// ==========================================
// STREAK NOTIFICATION HELPER
// ==========================================

/**
 * Milestones de streak para notificações.
 * Usado pelo processamento de XP em index.ts.
 */
export const STREAK_MILESTONES = [
  { streak: 30, title: "Sequencia Epica!", body: "30 jogos consecutivos! Voce e uma lenda!" },
  { streak: 10, title: "Sequencia Incrivel!", body: "10 jogos consecutivos! Expert!" },
  { streak: 7, title: "Sequencia Forte!", body: "7 jogos consecutivos! Profissional!" },
  { streak: 3, title: "Sequencia Iniciada!", body: "3 jogos consecutivos! Continue assim!" },
];

/**
 * Envia notificação de streak milestone se o jogador atingiu um marco.
 * @param userId ID do usuário
 * @param currentStreak Streak atual do jogador
 * @returns true se uma notificação foi enviada
 */
export async function sendStreakNotificationIfMilestone(
  userId: string,
  currentStreak: number
): Promise<boolean> {
  // Verificar se atingiu algum milestone exatamente
  const milestone = STREAK_MILESTONES.find(m => currentStreak === m.streak);

  if (!milestone) {
    return false;
  }

  console.log(`[STREAK] User ${userId} reached streak milestone: ${currentStreak} games`);

  try {
    // Enviar notificação push
    const sent = await sendNotificationToUser(userId, {
      title: milestone.title,
      body: milestone.body,
      type: NotificationType.ACHIEVEMENT,
      data: {
        action: "achievements",
        streak: String(currentStreak),
      },
    });

    // Salvar no Firestore
    await saveNotificationToFirestore(userId, {
      userId,
      title: milestone.title,
      body: milestone.body,
      type: NotificationType.ACHIEVEMENT,
      action: "achievements",
    });

    console.log(`[STREAK] Notification sent to ${userId}: ${milestone.title}`);
    return sent;
  } catch (error) {
    console.error(`[STREAK] Error sending streak notification to ${userId}:`, error);
    return false;
  }
}

// ==========================================
// CONVITES DE GRUPO - NOTIFICAÇÕES FCM
// ==========================================

/**
 * Trigger que envia notificação push FCM quando um convite de grupo é criado.
 * Escuta a coleção group_invites e envia push para o usuário convidado.
 */
export const onGroupInviteCreated = onDocumentCreated(
  "group_invites/{inviteId}",
  async (event) => {
    const invite = event.data?.data();
    if (!invite) return;

    const inviteId = event.params.inviteId;
    const invitedUserId = invite.invited_user_id || invite.invitedUserId;
    const groupId = invite.group_id || invite.groupId;
    const groupName = invite.group_name || invite.groupName || "um grupo";
    const invitedByName = invite.invited_by_name || invite.invitedByName || "Alguem";

    // Validar campos obrigatórios
    if (!invitedUserId) {
      console.error(`[GROUP_INVITE] Convite ${inviteId} sem invited_user_id`);
      return;
    }

    if (!groupId) {
      console.error(`[GROUP_INVITE] Convite ${inviteId} sem group_id`);
      return;
    }

    console.log(`[GROUP_INVITE] Enviando notificacao para ${invitedUserId} - Convite para ${groupName} por ${invitedByName}`);

    try {
      // Salvar notificação no Firestore e enviar push FCM
      await sendAndSaveNotification(invitedUserId, {
        userId: invitedUserId,
        title: "Convite para grupo",
        body: `${invitedByName} convidou voce para ${groupName}`,
        type: NotificationType.GROUP_INVITE,
        groupId: groupId,
        senderId: invite.invited_by_id || invite.invitedById || null,
        senderName: invitedByName,
        action: "group_invite/" + inviteId,
      });

      console.log(`[GROUP_INVITE] Notificacao enviada com sucesso para ${invitedUserId}`);
    } catch (e) {
      console.error(`[GROUP_INVITE] Erro ao enviar notificacao para ${invitedUserId}:`, e);
    }
  }
);

/**
 * Função agendada para limpar convites expirados (mais de 48 horas).
 * Executa diariamente para marcar convites pendentes antigos como EXPIRED.
 */
export const cleanupExpiredInvites = onSchedule("every 24 hours", async (event) => {
  console.log("[CLEANUP] Iniciando limpeza de convites expirados...");

  try {
    // Calcular timestamp de expiração (48 horas atrás)
    const expirationTime = new Date(Date.now() - INVITE_EXPIRATION_MS);

    // Buscar convites pendentes criados há mais de 48 horas
    const expiredInvitesSnap = await getDb().collection("group_invites")
      .where("status", "==", "PENDING")
      .where("created_at", "<", expirationTime)
      .get();

    if (expiredInvitesSnap.empty) {
      console.log("[CLEANUP] Nenhum convite expirado encontrado");
      return;
    }

    console.log(`[CLEANUP] Encontrados ${expiredInvitesSnap.size} convites expirados`);

    // Atualizar em batch (máximo de 500 operações por batch)
    const chunks: admin.firestore.QueryDocumentSnapshot[][] = [];
    const docs = expiredInvitesSnap.docs;

    for (let i = 0; i < docs.length; i += 500) {
      chunks.push(docs.slice(i, i + 500));
    }

    let totalUpdated = 0;

    for (const chunk of chunks) {
      const batch = getDb().batch();

      for (const doc of chunk) {
        batch.update(doc.ref, {
          status: "EXPIRED",
          expired_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      totalUpdated += chunk.length;
    }

    console.log(`[CLEANUP] ${totalUpdated} convites marcados como EXPIRED`);
  } catch (e) {
    console.error("[CLEANUP] Erro ao limpar convites expirados:", e);
    throw e; // Re-throw para que o Cloud Functions tente novamente
  }
});
