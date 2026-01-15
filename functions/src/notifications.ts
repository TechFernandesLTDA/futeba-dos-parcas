/**
 * SISTEMA DE NOTIFICAÇÕES FCM
 * Futeba dos Parças
 *
 * Envia notificações push para eventos importantes:
 * - Convites para jogos
 * - Confirmações de presença
 * - Lembretes de jogos
 * - Cancelamentos
 * - Mudanças de status
 * - Conquistas desbloqueadas
 * - Mudanças no ranking
 */

import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated, onCall } from "firebase-functions/v2/firestore";
import { onCall as onCallV1 } from "firebase-functions/v1";
import { CallableContext } from "firebase-functions/v1/https";

const db = admin.firestore();
const fcm = admin.messaging();

// ==========================================
// TIPOS DE NOTIFICAÇÃO
// ==========================================

export enum NotificationType {
  GAME_INVITE = "GAME_INVITE",
  GAME_CONFIRMED = "GAME_CONFIRMED",
  GAME_CANCELLED = "GAME_CANCELLED",
  GAME_SUMMON = "GAME_SUMMON",           // Chamado para jogo (1h antes)
  GAME_REMINDER = "GAME_REMINDER",       // Lembrete (24h antes)
  GAME_UPDATED = "GAME_UPDATED",         // Horário/local mudou
  GROUP_INVITE = "GROUP_INVITE",
  GROUP_INVITE_ACCEPTED = "GROUP_INVITE_ACCEPTED",
  GROUP_INVITE_DECLINED = "GROUP_INVITE_DECLINED",
  ACHIEVEMENT = "ACHIEVEMENT",           // Conquista desbloqueada
  LEVEL_UP = "LEVEL_UP",                 // Subiu de nível
  RANKING_CHANGED = "RANKING_CHANGED",   // Mudou de posição no ranking
  MVP_RECEIVED = "MVP_RECEIVED",         // Foi MVP em um jogo
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
  action?: string; // Para deep link
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Busca o token FCM de um usuário
 */
async function getUserFcmToken(userId: string): Promise<string | null> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    return userData?.fcm_token || userData?.fcmToken || null;
  } catch (e) {
    console.error(`Erro ao buscar token FCM do usuário ${userId}:`, e);
    return null;
  }
}

/**
 * Busca múltiplos tokens FCM
 */
async function getUserFcmTokens(userIds: string[]): Promise<string[]> {
  const tokens: string[] = [];

  // Firestore whereIn suporta até 10 itens
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    try {
      const snapshot = await db.collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", chunk)
        .get();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const token = data?.fcm_token || data?.fcmToken;
        if (token) tokens.push(token);
      });
    } catch (e) {
      console.error("Erro ao buscar tokens em lote:", e);
    }
  }

  return tokens;
}

/**
 * Envia notificação FCM para um usuário
 */
export async function sendNotificationToUser(
  userId: string,
  notification: FcmNotification
): Promise<boolean> {
  try {
    const token = await getUserFcmToken(userId);
    if (!token) {
      console.log(`Usuário ${userId} não tem token FCM`);
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

    const response = await fcm.send(message);
    console.log(`Notificação enviada para ${userId}: ${response}`);
    return true;
  } catch (e: any) {
    // Se token é inválido, tentar limpar
    if (e.code === "messaging/registration-token-not-registered") {
      console.log(`Token inválido para ${userId}, limpando...`);
      await db.collection("users").doc(userId).update({
        fcm_token: admin.firestore.FieldValue.delete(),
      });
    }
    console.error(`Erro ao enviar notificação para ${userId}:`, e);
    return false;
  }
}

/**
 * Envia notificação para múltiplos usuários
 */
export async function sendNotificationToUsers(
  userIds: string[],
  notification: FcmNotification
): Promise<number> {
  if (userIds.length === 0) return 0;

  // Buscar tokens
  const tokens = await getUserFcmTokens(userIds);
  if (tokens.length === 0) {
    console.log("Nenhum token FCM encontrado");
    return 0;
  }

  // Enviar multicast (até 500 tokens por vez)
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  let totalSuccess = 0;

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

      const response = await fcm.sendEachForMulticast(message);
      totalSuccess += response.successCount;

      // Limpar tokens inválidos
      if (response.failureCount > 0) {
        console.log(`${response.failureCount} tokens falharam`);
        for (let i = 0; i < response.responses.length; i++) {
          if (!response.responses[i].success) {
            // TODO: Mapear token para userId e limpar
          }
        }
      }
    } catch (e) {
      console.error("Erro ao enviar multicast:", e);
    }
  }

  return totalSuccess;
}

