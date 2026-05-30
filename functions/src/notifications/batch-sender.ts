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

import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {
  onSchedule,
} from "firebase-functions/v2/scheduler";
import {
  HttpsError,
} from "firebase-functions/v2/https";
import {
  FCM_MULTICAST_LIMIT,
  FCM_TTL_SECONDS,
  FIRESTORE_WHERE_IN_LIMIT,
  FIRESTORE_PAGINATION_LIMIT,
  FUNCTION_REGION,
} from "../constants";
import {
  sanitizeText,
} from "../validation/index";
import {
  secureCallable,
} from "../middleware/secure-callable-wrapper";
import {
  shouldNotifyUser,
  isTransientError,
  // FIX #2199: reusa a versão canônica em helpers.ts (removida a duplicata local).
  isInvalidTokenError,
} from "./helpers";

const getDb = () => admin.firestore();
const getFcm = () => admin.messaging();

// ==========================================
// CONSTANTES
// ==========================================

/**
 * Tamanho máximo de tokens por chamada
 * multicast (limite FCM) - de constants.ts.
 */
const MAX_MULTICAST_TOKENS = FCM_MULTICAST_LIMIT;

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
    logger.info(
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

  logger.info(
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

  // FIX #787: WriteBatch reuse após commit causa silent drop.
  // Sempre criar novo batch após commit (após cada 450 ops).
  let currentBatch = db.batch();
  let batchOpCount = 0;
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
    currentBatch.set(queueDoc, {
      ...notification,
      status: "PENDING",
      priority:
        notification.priority || "NORMAL",
      createdAt:
        admin.firestore.FieldValue
          .serverTimestamp(),
    });
    count++;
    batchOpCount++;

    // Batch limit é 500 — commit e criar NOVO batch
    if (batchOpCount >= 450) {
      await currentBatch.commit();
      currentBatch = db.batch();
      batchOpCount = 0;
    }
  }

  if (batchOpCount > 0) {
    await currentBatch.commit();
  }

  logger.info(
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

    logger.info(
      "[BATCH_FCM] Processando" +
      ` ${pendingSnap.size}` +
      " notificacoes da fila"
    );

    // 2. Reivindicar (claim) cada doc de forma ATÔMICA via transaction.
    // FIX #2324: o claim PENDING→PROCESSING precisa ser compare-and-swap.
    // Antes era um batch.update() não-transacional: entre o .get() (passo 1)
    // e o commit, outra instância concorrente podia ler os MESMOS docs PENDING
    // e enviar push DUPLICADO. Agora cada doc é reivindicado dentro de uma
    // transaction que relê o status: se já != PENDING (outra instância pegou,
    // ou já foi SENT/PROCESSING), pula. Só os docs efetivamente reivindicados
    // por ESTA execução seguem para envio (idempotência garantida mesmo com
    // overlap). O conteúdo do doc (userIds/title/body) é imutável, então
    // reusamos o snapshot do passo 1 — apenas `status` importa para o claim.
    const claimedDocs:
      admin.firestore.QueryDocumentSnapshot[] = [];
    for (const doc of pendingSnap.docs) {
      try {
        const claimed = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(doc.ref);
          if (!fresh.exists) return false;
          if (fresh.data()?.status !== "PENDING") {
            // Já reivindicado por outra execução (ou já processado): pular.
            return false;
          }
          tx.update(doc.ref, {
            status: "PROCESSING",
            processing_at:
              admin.firestore.FieldValue
                .serverTimestamp(),
          });
          return true;
        });
        if (claimed) {
          claimedDocs.push(doc);
        }
      } catch (claimError) {
        // Falha transitória no claim: não reivindica este doc nesta execução.
        // Permanece PENDING e será reprocessado na próxima passada.
        logger.warn(
          `[BATCH_FCM] Falha ao reivindicar doc ${doc.id}:`,
          claimError
        );
      }
    }

    if (claimedDocs.length === 0) {
      logger.info(
        "[BATCH_FCM] Nenhum doc reivindicado nesta execucao" +
        " (provavel concorrencia) — encerrando"
      );
      return {
        totalTargeted: 0,
        totalSent: 0,
        totalFailed: 0,
        invalidTokensCleaned: 0,
        durationMs: Date.now() - startTime,
      };
    }

    if (claimedDocs.length < pendingSnap.size) {
      logger.info(
        `[BATCH_FCM] Reivindicados ${claimedDocs.length}` +
        ` de ${pendingSnap.size} docs` +
        " (demais ja reivindicados por outra execucao)"
      );
    }

    // 3. Coletar todos os userIds únicos (apenas dos docs reivindicados)
    const allUserIds = new Set<string>();
    for (const doc of claimedDocs) {
      const data = doc.data();
      const userIds = data.userIds as string[];
      if (userIds) {
        userIds.forEach(
          (id) => allUserIds.add(id)
        );
      }
    }

    totalTargeted = allUserIds.size;

    // 4. Buscar tokens FCM em batch para todos os usuários únicos.
    // O filtro de preferências é aplicado por doc (dentro do loop),
    // pois a fila é multi-tipo e cada doc tem seu próprio type/groupId.
    // FIX #1282: bloco centralizado com docs[0].type removido — era tipo único para fila multi-tipo.
    const tokenMap = await fetchTokensInBatch(
      Array.from(allUserIds)
    );

    // 5. Processar cada notificação reivindicada por esta execução.
    // FIX #2324: itera sobre claimedDocs (não pendingSnap.docs) — assim docs
    // que outra instância concorrente reivindicou NÃO são reenviados aqui.
    for (const doc of claimedDocs) {
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

      // FIX #1282: filtrar preferências de notificação por doc,
      // usando o type e groupId corretos deste doc específico.
      // Fail-open: em caso de erro na verificação, inclui o usuário.
      const docGroupId = notifData?.groupId;
      const filteredDocUserIds: string[] = [];
      for (const uid of userIds) {
        try {
          const ok = await shouldNotifyUser(uid, type, docGroupId);
          if (ok) filteredDocUserIds.push(uid);
        } catch {
          filteredDocUserIds.push(uid);
        }
      }
      const skippedCount = userIds.length - filteredDocUserIds.length;
      if (skippedCount > 0) {
        logger.info(
          `[BATCH_FCM] Filtrados ${skippedCount} usuarios ` +
          `por preferencias (tipo: ${type}, doc: ${doc.id})`
        );
      }
      totalTargeted =
        totalTargeted - userIds.length + filteredDocUserIds.length;

      // Filtrar tokens válidos — inclui todos os tokens por usuário
      // para suportar múltiplos dispositivos (#978)
      const tokens: string[] = [];
      const tokenToUser =
        new Map<string, string>();

      for (const userId of filteredDocUserIds) {
        const userTokens = tokenMap.get(userId);
        if (userTokens && userTokens.length > 0) {
          for (const token of userTokens) {
            tokens.push(token);
            tokenToUser.set(token, userId);
          }
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

      const hasTransientFailures =
        sendResult.transientFailed > 0;
      const allFailed =
        sendResult.failed === tokens.length &&
        sendResult.transientFailed === tokens.length;

      await doc.ref.update({
        status: allFailed ? "FAILED" :
          hasTransientFailures ? "PENDING" : "SENT",
        sent_at:
          admin.firestore.FieldValue
            .serverTimestamp(),
        result: {
          sent: sendResult.sent,
          failed: sendResult.failed,
          transientFailed: sendResult.transientFailed,
          invalidTokensCleaned:
            sendResult.invalidTokensCleaned,
          totalTokens: tokens.length,
        },
      });
    }
  } catch (error) {
    logger.error(
      "[BATCH_FCM] Erro ao processar fila:",
      error
    );
  }

  const durationMs = Date.now() - startTime;

  logger.info(
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
  transientFailed: number;
  invalidTokensCleaned: number;
}> {
  let sent = 0;
  let failed = 0;
  let transientFailed = 0;
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

      const messaging = getFcm() as {
        sendEachForMulticast: (
          payload: admin.messaging.MulticastMessage
        ) => Promise<admin.messaging.BatchResponse>;
      };
      const response =
        await messaging.sendEachForMulticast(message);
      sent += response.successCount;
      failed += response.failureCount;

      // Processar falhas para tokens invalidos e transientes
      if (response.failureCount > 0) {
        const tokensToRemove: {
          token: string;
          userId: string;
        }[] = [];

        response.responses.forEach(
          (sendResponse: admin.messaging.SendResponse,
            index: number) => {
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
                // FIX #2199: passa o objeto de erro (helpers extrai .code).
                isInvalidTokenError({code: errorCode})
              ) {
                if (userId) {
                  tokensToRemove.push({
                    token: failedToken,
                    userId,
                  });
                }
              } else if (
                isTransientError(sendResponse.error as {code?: string; message?: string})
              ) {
                logger.warn(
                  `[BATCH_FCM] Transient FCM error for token ${failedToken.slice(0, 8)}...: ${errorCode}`
                );
                transientFailed++;
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

        // Transient errors are tracked separately — they should be retried,
        // not counted as permanent failures.
        failed -= transientFailed;
      }
    } catch (error) {
      logger.error(
        "[BATCH_FCM] Erro no envio multicast:",
        error
      );
      failed += chunk.length;
    }
  }

  return {sent, failed, transientFailed, invalidTokensCleaned};
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Busca todos os tokens FCM de múltiplos usuários
 * em batch. Retorna todos os tokens do usuário
 * (fcmTokens array + campos legados fcm_token/fcmToken)
 * para suportar usuários com múltiplos dispositivos.
 * Usa chunks de 10 para respeitar limite do whereIn.
 *
 * @param {string[]} userIds - IDs de usuário
 * @return {Promise<Map<string, string[]>>}
 *   Map userId -> lista de todos os tokens
 */
async function fetchTokensInBatch(
  userIds: string[]
): Promise<Map<string, string[]>> {
  const db = getDb();
  const tokenMap = new Map<string, string[]>();

  // Chunks de 10 (limite do whereIn)
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += FIRESTORE_WHERE_IN_LIMIT) { // eslint-disable-line max-len
    chunks.push(userIds.slice(i, i + FIRESTORE_WHERE_IN_LIMIT));
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

        const map = new Map<string, string[]>();
        snapshot.docs.forEach((doc) => {
          const data =
            doc.data() as Record<string, unknown>;
          // Coleta todos os tokens únicos do usuário:
          // fcmTokens array (web) + campos legados escalares
          const tokens = new Set<string>();
          const arr = data?.fcmTokens;
          if (Array.isArray(arr)) {
            (arr as string[]).forEach((t) => {
              if (t) tokens.add(t);
            });
          }
          const legacyToken =
            (data?.fcm_token as string | undefined) ||
            (data?.fcmToken as string | undefined);
          if (legacyToken) tokens.add(legacyToken);

          if (tokens.size > 0) {
            map.set(doc.id, Array.from(tokens));
          }
        });

        return map;
      } catch (error) {
        logger.error(
          "[BATCH_FCM] Erro ao buscar tokens:",
          error
        );
        return new Map<string, string[]>();
      }
    })
  );

  // Consolidar resultados
  for (const result of results) {
    for (const [userId, tokens] of result) {
      tokenMap.set(userId, tokens);
    }
  }

  return tokenMap;
}

