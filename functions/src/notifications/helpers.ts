/**
 * HELPERS DE NOTIFICAÇÕES FCM
 * Tipos, constantes e funções auxiliares para
 * envio de notificações push.
 */

import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {FieldValue, FieldPath} from "firebase-admin/firestore";
import {
  FCM_TTL_SECONDS,
  FIRESTORE_WHERE_IN_LIMIT,
} from "../constants";
import {
  getNotificationSettings,
  isMuted,
  isGroupMuted,
  isNotificationTypeEnabled,
} from "./preferences";

import {db} from "../_db";
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
  CHECKIN = "checkin",
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
        logger.info(
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
        logger.error(
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
 * Coleta todos os tokens FCM únicos do documento
 * do usuário — suporta campos legados (fcm_token,
 * fcmToken) e o novo array (fcmTokens).
 *
 * @param {Record<string, unknown>} data - Dados do doc
 * @return {string[]} Lista de tokens únicos
 */
function extractTokensFromUserData(
  data: Record<string, unknown>
): string[] {
  const tokens = new Set<string>();

  // Campos legados (escalares)
  const legacyToken =
    (data?.fcm_token as string | undefined) ||
    (data?.fcmToken as string | undefined);
  if (legacyToken) tokens.add(legacyToken);

  // Novo campo (array — escrito pela web)
  const arr = data?.fcmTokens;
  if (Array.isArray(arr)) {
    (arr as string[]).forEach((t) => {
      if (t) tokens.add(t);
    });
  }

  return Array.from(tokens);
}

/**
 * Remove token FCM inválido do usuário no Firestore.
 * Limpa fcm_token, fcmToken (escalares) e remove
 * o token do array fcmTokens caso exista.
 *
 * @param {string} userId - ID do usuário
 * @param {string} invalidToken - Token FCM inválido
 * @return {Promise<void>} Resolução após remoção
 */
async function removeInvalidToken(
  userId: string,
  invalidToken: string
): Promise<void> {
  try {
    const userDoc = await db()
      .collection("users")
      .doc(userId)
      .get();
    if (!userDoc.exists) return;

    const data =
      userDoc.data() as Record<string, unknown>;
    const allTokens = extractTokensFromUserData(data);

    if (!allTokens.includes(invalidToken)) {
      logger.info(
        "Token invalido nao encontrado para " +
        userId + " — ignorando remocao."
      );
      return;
    }

    logger.info(
      `Removendo token invalido do usuario ${userId}`
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};

    // Limpar campos legados se correspondem
    if (data?.fcm_token === invalidToken) {
      update.fcm_token =
        FieldValue.delete();
    }
    if (data?.fcmToken === invalidToken) {
      update.fcmToken =
        FieldValue.delete();
    }

    // Remover do array fcmTokens
    const arr = data?.fcmTokens;
    if (Array.isArray(arr) &&
        (arr as string[]).includes(invalidToken)) {
      update.fcmTokens =
        FieldValue.arrayRemove(
          invalidToken
        );
    }

    if (Object.keys(update).length > 0) {
      await db()
        .collection("users")
        .doc(userId)
        .update(update);
    }
  } catch (e) {
    logger.error(
      "Erro ao remover token invalido" +
      ` do usuario ${userId}:`,
      e
    );
  }
}

/**
 * Busca todos os tokens FCM de um usuário
 * (escalares legados + array fcmTokens).
 *
 * @param {string} userId - ID do usuário
 * @return {Promise<string[]>} Tokens ou array vazio
 */
async function getUserFcmTokens(
  userId: string
): Promise<string[]> {
  try {
    const userDoc = await db()
      .collection("users")
      .doc(userId)
      .get();
    if (!userDoc.exists) return [];

    const data =
      userDoc.data() as Record<string, unknown>;
    return extractTokensFromUserData(data);
  } catch (e) {
    logger.error(
      "Erro ao buscar tokens FCM do usuario " +
      userId + ":",
      e
    );
    return [];
  }
}

/**
 * FIX #785: Verifica se o usuário deve receber uma notificação,
 * respeitando notification_preferences e mute_groups.
 *
 * @param {string} userId - ID do usuário
 * @param {string} notificationType - Tipo de notificação
 * @param {string | undefined} groupId - ID do grupo (para mute_groups)
 * @return {Promise<boolean>} true se deve notificar
 */
export async function shouldNotifyUser(
  userId: string,
  notificationType: string,
  groupId?: string,
): Promise<boolean> {
  try {
    // FIX #2477: lê o schema canônico (`notification_settings`) via helper
    // único, tolerando snake (web) e camel (android). Antes lia
    // `users.notification_preferences` — campo que NENHUM writer produz, logo
    // todo opt-out era ignorado (regressão recorrente #785/#926/#1143).
    const settings = await getNotificationSettings(userId);
    if (!settings.pushEnabled) return false;
    if (isMuted(settings)) return false;
    if (isGroupMuted(settings, groupId)) return false;
    if (!isNotificationTypeEnabled(settings, notificationType)) return false;
    return true;
  } catch (e) {
    // fail-open: não bloquear notificação em caso de erro de leitura
    logger.error(
      "[NOTIF] shouldNotifyUser erro para " + userId + ":",
      e
    );
    return true;
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
      const snapshot = await db()
        .collection("users")
        .where(
          FieldPath.documentId(),
          "in",
          chunk
        )
        .get();

      snapshot.docs.forEach(
        (doc: admin.firestore.QueryDocumentSnapshot) => {
          const data =
            doc.data() as Record<string, unknown>;
          const tokens =
            extractTokensFromUserData(data);
          tokens.forEach((token) => {
            mappings.push({token, userId: doc.id});
          });
        }
      );
    } catch (e) {
      logger.error(
        "Erro ao buscar tokens em lote:",
        e
      );
    }
  }

  return mappings;
}

/**
 * Busca o contador de notificações não lidas de
 * um usuário para uso no badge APNS.
 *
 * @param {string} userId - ID do usuário
 * @return {Promise<number>} Contagem de não lidas
 */
async function getUnreadCount(
  userId: string
): Promise<number> {
  try {
    const snap = await db()
      .collection("notifications")
      .where("user_id", "==", userId)
      .where("read", "==", false)
      .count()
      .get();
    // O campo .data().count existe na API Admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (snap.data() as any).count ?? 1;
  } catch {
    // Fallback seguro: 1 (indica ao menos uma notif)
    return 1;
  }
}

/**
 * Envia notificação FCM para um único usuário.
 * Lê todos os tokens (legados + array fcmTokens)
 * e envia para cada um.
 *
 * @param {string} userId - ID do usuário
 * @param {FcmNotification} notification - Dados
 * @param {string} [groupId] - ID do grupo (opcional, pra checar mute_groups)
 * @return {Promise<boolean>} true se ao menos
 *   um token recebeu com sucesso
 */
export async function sendNotificationToUser(
  userId: string,
  notification: FcmNotification,
  groupId?: string,
): Promise<boolean> {
  // FIX #785: respeitar notification_preferences e mute_groups
  const shouldSend = await shouldNotifyUser(
    userId,
    notification.type ?? "default",
    groupId,
  );
  if (!shouldSend) {
    logger.info(
      "[NOTIF] Notificação suprimida por preferências do usuário " + userId
    );
    return false;
  }

  const tokens = await getUserFcmTokens(userId);
  if (tokens.length === 0) {
    logger.info(
      "Usuario " + userId + " nao tem token FCM"
    );
    return false;
  }

  // TTL centralizado em constants.ts (FCM_TTL_SECONDS)
  const apnsExpiration =
    String(Math.floor(Date.now() / 1000) + FCM_TTL_SECONDS);

  // Badge APNS dinâmico baseado em não lidas
  const badgeCount = await getUnreadCount(userId);

  let atLeastOneSuccess = false;

  for (const token of tokens) {
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
        ttl: FCM_TTL_SECONDS,
        notification: {
          channelId: notification.type,
          sound: "default",
          clickAction:
            notification.data?.action ||
            "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        headers: {
          "apns-expiration": apnsExpiration,
        },
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body,
            },
            sound: "default",
            badge: badgeCount,
          },
        },
      },
    };

    // Usar retry com exponential backoff
    const result = await sendWithRetry(message);

    if (result.success) {
      logger.info(
        `Notificacao enviada para ${userId}` +
        ` (token ...${token.slice(-8)})`
      );
      atLeastOneSuccess = true;
    } else if (
      result.error &&
      isInvalidTokenError(result.error)
    ) {
      logger.info(
        `Token invalido para ${userId}, limpando...`
      );
      await removeInvalidToken(userId, token);
    } else if (result.error) {
      logger.error(
        `Erro ao enviar notificacao para ${userId}:`,
        result.error
      );
    }
  }

  return atLeastOneSuccess;
}