/**
 * Salva notificação no Firestore para histórico
 */
export async function saveNotificationToFirestore(
  userId: string,
  payload: NotificationPayload
): Promise<string> {
  const notificationRef = db.collection("notifications").doc();

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

/**
 * Envia notificação e salva no Firestore
 */
export async function sendAndSaveNotification(
  userId: string,
  payload: NotificationPayload
): Promise<boolean> {
  // Salvar no Firestore
  await saveNotificationToFirestore(userId, payload);

  // Enviar FCM
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

/**
 * Trigger: Quando um jogo é criado
 * Envia notificação para membros do grupo
 */
export const onGameCreated = onDocumentCreated("games/{gameId}", async (event) => {
  const game = event.data?.data();
  if (!game) return;

  const gameId = event.params.gameId;
  const ownerId = game.owner_id;

  // Buscar membros do grupo (se houver)
  if (game.group_id) {
    try {
      const membersSnap = await db.collection("groups")
        .doc(game.group_id)
        .collection("members")
        .where("role", "in", ["MEMBER", "ADMIN", "OWNER"])
        .get();

      const memberIds = membersSnap.docs
        .map(doc => doc.id)
        .filter(id => id !== ownerId); // Não notificar o criador

      if (memberIds.length > 0) {
        // Buscar nome do criador
        const ownerDoc = await db.collection("users").doc(ownerId).get();
        const ownerName = ownerDoc.exists
          ? (ownerDoc.data()?.name || ownerDoc.data()?.nickname || "Alguém")
          : "Alguém";

        await sendNotificationToUsers(memberIds, {
          title: "Novo jogo criado! 🏃‍♂️",
          body: `${ownerName} criou um novo jogo. Confirme sua presença!`,
          type: NotificationType.GAME_INVITE,
          data: {
            gameId: gameId,
            action: `game_detail/${gameId}`,
          },
        });
      }
    } catch (e) {
      console.error("Erro ao notificar membros do grupo:", e);
    }
  }
});

/**
 * Trigger: Quando um jogo é atualizado (status, horário, etc.)
 */
export const onGameUpdatedNotification = onDocumentUpdated("games/{gameId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const gameId = event.params.gameId;

  // Status mudou para CANCELADO
  if (before.status !== "CANCELLED" && after.status === "CANCELLED") {
    try {
      // Buscar confirmados
      const confirmationsSnap = await db.collection("confirmations")
        .where("game_id", "==", gameId)
        .where("status", "==", "CONFIRMED")
        .get();

      const userIds = confirmationsSnap.docs.map(doc => doc.data().user_id || doc.data().userId);

      if (userIds.length > 0) {
        await sendNotificationToUsers(userIds, {
          title: "Jogo cancelado ❌",
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

  // Horário ou local mudou
  if (before.date !== after.date || before.location_id !== after.location_id) {
    try {
      const confirmationsSnap = await db.collection("confirmations")
        .where("game_id", "==", gameId)
        .where("status", "==", "CONFIRMED")
        .get();

      const userIds = confirmationsSnap.docs.map(doc => doc.data().user_id || doc.data().userId);

      if (userIds.length > 0) {
        await sendNotificationToUsers(userIds, {
          title: "Jogo atualizado 🔄",
          body: "Os detalhes do jogo mudaram. Confira no app.",
          type: NotificationType.GAME_UPDATED,
          data: {
            gameId: gameId,
          },
        });
      }
    } catch (e) {
      console.error("Erro ao notificar atualização:", e);
    }
  }
});

/**
 * Trigger: Quando alguém confirma presença
 */
export const onGameConfirmed = onDocumentCreated(
  "confirmations/{confirmationId}",
  async (event) => {
    const confirmation = event.data?.data();
    if (!confirmation || confirmation.status !== "CONFIRMED") return;

    const gameId = confirmation.game_id || confirmation.gameId;
    const userId = confirmation.user_id || confirmation.userId;

    // Notificar o dono do jogo
    try {
      const gameDoc = await db.collection("games").doc(gameId).get();
      if (!gameDoc.exists) return;

      const game = gameDoc.data();
      if (!game) return;

      // Se não for o próprio dono confirmando
      if (game.owner_id !== userId) {
        // Buscar nome de quem confirmou
        const userDoc = await db.collection("users").doc(userId).get();
        const userName = userDoc.exists
          ? (userDoc.data()?.name || userDoc.data()?.nickname || "Um jogador")
          : "Um jogador";

        await sendNotificationToUser(game.owner_id, {
          title: "Nova confirmação! ✅",
          body: `${userName} confirmou presença no jogo.`,
          type: NotificationType.GAME_CONFIRMED,
          data: {
            gameId: gameId,
          },
        });
      }
    } catch (e) {
      console.error("Erro ao notificar confirmação:", e);
    }
  }
);

/**
 * Trigger: Quando jogador sobe de nível
 */
export const onLevelUp = onDocumentUpdated("users/{userId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const userId = event.params.userId;

  // Verificar se mudou de nível
  const beforeLevel = before.level || 0;
  const afterLevel = after.level || 0;

  if (afterLevel > beforeLevel) {
    const levelNames = [
      "Novato", "Iniciante", "Amador", "Regular", "Experiente",
      "Habilidoso", "Profissional", "Expert", "Mestre", "Lenda", "Imortal"
    ];
    const levelName = levelNames[afterLevel] || `Nível ${afterLevel}`;

    await sendNotificationToUser(userId, {
      title: "Subiu de nível! 🎉",
      body: `Parabéns! Você agora é ${levelName}!`,
      type: NotificationType.LEVEL_UP,
      imageUrl: "https://firebasestorage.googleapis.com/v0/b/futeba-dos-parcas.appspot.com/o/badges%2Flevel_up.png?alt=media",
    });
  }
});

/**
 * HTTP Function: Criar notificação de teste
 */
export const sendTestNotification = onCallV1(async (data: any, context: CallableContext) => {
  // Verificar autenticação
  if (!context.auth) {
    throw new https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const userId = context.auth.uid;
  const { title, body, type } = data;

  if (!title || !body) {
    throw new https.HttpsError("invalid-argument", "Título e corpo são obrigatórios");
  }

  const success = await sendNotificationToUser(userId, {
    title,
    body,
    type: type || NotificationType.GAME_INVITE,
  });

  return { success, message: success ? "Notificação enviada!" : "Falha ao enviar" };
});

/**
 * HTTP Function: Criar notificações de jogos fictícios para teste
 * Cria notificações simulando convites para jogos
 */
export const createFakeGameNotifications = onCallV1(async (data: any, context: CallableContext) => {
  // Verificar autenticação
  if (!context.auth) {
    throw new https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const userId = context.auth.uid;
  const { count = 3 } = data;

  // Buscar nome do usuário
  const userDoc = await db.collection("users").doc(userId).get();
  const userName = userDoc.exists
    ? (userDoc.data()?.name || userDoc.data()?.nickname || "Jogador")
    : "Jogador";

  const fakeGames = [
    {
      title: "Pelada de Sexta! ⚽",
      body: `${userName}, você foi convidado para a pelada de sexta às 18h!`,
      time: "Sexta, 18:00",
      location: "Campo do Clube",
    },
    {
      title: "Futebol no Sábado 🏃",
      body: `Vem jogar ${userName}! Sábado às 10h no campo society.`,
      time: "Sábado, 10:00",
      location: "Society Center",
    },
    {
      title: "Domingo de Bola 🥅",
      body: `Domingo tem jogo! ${userName}, confirma aí?",
      time: "Domingo, 09:00",
      location: "Quadra do Parque",
    },
    {
      title: "Pelada Noturna 🌙",
      body: `Hoje à noite ${userName}! 20h na quadra iluminada.`,
      time: "Hoje, 20:00",
      location: "Quadra Iluminada",
    },
    {
      title: "Campeonato Interno 🏆",
      body: `Seu grupo está organizando um campeonato. Participe!`,
      time: "Próximo sábado",
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

  // Enviar apenas a primeira notificação via FCM
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

// Importar https types
const https = require("firebase-functions/v1/https");

// Exportar tudo
export * from "./notifications";
