/**
 * SISTEMA DE NOTIFICAÇÕES FCM
 * Futeba dos Parças
 */

import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const db = admin.firestore();
const fcm = admin.messaging();

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

async function getUserFcmToken(userId: string): Promise<string | null> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    return userData?.fcm_token || userData?.fcmToken || null;
  } catch (e) {
    console.error("Erro ao buscar token FCM do usuario " + userId + ":", e);
    return null;
  }
}

async function getUserFcmTokens(userIds: string[]): Promise<string[]> {
  const tokens: string[] = [];
  const chunks: string[][] = [];

  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    try {
      const snapshot = await db.collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", chunk)
        .get();

      snapshot.docs.forEach((doc: any) => {
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

export async function sendNotificationToUser(
  userId: string,
  notification: FcmNotification
): Promise<boolean> {
  try {
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

    const response = await fcm.send(message);
    console.log("Notificacao enviada para " + userId + ": " + response);
    return true;
  } catch (e: any) {
    if (e.code === "messaging/registration-token-not-registered") {
      console.log("Token invalido para " + userId + ", limpando...");
      await db.collection("users").doc(userId).update({
        fcm_token: admin.firestore.FieldValue.delete(),
      });
    }
    console.error("Erro ao enviar notificacao para " + userId + ":", e);
    return false;
  }
}

export async function sendNotificationToUsers(
  userIds: string[],
  notification: FcmNotification
): Promise<number> {
  if (userIds.length === 0) return 0;

  const tokens = await getUserFcmTokens(userIds);
  if (tokens.length === 0) {
    console.log("Nenhum token FCM encontrado");
    return 0;
  }

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
    } catch (e) {
      console.error("Erro ao enviar multicast:", e);
    }
  }

  return totalSuccess;
}

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
      const membersSnap = await db.collection("groups")
        .doc(game.group_id)
        .collection("members")
        .where("role", "in", ["MEMBER", "ADMIN", "OWNER"])
        .get();

      const memberIds = membersSnap.docs
        .map((doc: any) => doc.id)
        .filter((id: string) => id !== ownerId);

      if (memberIds.length > 0) {
        const ownerDoc = await db.collection("users").doc(ownerId).get();
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
      const confirmationsSnap = await db.collection("confirmations")
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
      const confirmationsSnap = await db.collection("confirmations")
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
      const gameDoc = await db.collection("games").doc(gameId).get();
      if (!gameDoc.exists) return;

      const game = gameDoc.data();
      if (!game) return;

      if (game.owner_id !== userId) {
        const userDoc = await db.collection("users").doc(userId).get();
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

  const userDoc = await db.collection("users").doc(userId).get();
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