/**
 * Envia notificação FCM para múltiplos usuários.
 *
 * @param {string[]} userIds - IDs dos usuários
 * @param {FcmNotification} notification - Dados
 * @param {string} [groupId] - ID do grupo (opcional, pra checar mute_groups)
 * @return {Promise<number>} Quantidade enviada
 */
export async function sendNotificationToUsers(
  userIds: string[],
  notification: FcmNotification,
  groupId?: string,
): Promise<number> {
  if (userIds.length === 0) return 0;

  // FIX #785: filtrar usuários que desativaram notificações ou silenciaram o grupo
  const notifType = notification.type ?? "default";
  const filterResults = await Promise.all(
    userIds.map((uid) => shouldNotifyUser(uid, notifType, groupId))
  );
  const filteredUserIds = userIds.filter((_, i) => filterResults[i]);
  if (filteredUserIds.length === 0) {
    logger.info("[NOTIF] Todos os usuários suprimiram este tipo de notificação");
    return 0;
  }

  // Buscar tokens com mapeamento (apenas usuários que devem receber)
  const tokenMappings =
    await getUserFcmTokensWithMapping(filteredUserIds);
  if (tokenMappings.length === 0) {
    logger.info("Nenhum token FCM encontrado");
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

  // TTL centralizado em constants.ts (FCM_TTL_SECONDS)
  const apnsExpiration =
    String(Math.floor(Date.now() / 1000) + FCM_TTL_SECONDS);

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
            ttl: FCM_TTL_SECONDS,
            notification: {
              channelId: notification.type,
              sound: "default",
            },
          },
          apns: {
            headers: {
              "apns-expiration": apnsExpiration,
            },
            payload: {
              aps: {
                // Badge 1 por default no multicast
                // (sem contexto do userId individual)
                badge: 1,
                sound: "default",
              },
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
        logger.info(
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
                  logger.info(
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
                  logger.info(
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
                  logger.error(
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
      logger.error(
        "Erro ao enviar multicast:",
        e
      );
    }
  }

  // Limpar tokens inválidos em paralelo
  if (invalidTokensToRemove.length > 0) {
    logger.info(
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
    logger.info(
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
        logger.info(
          "Retry bem-sucedido para" +
          ` usuario ${userId}`
        );
        totalSuccess++;
      } else if (
        result.error &&
        isInvalidTokenError(result.error)
      ) {
        logger.info(
          "Token invalido detectado no" +
          ` retry para usuario ${userId}`
        );
        await removeInvalidToken(userId, token);
      } else {
        logger.error(
          `Retry falhou para usuario ${userId}:` +
          ` ${result.error?.message ||
            "erro desconhecido"}`
        );
      }
    }
  }

  logger.info(
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
 * @param {string} [docId] - ID determinístico opcional
 *   para idempotência em retries at-least-once
 * @return {Promise<string>} ID da notificação
 */
export async function saveNotificationToFirestore(
  userId: string,
  payload: NotificationPayload,
  docId?: string
): Promise<string> {
  // FIX #2527: docId determinístico permite idempotência em
  // retries at-least-once do Firestore. Quando fornecido, usa
  // set() (não add()) → re-entrega do trigger sobreescreve o
  // mesmo doc em vez de criar duplicata.
  const notificationRef = docId ?
    db().collection("notifications").doc(docId) :
    db().collection("notifications").doc();

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
      FieldValue.serverTimestamp(),
  });

  return notificationRef.id;
}

/**
 * Remove campos PII (email, telefone) do payload
 * de notificação antes de salvar/enviar.
 *
 * @param {NotificationPayload} payload - Payload
 * @return {NotificationPayload} Payload limpo
 */
function stripPiiFields(
  payload: NotificationPayload
): NotificationPayload {
  const piiKeys = [
    "email",
    "phone",
    "phoneNumber",
    "telefone",
    "cpf",
    "address",
    "endereco",
  ] as const;
  const cleaned = {...payload} as Record<string, unknown>;
  for (const key of piiKeys) {
    if (cleaned[key] !== undefined) {
      delete cleaned[key];
    }
  }
  return cleaned as unknown as NotificationPayload;
}

/**
 * Envia e salva notificação para um usuário.
 * Inclui guard contra auto-notificação (B3)
 * e stripping de campos PII (B4).
 *
 * @param {string} userId - ID do usuário
 * @param {NotificationPayload} payload - Dados
 * @param {string} [docId] - ID determinístico opcional
 *   para idempotência em retries at-least-once
 * @return {Promise<boolean>} true se enviou
 */
export async function sendAndSaveNotification(
  userId: string,
  payload: NotificationPayload,
  docId?: string
): Promise<boolean> {
  // B3: Evitar auto-notificacao
  if (payload.senderId && payload.senderId === userId) {
    logger.info(
      "[SELF-NOTIFY] Pulando auto-notificacao" +
      ` para ${userId} (senderId === userId)`
    );
    return false;
  }

  // B4: Remover campos PII antes de persistir/enviar
  const cleanPayload = stripPiiFields(payload);

  // FIX #2527: docId determinístico previne duplicação
  // de notificação em retries at-least-once do Firestore
  await saveNotificationToFirestore(
    userId,
    cleanPayload,
    docId
  );

  return await sendNotificationToUser(userId, {
    title: cleanPayload.title,
    body: cleanPayload.body,
    type: cleanPayload.type,
    data: {
      gameId: cleanPayload.gameId || "",
      groupId: cleanPayload.groupId || "",
      senderId: cleanPayload.senderId || "",
      action: cleanPayload.action || "",
    },
  });
}
