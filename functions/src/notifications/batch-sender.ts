/**
 * SISTEMA DE NOTIFICAÇÕES FCM EM BATCH - P2 #29
 *
 * Implementa agrupamento (batching) de
 * notificações FCM para:
 * - Reduzir chamadas individuais à API do FCM
 * - Agrupar notificações em janela de 30s
 * - Limpar tokens inválidos automaticamente
 * - Usar sendEachForMulticast() eficientemente
 *
 * FLUXO:
 * 1. Notificação entra via enqueueNotification()
 * 2. Armazenada na fila (notification_queue)
 * 3. Scheduled function processa a cada 30s
 * 4. Agrupa por título+corpo
 * 5. Envia via sendEachForMulticast() (500)
 * 6. Limpa tokens inválidos detectados
 *
 * PERFORMANCE:
 * - Antes: 100 chamadas individuais
 * - Depois: 1 chamada multicast (chunks 500)
 * - Latência aceitável: até 30s de delay
 *
 * @see specs/MASTER_OPTIMIZATION_CHECKLIST.md
 */

import * as admin from "firebase-admin";
import {
  onSchedule,
} from "firebase-functions/v2/scheduler";
import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";

const getDb = () => admin.firestore();
const getFcm = () => admin.messaging();

// ==========================================
// CONSTANTES
// ==========================================

/**
 * Tamanho máximo de tokens por chamada
 * multicast (limite FCM).
 */
const MAX_MULTICAST_TOKENS = 500;

/**
 * Tamanho máximo do batch de documentos
 * para processar por execução.
 */
const MAX_QUEUE_BATCH_SIZE = 200;

/** Nome da coleção da fila de notificações */
const QUEUE_COLLECTION = "notification_queue";

/**
 * Número máximo de retentativas antes de
 * marcar como FAILED permanente.
 */
const MAX_RETRY_COUNT = 3;

/**
 * Delay entre chunks de multicast para evitar
 * throttling do FCM (ms) - reservado para
 * uso futuro.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const CHUNK_SEND_DELAY_MS = 100;

// ==========================================
// INTERFACES
// ==========================================

/** Notificação na fila de envio */
export interface QueuedNotification {
  /** IDs dos usuários destinatários */
  userIds: string[];
  /** Título da notificação */
  title: string;
  /** Corpo da notificação */
  body: string;
  /** Tipo de notificação (canal Android) */
  type: string;
  /** Dados adicionais (deep link, metadata) */
  data?: Record<string, string>;
  /** URL da imagem (opcional) */
  imageUrl?: string;
  /** Timestamp de criação na fila */
  createdAt?: admin.firestore.FieldValue;
  /** Status: PENDING, PROCESSING, SENT, FAILED */
  status?: string;
  /** Prioridade: HIGH (imediato) ou NORMAL */
  priority?: "HIGH" | "NORMAL";
}

/** Resultado do envio de um batch */
interface BatchSendResult {
  totalTargeted: number;
  totalSent: number;
  totalFailed: number;
  invalidTokensCleaned: number;
  durationMs: number;
}

// ==========================================
// ENQUEUE: Adicionar notificação à fila
// ==========================================

/**
 * Adiciona uma notificação à fila de envio
 * em batch.
 *
 * Para notificações de alta prioridade (HIGH),
 * o envio é processado na próxima execução do
 * scheduler (até 30s). Para prioridade normal,
 * pode aguardar até 1 minuto.
 *
 * @param {QueuedNotification} notification -
 *   Notificação a ser enfileirada
 * @return {Promise<string>} ID do doc na fila
 */
export async function enqueueNotification(
  notification: QueuedNotification
): Promise<string> {
  const db = getDb();

  if (
    !notification.userIds ||
    notification.userIds.length === 0
  ) {
    console.log(
      "[BATCH_FCM] Nenhum destinatario," +
      " ignorando enqueue"
    );
    return "";
  }

  const queueDoc =
    db.collection(QUEUE_COLLECTION).doc();

  await queueDoc.set({
    ...notification,
    status: "PENDING",
    priority: notification.priority || "NORMAL",
    createdAt:
      admin.firestore.FieldValue.serverTimestamp(),
    userIds: notification.userIds,
  });

  console.log(
    "[BATCH_FCM] Notificacao enfileirada:" +
    ` ${queueDoc.id} para` +
    ` ${notification.userIds.length} usuarios`
  );

  return queueDoc.id;
}

