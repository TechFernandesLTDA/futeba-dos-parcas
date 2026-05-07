/**
 * HELPERS DE NOTIFICAÇÕES FCM
 * Tipos, constantes e funções auxiliares para
 * envio de notificações push.
 */

import * as admin from "firebase-admin";
import {
  FIRESTORE_WHERE_IN_LIMIT,
} from "../constants";

// Lazy initialization para evitar erro de initializeApp
const getDb = () => admin.firestore();
const getFcm = () => admin.messaging();

// ==========================================
// CONSTANTES DE RETRY
// ==========================================

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 1000;

// ==========================================
// TIPOS DE NOTIFICAÇÃO
// ==========================================

/**
 * Enum de tipos de notificação suportados.
 */
export enum NotificationType {
  GAME_INVITE = "GAME_INVITE",
  GAME_CONFIRMED = "GAME_CONFIRMED",
  GAME_CANCELLED = "GAME_CANCELLED",
  GAME_SUMMON = "GAME_SUMMON",
  GAME_REMINDER = "GAME_REMINDER",
  GAME_UPDATED = "GAME_UPDATED",
  GAME_VACANCY = "GAME_VACANCY",
  GROUP_INVITE = "GROUP_INVITE",
  GROUP_INVITE_ACCEPTED = "GROUP_INVITE_ACCEPTED",
  GROUP_INVITE_DECLINED = "GROUP_INVITE_DECLINED",
  MEMBER_JOINED = "MEMBER_JOINED",
  MEMBER_LEFT = "MEMBER_LEFT",
  GROUP_JOIN_APPROVED = "GROUP_JOIN_APPROVED",
  CASHBOX_ENTRY = "CASHBOX_ENTRY",
  CASHBOX_EXIT = "CASHBOX_EXIT",
  ACHIEVEMENT = "ACHIEVEMENT",
  LEVEL_UP = "LEVEL_UP",
  RANKING_CHANGED = "RANKING_CHANGED",
  MVP_RECEIVED = "MVP_RECEIVED",
}

// ==========================================
// INTERFACES
// ==========================================