/**
 * Remove tokens FCM inválidos do Firestore
 * em batch. Limpa todos os campos onde o token
 * pode estar: fcm_token, fcmToken (escalares)
 * e fcmTokens (array).
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

  // Buscar docs para saber quais campos deletar
  const userIds = [
    ...new Set(tokensToRemove.map((t) => t.userId)),
  ];
  const userDocs = new Map<
    string,
    Record<string, unknown>
  >();

  try {
    const chunks: string[][] = [];
    for (let i = 0; i < userIds.length; i += 10) {
      chunks.push(userIds.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      const snap = await db.collection("users")
        .where(
          admin.firestore.FieldPath.documentId(),
          "in",
          chunk
        )
        .get();
      snap.docs.forEach((d) =>
        userDocs.set(
          d.id,
          d.data() as Record<string, unknown>
        )
      );
    }
  } catch (err) {
    logger.error(
      "[BATCH_FCM] Erro ao buscar docs para" +
      " cleanup:",
      err
    );
  }

  try {
    const batch = db.batch();

    for (const {token, userId} of tokensToRemove) {
      const userRef =
        db.collection("users").doc(userId);
      const data = userDocs.get(userId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update: Record<string, any> = {};

      if (data?.fcm_token === token) {
        update.fcm_token =
          admin.firestore.FieldValue.delete();
      }
      if (data?.fcmToken === token) {
        update.fcmToken =
          admin.firestore.FieldValue.delete();
      }
      const arr = data?.fcmTokens;
      if (
        Array.isArray(arr) &&
        (arr as string[]).includes(token)
      ) {
        update.fcmTokens =
          admin.firestore.FieldValue.arrayRemove(
            token
          );
      }

      if (Object.keys(update).length > 0) {
        batch.update(userRef, update);
      }
    }

    await batch.commit();

    logger.info(
      `[BATCH_FCM] ${tokensToRemove.length}` +
      " tokens invalidos removidos"
    );
  } catch (error) {
    logger.error(
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
      region: FUNCTION_REGION,
      memory: "512MiB",
      timeoutSeconds: 120,
      retryCount: 1,
      // FIX #2324: serializa execução — impede instâncias concorrentes.
      // Schedule de 1min com timeout de 2min podia sobrepor execuções; com
      // maxInstances:1 o GCFv2 nunca roda duas instâncias deste scheduled
      // function ao mesmo tempo (prevenção barata do push duplicado). O claim
      // atômico via transaction acima é o hardening (defesa em profundidade).
      maxInstances: 1,
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
export const enqueueNotificationCallable = secureCallable(
  {
    appCheck: false,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {
      maxRequests: 30,
      windowMs: 60 * 1000,
      keyPrefix: "enqueue_notif",
    },
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "enqueueNotificationCallable",
      userCount: request.data?.userIds?.length,
    }),
  },
  async (request) => {
    const reqData =
      request.data as Record<string, unknown>;
    const userIds = reqData.userIds;
    const title = reqData.title as string;
    const body = reqData.body as string;
    const type = reqData.type as string;
    const data = reqData.data as
      Record<string, string> | undefined;
    const priority = reqData.priority as
      "HIGH" | "NORMAL" | undefined;

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

    // Sanitizar inputs contra XSS
    const safeTitle = sanitizeText(title);
    const safeBody = sanitizeText(body);

    logger.info(
      `[BATCH_FCM] Admin ${request.auth?.uid || "unknown"}` +
      " enfileirando notificacao para" +
      ` ${userIds.length} usuarios`
    );

    const queueId = await enqueueNotification({
      userIds,
      title: safeTitle,
      body: safeBody,
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
      region: FUNCTION_REGION,
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
          .limit(FIRESTORE_PAGINATION_LIMIT);

        const snapshot = await query.get();

        // FIX #1400: não early-return quando snapshot.empty — o rescue de
        // PROCESSING travadas abaixo precisa rodar SEMPRE, independente de
        // haver SENT/FAILED a limpar. Antes: em apps com baixo volume ou
        // logo após primeira execução, o rescue ficava unreachable e docs
        // PROCESSING ficavam stuck indefinidamente.
        if (!snapshot.empty) {
          const batch = db.batch();
          snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });

          await batch.commit();
          totalDeleted = snapshot.size;
        } else {
          logger.info(
            "[BATCH_FCM_CLEANUP] Nenhuma" +
            " notificacao antiga para limpar"
          );
        }

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
          logger.info(
            "[BATCH_FCM_CLEANUP]" +
            ` ${staleSnap.size} notificacoes` +
            " travadas resetadas para PENDING"
          );
        }

        logger.info(
          "[BATCH_FCM_CLEANUP]" +
          ` ${totalDeleted} notificacoes` +
          " antigas removidas"
        );
      } catch (error) {
        logger.error(
          "[BATCH_FCM_CLEANUP] Erro:",
          error
        );
      }
    }
  );