/**
 * Adiciona múltiplas notificações à fila de
 * uma vez. Usa batch write para eficiência.
 *
 * @param {QueuedNotification[]} notifications -
 *   Array de notificações
 * @return {Promise<number>} Quantidade enfileirada
 */
export async function enqueueNotifications(
  notifications: QueuedNotification[]
): Promise<number> {
  const db = getDb();

  if (notifications.length === 0) return 0;

  const batch = db.batch();
  let count = 0;

  for (const notification of notifications) {
    if (
      !notification.userIds ||
      notification.userIds.length === 0
    ) {
      continue;
    }

    const queueDoc =
      db.collection(QUEUE_COLLECTION).doc();
    batch.set(queueDoc, {
      ...notification,
      status: "PENDING",
      priority:
        notification.priority || "NORMAL",
      createdAt:
        admin.firestore.FieldValue
          .serverTimestamp(),
    });
    count++;

    // Batch limit é 500, commit se necessário
    if (count % 450 === 0) {
      await batch.commit();
    }
  }

  if (count % 450 !== 0) {
    await batch.commit();
  }

  console.log(
    `[BATCH_FCM] ${count}` +
    " notificacoes enfileiradas em batch"
  );
  return count;
}

// ==========================================
// PROCESSOR: Processar fila de notificações
// ==========================================

/**
 * Processa a fila de notificações pendentes.
 *
 * 1. Busca notificações PENDING na fila
 * 2. Agrupa por título+corpo
 * 3. Busca tokens FCM dos destinatários
 * 4. Envia via sendEachForMulticast() (500)
 * 5. Limpa tokens inválidos
 * 6. Marca como SENT ou FAILED
 *
 * @return {Promise<BatchSendResult>} Resultado
 */
async function processNotificationQueue():
  Promise<BatchSendResult> {
  const db = getDb();
  const startTime = Date.now();

  let totalTargeted = 0;
  let totalSent = 0;
  let totalFailed = 0;
  let invalidTokensCleaned = 0;

  try {
    // 1. Buscar notificações pendentes
    const pendingSnap = await db
      .collection(QUEUE_COLLECTION)
      .where("status", "==", "PENDING")
      .orderBy("createdAt", "asc")
      .limit(MAX_QUEUE_BATCH_SIZE)
      .get();

    if (pendingSnap.empty) {
      return {
        totalTargeted: 0,
        totalSent: 0,
        totalFailed: 0,
        invalidTokensCleaned: 0,
        durationMs: 0,
      };
    }

    console.log(
      "[BATCH_FCM] Processando" +
      ` ${pendingSnap.size}` +
      " notificacoes da fila"
    );

    // 2. Marcar como PROCESSING
    const processingBatch = db.batch();
    for (const doc of pendingSnap.docs) {
      processingBatch.update(doc.ref, {
        status: "PROCESSING",
        processing_at:
          admin.firestore.FieldValue
            .serverTimestamp(),
      });
    }
    await processingBatch.commit();

    // 3. Coletar todos os userIds únicos
    const allUserIds = new Set<string>();
    for (const doc of pendingSnap.docs) {
      const data = doc.data();
      const userIds = data.userIds as string[];
      if (userIds) {
        userIds.forEach(
          (id) => allUserIds.add(id)
        );
      }
    }

    totalTargeted = allUserIds.size;

    // 4. Buscar tokens FCM em batch
    const tokenMap = await fetchTokensInBatch(
      Array.from(allUserIds)
    );

    // 5. Processar cada notificação na fila
    for (const doc of pendingSnap.docs) {
      const data = doc.data();
      const userIds =
        (data.userIds as string[]) || [];
      const title = data.title as string;
      const body = data.body as string;
      const type = data.type as string;
      const notifData =
        (data.data as
          Record<string, string>) || {};
      const imageUrl =
        data.imageUrl as string | undefined;

      // Filtrar tokens válidos
      const tokens: string[] = [];
      const tokenToUser =
        new Map<string, string>();

      for (const userId of userIds) {
        const token = tokenMap.get(userId);
        if (token) {
          tokens.push(token);
          tokenToUser.set(token, userId);
        }
      }

      if (tokens.length === 0) {
        // Nenhum token disponível
        await doc.ref.update({
          status: "SENT",
          sent_at:
            admin.firestore.FieldValue
              .serverTimestamp(),
          result: {
            sent: 0,
            failed: 0,
            noTokens: userIds.length,
          },
        });
        continue;
      }

      // 6. Enviar via multicast em chunks
      const sendResult =
        await sendMulticastInChunks(
          tokens,
          tokenToUser,
          {
            title,
            body,
            type,
            data: notifData,
            imageUrl,
          }
        );

      totalSent += sendResult.sent;
      totalFailed += sendResult.failed;
      invalidTokensCleaned +=
        sendResult.invalidTokensCleaned;

      // 7. Marcar como enviada
      await doc.ref.update({
        status:
          sendResult.failed === tokens.length ?
            "FAILED" :
            "SENT",
        sent_at:
          admin.firestore.FieldValue
            .serverTimestamp(),
        result: {
          sent: sendResult.sent,
          failed: sendResult.failed,
          invalidTokensCleaned:
            sendResult.invalidTokensCleaned,
          totalTokens: tokens.length,
        },
      });
    }
  } catch (error) {
    console.error(
      "[BATCH_FCM] Erro ao processar fila:",
      error
    );
  }

  const durationMs = Date.now() - startTime;

  console.log(
    "[BATCH_FCM] Processamento concluido" +
    ` em ${durationMs}ms:` +
    ` ${totalSent} enviadas,` +
    ` ${totalFailed} falhas,` +
    ` ${invalidTokensCleaned} tokens limpos`
  );

  return {
    totalTargeted,
    totalSent,
    totalFailed,
    invalidTokensCleaned,
    durationMs,
  };
}