export interface FcmNotification {
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface NotificationPayload {
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

/**
 * Interface para erros FCM com código e mensagem.
 */
interface FcmError {
  code?: string;
  errorInfo?: { code?: string };
  message?: string;
}

/**
 * Interface para mapear tokens FCM aos seus
 * respectivos usuários.
 */
interface TokenUserMapping {
  token: string;
  userId: string;
}

/**
 * Resultado de envio FCM com retry.
 */
interface SendRetryResult {
  success: boolean;
  error?: FcmError;
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Verifica se um erro FCM é transiente e pode
 * ser retentado.
 *
 * @param {FcmError} error - Erro FCM a verificar
 * @return {boolean} true se o erro é transiente
 */
export function isTransientError(
  error: FcmError
): boolean {
  const code =
    error?.code || error?.errorInfo?.code || "";
  return (
    code === "messaging/server-unavailable" ||
    code === "messaging/internal-error" ||
    code === "messaging/unknown-error" ||
    // Erros de rede também são transientes
    (error?.message?.includes("ECONNRESET") ?? false) ||
    (error?.message?.includes("ETIMEDOUT") ?? false) ||
    (error?.message?.includes("socket hang up") ?? false)
  );
}

/**
 * Verifica se um erro FCM indica token inválido
 * que deve ser removido.
 *
 * @param {FcmError} error - Erro FCM a verificar
 * @return {boolean} true se o token é inválido
 */
export function isInvalidTokenError(
  error: FcmError
): boolean {
  const code =
    error?.code || error?.errorInfo?.code || "";
  return (
    code ===
      "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    code === "messaging/invalid-argument"
  );
}

/**
 * Aguarda um tempo especificado (para backoff).
 *
 * @param {number} ms - Milissegundos para aguardar
 * @return {Promise<void>} Promise resolvida após o delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

/**
 * Envia uma mensagem FCM com retry e exponential
 * backoff para erros transientes.
 *
 * @param {admin.messaging.Message} message - Mensagem
 * @param {number} maxRetries - Máx tentativas
 * @return {Promise<SendRetryResult>} Resultado do envio
 */
async function sendWithRetry(
  message: admin.messaging.Message,
  maxRetries: number = MAX_RETRY_ATTEMPTS
): Promise<SendRetryResult> {
  for (
    let attempt = 1;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      await getFcm().send(message);
      return {success: true};
    } catch (e: unknown) {
      const fcmErr = e as FcmError;
      const errorCode =
        fcmErr?.code ||
        fcmErr?.errorInfo?.code ||
        "unknown";

      if (
        isTransientError(fcmErr) &&
        attempt < maxRetries
      ) {
        const backoffMs =
          Math.pow(2, attempt - 1) *
          INITIAL_BACKOFF_MS;
        console.log(
          `FCM retry ${attempt}/${maxRetries}` +
          ` apos erro transiente (${errorCode}).` +
          ` Aguardando ${backoffMs}ms...`
        );
        await sleep(backoffMs);
        continue;
      }

      // Erro não transiente ou esgotaram tentativas
      if (
        attempt === maxRetries &&
        isTransientError(fcmErr)
      ) {
        console.error(
          `FCM falhou apos ${maxRetries}` +
          ` tentativas (${errorCode}):` +
          ` ${fcmErr.message}`
        );
      }

      return {success: false, error: fcmErr};
    }
  }
  return {success: false};
}

/**
 * Remove token FCM inválido do usuário no Firestore.
 *
 * @param {string} userId - ID do usuário
 * @param {string} _token - Token FCM inválido
 * @return {Promise<void>} Resolução após remoção
 */
async function removeInvalidToken(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _token: string
): Promise<void> {
  try {
    console.log(
      `Removendo token invalido do usuario ${userId}`
    );
    await getDb()
      .collection("users")
      .doc(userId)
      .update({
        fcm_token: admin.firestore.FieldValue.delete(),
      });
  } catch (e) {
    console.error(
      "Erro ao remover token invalido" +
      ` do usuario ${userId}:`,
      e
    );
  }
}

/**
 * Busca o token FCM de um usuário.
 *
 * @param {string} userId - ID do usuário
 * @return {Promise<string | null>} Token ou null
 */
async function getUserFcmToken(
  userId: string
): Promise<string | null> {
  try {
    const userDoc = await getDb()
      .collection("users")
      .doc(userId)
      .get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    return (
      userData?.fcm_token ||
      userData?.fcmToken ||
      null
    );
  } catch (e) {
    console.error(
      "Erro ao buscar token FCM do usuario " +
      userId + ":",
      e
    );
    return null;
  }
}

/**
 * Busca tokens FCM de múltiplos usuários com
 * mapeamento token->userId.
 *
 * @param {string[]} userIds - IDs dos usuários
 * @return {Promise<TokenUserMapping[]>} Mapeamentos
 */
async function getUserFcmTokensWithMapping(
  userIds: string[]
): Promise<TokenUserMapping[]> {
  const mappings: TokenUserMapping[] = [];
  const chunks: string[][] = [];

  for (let i = 0; i < userIds.length; i += FIRESTORE_WHERE_IN_LIMIT) { // eslint-disable-line max-len
    chunks.push(userIds.slice(i, i + FIRESTORE_WHERE_IN_LIMIT));
  }

  for (const chunk of chunks) {
    try {
      const snapshot = await getDb()
        .collection("users")
        .where(
          admin.firestore.FieldPath.documentId(),
          "in",
          chunk
        )
        .get();

      snapshot.docs.forEach(
        (doc: admin.firestore.QueryDocumentSnapshot) => {
          const data = doc.data();
          const token =
            data?.fcm_token || data?.fcmToken;
          if (token) {
            mappings.push({token, userId: doc.id});
          }
        }
      );
    } catch (e) {
      console.error(
        "Erro ao buscar tokens em lote:",
        e
      );
    }
  }

  return mappings;
}

/**
 * Envia notificação FCM para um único usuário.
 *
 * @param {string} userId - ID do usuário
 * @param {FcmNotification} notification - Dados
 * @return {Promise<boolean>} true se enviou
 */
export async function sendNotificationToUser(
  userId: string,
  notification: FcmNotification
): Promise<boolean> {
  const token = await getUserFcmToken(userId);
  if (!token) {
    console.log(
      "Usuario " + userId + " nao tem token FCM"
    );
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
        clickAction:
          notification.data?.action ||
          "FLUTTER_NOTIFICATION_CLICK",
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
    console.log(
      `Notificacao enviada para ${userId}`
    );
    return true;
  }

  // Tratar erros de token inválido
  if (
    result.error &&
    isInvalidTokenError(result.error)
  ) {
    console.log(
      `Token invalido para ${userId}, limpando...`
    );
    await removeInvalidToken(userId, token);
  } else if (result.error) {
    console.error(
      `Erro ao enviar notificacao para ${userId}:`,
      result.error
    );
  }

  return false;
}

/**
 * Envia notificação FCM para múltiplos usuários.
 *
 * @param {string[]} userIds - IDs dos usuários
 * @param {FcmNotification} notification - Dados
 * @return {Promise<number>} Quantidade enviada
 */
export async function sendNotificationToUsers(
  userIds: string[],
  notification: FcmNotification
): Promise<number> {
  if (userIds.length === 0) return 0;

  // Buscar tokens com mapeamento
  const tokenMappings =
    await getUserFcmTokensWithMapping(userIds);
  if (tokenMappings.length === 0) {
    console.log("Nenhum token FCM encontrado");
    return 0;
  }

  // Criar mapa de token -> userId
  const tokenToUserMap = new Map<string, string>();
  tokenMappings.forEach((m) =>
    tokenToUserMap.set(m.token, m.userId)
  );

  const tokens = tokenMappings.map((m) => m.token);

  // Dividir em chunks de 500 (limite do FCM)
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  let totalSuccess = 0;
  const invalidTokensToRemove: {
    token: string;
    userId: string;
  }[] = [];
  const transientFailures: {
    token: string;
    userId: string;
  }[] = [];

  for (const chunk of chunks) {
    try {
      const message:
        admin.messaging.MulticastMessage = {
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

      const messaging = getFcm() as {
        sendEachForMulticast: (
          payload: admin.messaging.MulticastMessage
        ) => Promise<admin.messaging.BatchResponse>;
      };
      const response =
        await messaging.sendEachForMulticast(message);
      totalSuccess += response.successCount;

      // Processar falhas individuais
      if (response.failureCount > 0) {
        console.log(
          `Multicast: ${response.successCount}` +
          ` sucesso, ${response.failureCount}` +
          " falhas"
        );

        response.responses.forEach(
          (sendResponse: admin.messaging.SendResponse,
            index: number) => {
            if (
              !sendResponse.success &&
              sendResponse.error
            ) {
              const failedToken = chunk[index];
              const uid =
                tokenToUserMap.get(failedToken);
              const errorCode =
                sendResponse.error.code || "unknown";

              if (uid) {
                if (
                  isInvalidTokenError(
                    sendResponse.error
                  )
                ) {
                  console.log(
                    "Token invalido detectado" +
                    ` (${errorCode})` +
                    ` para usuario ${uid}`
                  );
                  invalidTokensToRemove.push({
                    token: failedToken,
                    userId: uid,
                  });
                } else if (
                  isTransientError(
                    sendResponse.error
                  )
                ) {
                  console.log(
                    "Erro transiente" +
                    ` (${errorCode})` +
                    ` para usuario ${uid},` +
                    " agendando retry"
                  );
                  transientFailures.push({
                    token: failedToken,
                    userId: uid,
                  });
                } else {
                  console.error(
                    "Falha ao enviar para" +
                    ` usuario ${uid}:` +
                    ` ${errorCode} -` +
                    ` ${sendResponse.error.message}`
                  );
                }
              }
            }
          }
        );
      }
    } catch (e) {
      console.error(
        "Erro ao enviar multicast:",
        e
      );
    }
  }

  // Limpar tokens inválidos em paralelo
  if (invalidTokensToRemove.length > 0) {
    console.log(
      `Removendo ${invalidTokensToRemove.length}` +
      " tokens invalidos..."
    );
    await Promise.all(
      invalidTokensToRemove.map(({token, userId}) =>
        removeInvalidToken(userId, token)
      )
    );
  }

  // Retry para falhas transientes
  if (transientFailures.length > 0) {
    console.log(
      "Tentando retry para" +
      ` ${transientFailures.length}` +
      " falhas transientes..."
    );

    for (const {token, userId} of transientFailures) {
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

      const result =
        await sendWithRetry(retryMessage);

      if (result.success) {
        console.log(
          "Retry bem-sucedido para" +
          ` usuario ${userId}`
        );
        totalSuccess++;
      } else if (
        result.error &&
        isInvalidTokenError(result.error)
      ) {
        console.log(
          "Token invalido detectado no" +
          ` retry para usuario ${userId}`
        );
        await removeInvalidToken(userId, token);
      } else {
        console.error(
          `Retry falhou para usuario ${userId}:` +
          ` ${result.error?.message ||
            "erro desconhecido"}`
        );
      }
    }
  }

  console.log(
    "Total de notificacoes enviadas com" +
    ` sucesso: ${totalSuccess}`
  );
  return totalSuccess;
}

/**
 * Salva notificação no Firestore para histórico.
 *
 * @param {string} userId - ID do usuário
 * @param {NotificationPayload} payload - Dados
 * @return {Promise<string>} ID da notificação
 */
export async function saveNotificationToFirestore(
  userId: string,
  payload: NotificationPayload
): Promise<string> {
  const notificationRef = getDb()
    .collection("notifications")
    .doc();

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
    created_at:
      admin.firestore.FieldValue.serverTimestamp(),
  });

  return notificationRef.id;
}

/**
 * Envia e salva notificação para um usuário.
 *
 * @param {string} userId - ID do usuário
 * @param {NotificationPayload} payload - Dados
 * @return {Promise<boolean>} true se enviou
 */
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