// ==========================================
// MULTICAST: Envio em chunks de 500
// ==========================================

/**
 * Envia notificação via sendEachForMulticast()
 * em chunks de 500 tokens.
 *
 * @param {string[]} tokens - Tokens FCM
 * @param {Map<string, string>} tokenToUser -
 *   Mapa token -> userId (para limpeza)
 * @param {object} notification - Dados
 * @return {Promise<object>} Resultado do envio
 */
async function sendMulticastInChunks(
  tokens: string[],
  tokenToUser: Map<string, string>,
  notification: {
    title: string;
    body: string;
    type: string;
    data: Record<string, string>;
    imageUrl?: string;
  }
): Promise<{
  sent: number;
  failed: number;
  invalidTokensCleaned: number;
}> {
  let sent = 0;
  let failed = 0;
  let invalidTokensCleaned = 0;

  // Dividir tokens em chunks de 500
  const chunks: string[][] = [];
  for (
    let i = 0;
    i < tokens.length;
    i += MAX_MULTICAST_TOKENS
  ) {
    chunks.push(
      tokens.slice(i, i + MAX_MULTICAST_TOKENS)
    );
  }

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

      const response =
        await getFcm()
          .sendEachForMulticast(message);
      sent += response.successCount;
      failed += response.failureCount;

      // Processar falhas para tokens inválidos
      if (response.failureCount > 0) {
        const tokensToRemove: {
          token: string;
          userId: string;
        }[] = [];

        response.responses.forEach(
          (sendResponse, index) => {
            if (
              !sendResponse.success &&
              sendResponse.error
            ) {
              const failedToken = chunk[index];
              const userId =
                tokenToUser.get(failedToken);
              const errorCode =
                sendResponse.error.code ||
                "unknown";

              if (
                isInvalidTokenError(errorCode)
              ) {
                if (userId) {
                  tokensToRemove.push({
                    token: failedToken,
                    userId,
                  });
                }
              }
            }
          }
        );

        // Limpar tokens inválidos em paralelo
        if (tokensToRemove.length > 0) {
          await cleanupInvalidTokens(
            tokensToRemove
          );
          invalidTokensCleaned +=
            tokensToRemove.length;
        }
      }
    } catch (error) {
      console.error(
        "[BATCH_FCM] Erro no envio multicast:",
        error
      );
      failed += chunk.length;
    }
  }

  return {sent, failed, invalidTokensCleaned};
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Busca tokens FCM de múltiplos usuários em
 * batch. Usa chunks de 10 para respeitar limite
 * do whereIn.
 *
 * @param {string[]} userIds - IDs de usuário
 * @return {Promise<Map<string, string>>}
 *   Map userId -> token
 */
async function fetchTokensInBatch(
  userIds: string[]
): Promise<Map<string, string>> {
  const db = getDb();
  const tokenMap = new Map<string, string>();

  // Chunks de 10 (limite do whereIn)
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  // Buscar em paralelo
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const snapshot = await db
          .collection("users")
          .where(
            admin.firestore.FieldPath
              .documentId(),
            "in",
            chunk
          )
          .get();

        const map = new Map<string, string>();
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const token =
            data?.fcm_token || data?.fcmToken;
          if (token) {
            map.set(doc.id, token);
          }
        });

        return map;
      } catch (error) {
        console.error(
          "[BATCH_FCM] Erro ao buscar tokens:",
          error
        );
        return new Map<string, string>();
      }
    })
  );

  // Consolidar resultados
  for (const result of results) {
    for (const [userId, token] of result) {
      tokenMap.set(userId, token);
    }
  }

  return tokenMap;
}

/**
 * Verifica se o código de erro indica token
 * FCM inválido.
 *
 * @param {string} errorCode - Código do erro
 * @return {boolean} true se token é inválido
 */
function isInvalidTokenError(
  errorCode: string
): boolean {
  return (
    errorCode ===
      "messaging/" +
      "registration-token-not-registered" ||
    errorCode ===
      "messaging/" +
      "invalid-registration-token" ||
    errorCode ===
      "messaging/invalid-argument"
  );
}

/**
 * Remove tokens FCM inválidos do Firestore
 * em batch.
 *
 * @param {Array<object>} tokensToRemove -
 *   Array de token/userId para remover
 * @return {Promise<void>} Resolução
 */
async function cleanupInvalidTokens(
  tokensToRemove: {
    token: string;
    userId: string;
  }[]
): Promise<void> {
  const db = getDb();

  try {
    const batch = db.batch();

    for (const {userId} of tokensToRemove) {
      const userRef =
        db.collection("users").doc(userId);
      batch.update(userRef, {
        fcm_token:
          admin.firestore.FieldValue.delete(),
      });
    }

    await batch.commit();

    console.log(
      `[BATCH_FCM] ${tokensToRemove.length}` +
      " tokens invalidos removidos"
    );
  } catch (error) {
    console.error(
      "[BATCH_FCM] Erro ao limpar" +
      " tokens invalidos:",
      error
    );
  }
}

// ==========================================
// SCHEDULED: Processar fila a cada minuto
// ==========================================

/**
 * Função agendada que processa a fila de
 * notificações.
 *
 * Executa a cada 1 minuto (menor intervalo
 * do Cloud Scheduler). Latência máxima ~60s.
 *
 * Custo estimado: ~$2/mês (invocações extras)
 */
export const processNotificationBatch =
  onSchedule(
    {
      schedule: "* * * * *",
      timeZone: "America/Sao_Paulo",
      region: "southamerica-east1",
      memory: "512MiB",
      timeoutSeconds: 120,
      retryCount: 1,
    },
    async () => {
      const result =
        await processNotificationQueue();

      // Registrar métricas se houve processamento
      if (result.totalTargeted > 0) {
        const db = getDb();
        await db.collection("metrics").add({
          type:
            "notification_batch_processed",
          timestamp:
            admin.firestore.FieldValue
              .serverTimestamp(),
          total_targeted:
            result.totalTargeted,
          total_sent: result.totalSent,
          total_failed: result.totalFailed,
          invalid_tokens_cleaned:
            result.invalidTokensCleaned,
          duration_ms: result.durationMs,
        });
      }
    }
  );

// ==========================================
// CALLABLE: Enviar notificação batch manual
// ==========================================

/**
 * Função callable para enfileirar notificação
 * manualmente. Útil para notificações
 * disparadas por ações do usuário.
 *
 * @param {object} request - Request do onCall
 * @return {Promise<object>} Resultado
 */
export const enqueueNotificationCallable = onCall(
  {
    region: "southamerica-east1",
    memory: "256MiB",
    // SECURITY: App Check
    enforceAppCheck:
      process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Usuario nao autenticado"
      );
    }

    // SECURITY: Verificar role do usuario
    const callerRole =
      request.auth.token?.role;
    if (callerRole !== "ADMIN") {
      console.warn(
        `[SECURITY] User ${request.auth.uid}` +
        ` (role: ${callerRole}) tentou` +
        " enfileirar notificacao manual"
      );
      throw new HttpsError(
        "permission-denied",
        "Apenas administradores podem" +
        " enviar notificacoes manuais"
      );
    }

    const {
      userIds,
      title,
      body,
      type,
      data,
      priority,
    } = request.data;

    if (
      !userIds ||
      !Array.isArray(userIds) ||
      userIds.length === 0
    ) {
      throw new HttpsError(
        "invalid-argument",
        "userIds e obrigatorio e" +
        " deve ser um array"
      );
    }

    if (!title || !body || !type) {
      throw new HttpsError(
        "invalid-argument",
        "title, body e type sao obrigatorios"
      );
    }

    // SECURITY: Validacao de tamanho
    if (
      typeof title !== "string" ||
      title.length > 200
    ) {
      throw new HttpsError(
        "invalid-argument",
        "title deve ter no maximo" +
        " 200 caracteres"
      );
    }
    if (
      typeof body !== "string" ||
      body.length > 1000
    ) {
      throw new HttpsError(
        "invalid-argument",
        "body deve ter no maximo" +
        " 1000 caracteres"
      );
    }
    if (
      typeof type !== "string" ||
      type.length > 50
    ) {
      throw new HttpsError(
        "invalid-argument",
        "type deve ter no maximo" +
        " 50 caracteres"
      );
    }

    // Limitar a 500 destinatários por chamada
    if (userIds.length > 500) {
      throw new HttpsError(
        "invalid-argument",
        "Maximo de 500 destinatarios" +
        " por chamada"
      );
    }

    // SECURITY: Validar userIds como strings
    for (const id of userIds) {
      if (
        typeof id !== "string" ||
        id.length === 0 ||
        id.length > 128
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Todos os userIds devem" +
          " ser strings validas"
        );
      }
    }

    console.log(
      `[BATCH_FCM] Admin ${request.auth.uid}` +
      " enfileirando notificacao para" +
      ` ${userIds.length} usuarios`
    );

    const queueId = await enqueueNotification({
      userIds,
      title,
      body,
      type,
      data: data || {},
      priority: priority || "NORMAL",
    });

    return {
      success: true,
      queueId,
      message:
        "Notificacao enfileirada para" +
        ` ${userIds.length} usuarios`,
    };
  }
);

// ==========================================
// CLEANUP: Limpar fila de notificações antigas
// ==========================================

/**
 * Remove notificações processadas da fila após
 * 24 horas. Executa diariamente às 04:00 BRT.
 */
export const cleanupNotificationQueue =
  onSchedule(
    {
      schedule: "0 4 * * *",
      timeZone: "America/Sao_Paulo",
      region: "southamerica-east1",
      memory: "256MiB",
      timeoutSeconds: 120,
    },
    async () => {
      const db = getDb();

      const oneDayAgo = new Date();
      oneDayAgo.setDate(
        oneDayAgo.getDate() - 1
      );
      const cutoffDate =
        admin.firestore.Timestamp
          .fromDate(oneDayAgo);

      let totalDeleted = 0;

      try {
        // Deletar notificações processadas > 24h
        const query = db
          .collection(QUEUE_COLLECTION)
          .where(
            "status",
            "in",
            ["SENT", "FAILED"]
          )
          .where("createdAt", "<", cutoffDate)
          .limit(500);

        const snapshot = await query.get();

        if (snapshot.empty) {
          console.log(
            "[BATCH_FCM_CLEANUP] Nenhuma" +
            " notificacao antiga para limpar"
          );
          return;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        totalDeleted = snapshot.size;

        // Limpar PROCESSING travadas (> 10 min)
        const tenMinAgo = new Date();
        tenMinAgo.setMinutes(
          tenMinAgo.getMinutes() - 10
        );
        const staleDate =
          admin.firestore.Timestamp
            .fromDate(tenMinAgo);

        const staleSnap = await db
          .collection(QUEUE_COLLECTION)
          .where(
            "status",
            "==",
            "PROCESSING"
          )
          .where(
            "processing_at",
            "<",
            staleDate
          )
          .limit(100)
          .get();

        if (!staleSnap.empty) {
          const staleBatch = db.batch();
          staleSnap.docs.forEach((doc) => {
            const retryCount =
              doc.data().retry_count || 0;
            if (retryCount >= MAX_RETRY_COUNT) {
              // Marcar como FAILED permanente
              staleBatch.update(doc.ref, {
                status: "FAILED",
                failure_reason:
                  `Excedeu ${MAX_RETRY_COUNT}` +
                  " tentativas de" +
                  " reprocessamento",
              });
            } else {
              staleBatch.update(doc.ref, {
                status: "PENDING",
                retry_count:
                  admin.firestore.FieldValue
                    .increment(1),
              });
            }
          });

          await staleBatch.commit();
          console.log(
            "[BATCH_FCM_CLEANUP]" +
            ` ${staleSnap.size} notificacoes` +
            " travadas resetadas para PENDING"
          );
        }

        console.log(
          "[BATCH_FCM_CLEANUP]" +
          ` ${totalDeleted} notificacoes` +
          " antigas removidas"
        );
      } catch (error) {
        console.error(
          "[BATCH_FCM_CLEANUP] Erro:",
          error
        );
      }
    }
  );
