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
import {FieldValue, FieldPath, Timestamp} from "firebase-admin/firestore";
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
  QUEUE_SAFE_BUDGET_MS,
  QUEUE_MAX_RECIPIENTS_PER_DOC,
  QUEUE_STALE_PROCESSING_MS,
} from "../constants";
import {
  sanitizeText,
} from "../validation/index";
import {
  secureCallable,
} from "../middleware/secure-callable-wrapper";
import {
  shouldNotifyWithSettings,
  isTransientError,
  // FIX #2199: reusa a versão canônica em helpers.ts (removida a duplicata local).
  isInvalidTokenError,
  getNotificationSettingsBatch,
} from "./helpers";
import {
  NotificationSettings,
} from "./preferences";
import {
  filterPushTokensByCanonicalOwner,
  getRegisteredPushTokens,
  removeRegisteredPushToken,
} from "./push-token-registry";

import {db as getFirestore} from "../_db";
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
  createdAt?: FieldValue;
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

interface DispatchTokensResult {
  tokens: string[];
  tokenToUser: Map<string, string>;
}

interface ChunkProgress {
  chunkTokens: string[];
  deliveredTokens: string[];
  pendingTokens: string[];
}

interface QueueCheckpoint {
  deliveredTokens: string[];
  pendingTokens: string[];
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
  const db = getFirestore();

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

  // FIX #3941 F3: cap de destinatários por DOC da fila. Sem isto, um doc com
  // muitos userIds faz o update de pending_tokens/delivered_tokens estourar o
  // limite de 1 MiB/doc (INVALID_ARGUMENT), que cai no catch do lote e derruba
  // a execução inteira. Fatiando em N docs de ≤QUEUE_MAX_RECIPIENTS_PER_DOC,
  // qualquer caller (callable ADMIN ou produtor automático) herda o limite.
  // A ~200 bytes/token, 500 destinos ficam bem abaixo de 1 MiB e alinham com o
  // limite de multicast FCM.
  if (notification.userIds.length > QUEUE_MAX_RECIPIENTS_PER_DOC) {
    return enqueueNotificationChunked(notification);
  }

  const queueDoc =
    db.collection(QUEUE_COLLECTION).doc();

  await queueDoc.set({
    ...notification,
    status: "PENDING",
    priority: notification.priority || "NORMAL",
    createdAt:
      FieldValue.serverTimestamp(),
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
 * Fatia uma notificação grande em múltiplos docs da fila, cada um com no máximo
 * QUEUE_MAX_RECIPIENTS_PER_DOC destinatários. Retorna o id do primeiro doc
 * (mantém a assinatura Promise<string> de enqueueNotification para compat).
 *
 * Cada doc herda os mesmos title/body/type/data/priority — o processamento
 * paralelo/a granel da fila trata cada um independentemente. (#3941 F3)
 *
 * @param {QueuedNotification} notification Notificação com >MAX destinatários.
 * @return {Promise<string>} Id do primeiro doc criado.
 */
async function enqueueNotificationChunked(
  notification: QueuedNotification
): Promise<string> {
  const db = getFirestore();
  const userIds = notification.userIds;
  const firstQueueId = db.collection(QUEUE_COLLECTION).doc().id;

  let currentBatch = db.batch();
  let batchOpCount = 0;
  let docCount = 0;
  let firstDocId = "";

  for (
    let i = 0;
    i < userIds.length;
    i += QUEUE_MAX_RECIPIENTS_PER_DOC
  ) {
    const chunk = userIds.slice(
      i,
      i + QUEUE_MAX_RECIPIENTS_PER_DOC
    );
    const queueDoc = docCount === 0 ?
      db.collection(QUEUE_COLLECTION).doc(firstQueueId) :
      db.collection(QUEUE_COLLECTION).doc();

    if (docCount === 0) firstDocId = queueDoc.id;

    currentBatch.set(queueDoc, {
      ...notification,
      userIds: chunk,
      status: "PENDING",
      priority: notification.priority || "NORMAL",
      createdAt:
        FieldValue
          .serverTimestamp(),
    });
    docCount++;
    batchOpCount++;

    // Batch limit 500 — commit e criar NOVO batch (margem 450).
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
    "[BATCH_FCM] Notificacao enfileirada em chunks:" +
    ` ${docCount} docs para` +
    ` ${userIds.length} usuarios` +
    ` (primeiro: ${firstDocId})`
  );

  return firstDocId;
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
  const db = getFirestore();

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
        FieldValue
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
  const db = getFirestore();
  const startTime = Date.now();

  let totalTargeted = 0;
  let totalSent = 0;
  let totalFailed = 0;
  let invalidTokensCleaned = 0;

  // FIX #3941 F1: recuperar claims stale (PROCESSING > QUEUE_STALE_PROCESSING_MS)
  // no INÍCIO de cada execução (1×/min), em vez de apenas no cron diário não
  // paginado. Docs que uma execução morta pelo timeout deixou em PROCESSING
  // voltam a PENDING e podem ser reprocessados já nesta passada.
  try {
    await recoverStaleProcessingDocs(db);
  } catch (staleError) {
    // Recuperação é best-effort: não pode impedir o processamento de PENDING.
    logger.warn(
      "[BATCH_FCM] Recuperacao de PROCESSING stale falhou:",
      staleError
    );
  }

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

    // FIX #3941 F1: o claim PENDING→PROCESSING agora é SOB DEMAND (um doc por
    // vez, imediatamente antes de trabalhá-lo) e com orçamento de tempo, em
    // vez de reivindicar todos os 200 docs ANTES de qualquer envio. Quando o
    // GCF mata em 120s, os docs não trabalhados permanecem PENDING (nunca
    // PROCESSING), e os já reivindicados são tratados em try/catch por doc
    // (processSingleQueueDoc) que os reverte a PENDING em erro. O CAS
    // compare-and-swap (#2324) é preservado: cada doc ainda é reivindicado
    // dentro de uma transaction que relê o status.

    // 3. Coletar todos os userIds únicos de TODOS os docs pendentes (antes do
    // claim). Pré-carregar tokens E preferências em batch elimina o N+1 serial
    // (um get() por usuário × doc) que consumia dezenas de segundos por doc e
    // empurrava a execução para o timeout de 120s. (#3941 F2)
    const allUserIds = new Set<string>();
    for (const doc of pendingSnap.docs) {
      const userIds = doc.data().userIds as string[] | undefined;
      if (userIds) {
        userIds.forEach(
          (id) => allUserIds.add(id)
        );
      }
    }

    const targetedUserIds = new Set<string>();

    // 4. Pré-carregar tokens FCM + preferências de notificação em PARALELO
    // (uma chamada batched cada). O filtro de preferências continua por-doc
    // (cada doc tem seu próprio type/groupId), mas agora opera sobre o mapa em
    // memória — sem get() serial por usuário.
    // FIX #1282: bloco centralizado com docs[0].type removido — era tipo único para fila multi-tipo.
    const [tokenMap, settingsMap] = await Promise.all([
      fetchTokensInBatch(Array.from(allUserIds)).catch((err) => {
        logger.error("[BATCH_FCM] Erro ao pré-carregar tokens:", err);
        return new Map<string, string[]>();
      }),
      getNotificationSettingsBatch(Array.from(allUserIds)).catch((err) => {
        logger.error("[BATCH_FCM] Erro ao pré-carregar preferências:", err);
        return new Map<string, NotificationSettings>();
      }),
    ]);

    // 5. Iterar docs: claim-on-demand sob orçamento de tempo + try/catch por
    // documento. FIX #2324 mantém-se (CAS por doc). FIX #3941 F5: o catch
    // agora isola a falha a ESTE doc (reverte a PENDING) em vez de abortar o
    // lote inteiro.
    const docErrors: unknown[] = [];

    for (const doc of pendingSnap.docs) {
      // Orçamento de tempo: parar limpo antes do deadline do runtime (120s).
      // Docs restantes permanecem PENDING (ainda não reivindicados) e são
      // reprocessados na próxima execução (1×/min). (#3941 F1)
      if (Date.now() - startTime > QUEUE_SAFE_BUDGET_MS) {
        logger.info(
          "[BATCH_FCM] Orçamento de tempo" +
          ` (${QUEUE_SAFE_BUDGET_MS}ms) esgotado — encerrando;` +
          " docs restantes permanecem PENDING"
        );
        break;
      }

      // Claim atômico compare-and-swap imediatamente antes de trabalhar.
      let claimed = false;
      try {
        claimed = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(doc.ref);
          if (!fresh.exists) return false;
          if (fresh.data()?.status !== "PENDING") {
            // Já reivindicado por outra execução (ou já processado): pular.
            return false;
          }
          tx.update(doc.ref, {
            status: "PROCESSING",
            processing_at:
              FieldValue
                .serverTimestamp(),
          });
          return true;
        });
      } catch (claimError) {
        // Falha transitória no claim: não reivindica este doc nesta execução.
        // Permanece PENDING e será reprocessado na próxima passada.
        logger.warn(
          `[BATCH_FCM] Falha ao reivindicar doc ${doc.id}:`,
          claimError
        );
        continue;
      }
      if (!claimed) continue;

      try {
        const stats = await processSingleQueueDoc(
          doc,
          tokenMap,
          settingsMap,
          targetedUserIds
        );
        totalSent += stats.sent;
        totalFailed += stats.failed;
        invalidTokensCleaned +=
          stats.invalidTokensCleaned;
      } catch (docError) {
        // FIX #3941 F5: isola a falha a ESTE doc. Reverte a PENDING com
        // retry_count++ (ou FAILED se exceder) para que nunca fique preso em
        // PROCESSING, e continua o lote. Coleta o erro para relançar ao fim e
        // o Cloud Scheduler (retryCount:1) retentar a execução (idempotente
        // via CAS: docs já SENT permanecem, os revertidos serão re-claim).
        docErrors.push(docError);
        await revertDocToPending(doc).catch((revertErr) => {
          logger.error(
            `[BATCH_FCM] Falha ao reverter doc ${doc.id} a PENDING:`,
            revertErr
          );
        });
      }
    }

    // FIX #3585: a métrica é derivada do conjunto final após preferências.
    // Um usuário presente em vários docs conta uma única vez se for elegível
    // em pelo menos um deles.
    totalTargeted = targetedUserIds.size;

    // FIX #3941 F5: se algum doc teve erro inesperado, relança para o Cloud
    // Scheduler ver FALHA e acionar retryCount:1. Os docs já processados
    // permanecem em seus estados finais; os revertidos a PENDING serão
    // reprocessados de forma idempotente na retentativa.
    if (docErrors.length > 0) {
      throw new Error(
        "[BATCH_FCM] " + docErrors.length +
        " doc(s) falharam durante o processamento;" +
        " execução sinalizada para retry."
      );
    }
  } catch (error) {
    // Erro estrutural (fetch da fila, prefetch, etc.) — loga e propaga para o
    // handler agendado sinalizar falha ao Cloud Scheduler. Per-doc errors já
    // foram tratadas acima (revertidas a PENDING) e relançadas separadamente.
    logger.error(
      "[BATCH_FCM] Erro ao processar fila:",
      error
    );
    throw error;
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

/**
 * Recupera docs presos em PROCESSING (claim órfã de uma execução morta pelo
 * timeout do GCF) revertendo-os a PENDING (ou FAILED se exceder retry_count).
 *
 * FIX #3941 F1: antes isto rodava 1×/dia com `.limit(100)` SEM paginação —
 * docs 101+ ficavam PROCESSING para sempre (notificações órfãs permanentes).
 * Agora é PAGINADO e rodado no início de cada processNotificationQueue (1×/min)
 * + no cron diário como backstop.
 *
 * Paginação sem cursor: como cada batch RESETA os docs (PROCESSING→PENDING),
 * a próxima execução da MESMA query retorna a próxima página naturalmente —
 * sem orderBy/startAfter, portanto sem exigir novo composite index. O query
 * original (status==PROCESSING, processing_at<date) já era servido por um
 * composite index existente (o cron diário o usava em produção).
 *
 * @param {FirebaseFirestore.Firestore} database Firestore.
 * @return {Promise<number>} Quantidade de docs recuperados.
 */
async function recoverStaleProcessingDocs(
  database: FirebaseFirestore.Firestore
): Promise<number> {
  const staleDate = Timestamp.fromDate(
    new Date(Date.now() - QUEUE_STALE_PROCESSING_MS)
  );
  let recovered = 0;

  // Limite de segurança: evita loop infinito caso os resets não persistam.
  const MAX_RECOVERY_PASSES = 50;
  for (let pass = 0; pass < MAX_RECOVERY_PASSES; pass++) {
    const snapshot = await database
      .collection(QUEUE_COLLECTION)
      .where("status", "==", "PROCESSING")
      .where("processing_at", "<", staleDate)
      .limit(FIRESTORE_PAGINATION_LIMIT)
      .get();

    if (snapshot.empty) break;

    const batch = database.batch();
    snapshot.docs.forEach((doc) => {
      const retryCount = (doc.data().retry_count as number) || 0;
      if (retryCount >= MAX_RETRY_COUNT) {
        // Marcar como FAILED permanente
        batch.update(doc.ref, {
          status: "FAILED",
          failure_reason:
            `Excedeu ${MAX_RETRY_COUNT}` +
            " tentativas de" +
            " reprocessamento",
        });
      } else {
        batch.update(doc.ref, {
          status: "PENDING",
          retry_count:
            FieldValue
              .increment(1),
        });
      }
    });

    await batch.commit();
    recovered += snapshot.size;

    // Última página (menos que o limite) ou nada a fazer.
    if (snapshot.size < FIRESTORE_PAGINATION_LIMIT) break;
  }

  if (recovered > 0) {
    logger.info(
      "[BATCH_FCM]" +
      ` ${recovered} notificacoes travadas` +
      " (PROCESSING stale) resetadas para PENDING"
    );
  }
  return recovered;
}

/**
 * Reverte um doc preso em PROCESSING de volta a PENDING, incrementando
 * retry_count. Best-effort: chamado no catch de erro de processSingleQueueDoc
 * para garantir que um doc nunca fique permanentemente em PROCESSING quando a
 * execução encontrar um erro inesperado. Se retry_count já exceder o máximo,
 * marca como FAILED permanente. (#3941 F5)
 *
 * Usa CAS (relê status): só reverte se ainda estiver PROCESSING — evita
 * sobrescrever uma transição concorrente para SENT/FAILED/PENDING.
 *
 * @param {admin.firestore.QueryDocumentSnapshot} doc Doc da fila.
 * @return {Promise<void>}
 */
async function revertDocToPending(
  doc: admin.firestore.QueryDocumentSnapshot
): Promise<void> {
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(doc.ref);
    if (!fresh.exists) return;
    if (fresh.data()?.status !== "PROCESSING") return;
    const retryCount =
      (fresh.data()?.retry_count as number) || 0;
    const nextRetryCount = retryCount + 1;
    if (nextRetryCount >= MAX_RETRY_COUNT) {
      tx.update(doc.ref, {
        status: "FAILED",
        retry_count: nextRetryCount,
        failure_reason:
          `Excedeu ${MAX_RETRY_COUNT}` +
          " tentativas de reprocessamento",
        sent_at:
          FieldValue
            .serverTimestamp(),
      });
    } else {
      tx.update(doc.ref, {
        status: "PENDING",
        retry_count: nextRetryCount,
        processing_at: FieldValue.delete(),
      });
    }
  });
}

/**
 * Processa um único doc da fila já reivindicado (PROCESSING). Contém a lógica
 * extraída do loop inline: filtro de preferências (em memória), dispatch,
 * envio multicast em chunks e persistência do resultado.
 *
 * Lança em erro inesperado — o caller (processNotificationQueue) reverte o doc
 * a PENDING via {@link revertDocToPending} e continua o lote. (#3941 F5)
 *
 * @param {admin.firestore.QueryDocumentSnapshot} doc Doc da fila.
 * @param {Map} tokenMap Tokens por uid (pré-carregado).
 * @param {Map} settingsMap Preferências por uid.
 * @param {Set} targetedUserIds Acumulador global de elegíveis.
 * @return {Promise<object>} Estatísticas do doc (sent, failed, invalidTokensCleaned).
 */
async function processSingleQueueDoc(
  doc: admin.firestore.QueryDocumentSnapshot,
  tokenMap: Map<string, string[]>,
  settingsMap: Map<string, NotificationSettings>,
  targetedUserIds: Set<string>
): Promise<{
  sent: number;
  failed: number;
  invalidTokensCleaned: number;
}> {
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

  // FIX #1282: filtrar preferências de notificação por doc, usando o type e
  // groupId corretos deste doc específico. Operação sobre o mapa em memória
  // pré-carregado (getNotificationSettingsBatch) — sem get() serial por user.
  // (#3941 F2)
  const docGroupId = notifData?.groupId;
  const filteredDocUserIds: string[] = [];
  for (const uid of userIds) {
    const ok = shouldNotifyWithSettings(
      settingsMap.get(uid),
      type,
      docGroupId
    );
    if (ok) filteredDocUserIds.push(uid);
  }
  const skippedCount = userIds.length - filteredDocUserIds.length;
  if (skippedCount > 0) {
    logger.info(
      `[BATCH_FCM] Filtrados ${skippedCount} usuarios ` +
      `por preferencias (tipo: ${type}, doc: ${doc.id})`
    );
  }
  addTargetedUserIds(targetedUserIds, filteredDocUserIds);

  const pendingTokens =
    ((data.pending_tokens as string[] | undefined) || [])
      .filter(Boolean);
  const deliveredTokens =
    ((data.delivered_tokens as string[] | undefined) || [])
      .filter(Boolean);

  // Em retries, reenvia apenas tokens realmente pendentes; em docs legados,
  // exclui tokens já entregues para evitar duplicação entre dispositivos.
  const dispatch =
    buildDispatchTokens(
      filteredDocUserIds,
      tokenMap,
      pendingTokens,
      deliveredTokens
    );
  const {tokens, tokenToUser} = dispatch;

  if (tokens.length === 0) {
    // Nenhum token disponível
    await doc.ref.update({
      status: "SENT",
      sent_at:
        FieldValue
          .serverTimestamp(),
      result: {
        sent: 0,
        failed: 0,
        noTokens: userIds.length,
      },
    });
    return {sent: 0, failed: 0, invalidTokensCleaned: 0};
  }

  // FIX #3594: materializa o conjunto completo de pendentes antes do
  // primeiro efeito externo. Assim uma interrupção antes (ou entre) os
  // checkpoints nunca faz o retry reconstruir o dispatch do zero.
  await doc.ref.update({
    pending_tokens: tokens,
  });

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
      },
      async (progress) => {
        await persistChunkProgress(doc.ref, progress);
      }
    );

  const hasTransientFailures =
    sendResult.transientFailed > 0;
  const allFailed =
    sendResult.failed === tokens.length &&
    sendResult.transientFailed === 0;

  const currentRetryCount =
    (data.retry_count as number) || 0;
  const nextRetryCount = currentRetryCount + 1;

  if (allFailed) {
    await doc.ref.update({
      status: "FAILED",
      sent_at:
        FieldValue
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
  } else if (hasTransientFailures) {
    const pendingUserIds =
      Array.from(sendResult.pendingUserIds);
    const deliveredUserIdsArray =
      Array.from(sendResult.deliveredUserIds);
    const pendingTokensArray =
      Array.from(sendResult.pendingTokens);
    const deliveredTokensArray =
      Array.from(sendResult.deliveredTokens);

    if (
      nextRetryCount >= MAX_RETRY_COUNT ||
      pendingTokensArray.length === 0
    ) {
      const terminalUpdate: Record<string, unknown> = {
        status: "FAILED",
        retry_count: nextRetryCount,
        failure_reason:
          nextRetryCount >= MAX_RETRY_COUNT ?
            `Excedeu ${MAX_RETRY_COUNT} tentativas de envio` :
            "Todos os destinos foram entregues ou falharam permanentemente",
        sent_at:
          FieldValue
            .serverTimestamp(),
        pending_tokens: FieldValue.delete(),
        result: {
          sent: sendResult.sent,
          failed: sendResult.failed,
          transientFailed: sendResult.transientFailed,
          invalidTokensCleaned:
            sendResult.invalidTokensCleaned,
          totalTokens: tokens.length,
        },
      };

      if (deliveredUserIdsArray.length > 0) {
        terminalUpdate.delivered_user_ids =
          FieldValue.arrayUnion(...deliveredUserIdsArray);
      }
      if (deliveredTokensArray.length > 0) {
        terminalUpdate.delivered_tokens =
          FieldValue.arrayUnion(...deliveredTokensArray);
      }

      await doc.ref.update({
        ...terminalUpdate,
      });
    } else {
      const retryUpdate: Record<string, unknown> = {
        status: "PENDING",
        userIds: pendingUserIds,
        pending_tokens: pendingTokensArray,
        retry_count: nextRetryCount,
        sent_at:
          FieldValue
            .serverTimestamp(),
        result: {
          sent: sendResult.sent,
          failed: sendResult.failed,
          transientFailed: sendResult.transientFailed,
          invalidTokensCleaned:
            sendResult.invalidTokensCleaned,
          totalTokens: tokens.length,
        },
      };

      if (deliveredUserIdsArray.length > 0) {
        retryUpdate.delivered_user_ids =
          FieldValue.arrayUnion(...deliveredUserIdsArray);
      }
      if (deliveredTokensArray.length > 0) {
        retryUpdate.delivered_tokens =
          FieldValue.arrayUnion(...deliveredTokensArray);
      }

      await doc.ref.update(retryUpdate);
    }
  } else {
    const deliveredUserIdsArray =
      Array.from(sendResult.deliveredUserIds);
    const deliveredTokensArray =
      Array.from(sendResult.deliveredTokens);
    const sentUpdate: Record<string, unknown> = {
      status: "SENT",
      sent_at:
        FieldValue
          .serverTimestamp(),
      pending_tokens: FieldValue.delete(),
      result: {
        sent: sendResult.sent,
        failed: sendResult.failed,
        transientFailed: sendResult.transientFailed,
        invalidTokensCleaned:
          sendResult.invalidTokensCleaned,
        totalTokens: tokens.length,
      },
    };

    if (deliveredUserIdsArray.length > 0) {
      sentUpdate.delivered_user_ids =
        FieldValue.arrayUnion(...deliveredUserIdsArray);
    }
    if (deliveredTokensArray.length > 0) {
      sentUpdate.delivered_tokens =
        FieldValue.arrayUnion(...deliveredTokensArray);
    }

    await doc.ref.update(sentUpdate);
  }

  return {
    sent: sendResult.sent,
    failed: sendResult.failed,
    invalidTokensCleaned: sendResult.invalidTokensCleaned,
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
 * @param {Function} onChunkProcessed - Persiste o progresso após cada chunk.
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
  },
  onChunkProcessed?: (progress: ChunkProgress) => Promise<void>
): Promise<{
  sent: number;
  failed: number;
  transientFailed: number;
  invalidTokensCleaned: number;
  deliveredTokens: Set<string>;
  pendingTokens: Set<string>;
  deliveredUserIds: Set<string>;
  pendingUserIds: Set<string>;
}> {
  let sent = 0;
  let failed = 0;
  let transientFailed = 0;
  let invalidTokensCleaned = 0;

  const deliveredTokens = new Set<string>();
  const pendingTokens = new Set<string>();

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
    const chunkDeliveredTokens: string[] = [];
    const chunkPendingTokens: string[] = [];
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

      // Registrar sucessos em todos os chunks; mesmo um chunk sem falhas
      // pode ser do mesmo usuario que teve falha transiente em outro token.
      response.responses.forEach(
        (sendResponse: admin.messaging.SendResponse, index: number) => {
          if (!sendResponse.success) return;
          const succeededToken = chunk[index];
          deliveredTokens.add(succeededToken);
          pendingTokens.delete(succeededToken);
          chunkDeliveredTokens.push(succeededToken);
        }
      );

      // Processar falhas para tokens invalidos e transientes
      if (response.failureCount > 0) {
        const tokensToRemove: {
          token: string;
          userId: string;
        }[] = [];

        response.responses.forEach(
          (sendResponse: admin.messaging.SendResponse,
            index: number) => {
            if (sendResponse.error) {
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
                pendingTokens.add(failedToken);
                chunkPendingTokens.push(failedToken);
              } else {
                // FIX #3941 F4: classes de erro FCM fora das duas conhecidas
                // (invalid-token / transient) eram descartadas em silêncio — o
                // token saía de pending (mergeChunkCheckpoint) e, com sent>0,
                // o doc virava SENT sem retry nem log. Códigos como
                // third-party-auth-error, authentication-error e
                // mismatched-credential caíam aqui invisíveis. Agora logamos
                // (userId, prefixo do token, código) para que o alerting veja.
                logger.error(
                  `[BATCH_FCM] Unhandled FCM error ${errorCode}` +
                  ` for user ${userId ?? "?"}` +
                  ` (token ${failedToken.slice(0, 8)}...):` +
                  ` ${sendResponse.error.message || "no message"}`
                );
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
      logger.error(
        "[BATCH_FCM] Erro no envio multicast:",
        error
      );
      // Sem BatchResponse não sabemos se o FCM aceitou algum destino.
      // Classificar o chunk inteiro como transiente mantém todos os tokens no
      // checkpoint e evita perdê-los caso chunks posteriores tenham sucesso.
      failed += chunk.length;
      transientFailed += chunk.length;
      chunk.forEach((token) => {
        pendingTokens.add(token);
        chunkPendingTokens.push(token);
      });
    }

    // O callback fica fora do try/catch do FCM: falhar em persistir o
    // checkpoint deve abortar imediatamente, nunca liberar o próximo chunk.
    // O cleanup reabre o doc usando o último progresso durável.
    if (onChunkProcessed) {
      await onChunkProcessed({
        chunkTokens: chunk,
        deliveredTokens: chunkDeliveredTokens,
        pendingTokens: chunkPendingTokens,
      });
    }
  }

  failed -= transientFailed;

  const deliveredUserIds = new Set<string>();
  for (const token of deliveredTokens) {
    const userId = tokenToUser.get(token);
    if (userId) {
      deliveredUserIds.add(userId);
    }
  }

  const pendingUserIds = new Set<string>();
  for (const token of pendingTokens) {
    const userId = tokenToUser.get(token);
    if (userId) {
      pendingUserIds.add(userId);
    }
  }

  return {
    sent,
    failed,
    transientFailed,
    invalidTokensCleaned,
    deliveredTokens,
    pendingTokens,
    deliveredUserIds,
    pendingUserIds,
  };
}

/**
 * Une um resultado de chunk ao checkpoint persistido.
 *
 * Remove do pending todos os destinos terminados no chunk e reinsere somente
 * falhas transientes. Sucessos são acumulados de forma deduplicada.
 *
 * @param {QueueCheckpoint} current Estado durável atual.
 * @param {ChunkProgress} progress Resultado do chunk recém-processado.
 * @return {QueueCheckpoint} Próximo estado durável.
 */
function mergeChunkCheckpoint(
  current: QueueCheckpoint,
  progress: ChunkProgress
): QueueCheckpoint {
  const delivered = new Set(current.deliveredTokens);
  progress.deliveredTokens.forEach((token) => delivered.add(token));

  const pending = new Set(current.pendingTokens);
  progress.chunkTokens.forEach((token) => pending.delete(token));
  progress.pendingTokens.forEach((token) => {
    if (!delivered.has(token)) pending.add(token);
  });

  return {
    deliveredTokens: Array.from(delivered),
    pendingTokens: Array.from(pending),
  };
}

/**
 * Persiste progresso de um único chunk com compare/read/update curto.
 *
 * @param {admin.firestore.DocumentReference} queueRef Documento da fila.
 * @param {ChunkProgress} progress Resultado do chunk.
 * @return {Promise<void>}
 */
async function persistChunkProgress(
  queueRef: admin.firestore.DocumentReference,
  progress: ChunkProgress
): Promise<void> {
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(queueRef);
    if (!fresh.exists) {
      throw new Error("Documento da fila removido durante envio FCM");
    }

    const data = fresh.data() || {};
    const next = mergeChunkCheckpoint(
      {
        deliveredTokens:
          ((data.delivered_tokens as string[] | undefined) || [])
            .filter(Boolean),
        pendingTokens:
          ((data.pending_tokens as string[] | undefined) || [])
            .filter(Boolean),
      },
      progress
    );

    tx.update(queueRef, {
      delivered_tokens: next.deliveredTokens,
      pending_tokens: next.pendingTokens,
      progress_updated_at: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Acumula usuários elegíveis sem duplicar IDs entre documentos.
 *
 * @param {Set<string>} target Conjunto global da execução.
 * @param {string[]} userIds IDs aprovados por preferência no documento.
 */
function addTargetedUserIds(
  target: Set<string>,
  userIds: string[]
): void {
  userIds.forEach((userId) => target.add(userId));
}

/**
 * Seleciona os tokens elegíveis para a tentativa atual do doc da fila.
 *
 * Em retry, prioriza explicitamente `pending_tokens`. Para docs legados sem
 * esse campo, evita reenvio para tokens já entregues em tentativas anteriores.
 *
 * @param {string[]} userIds Usuários alvo desta tentativa.
 * @param {Map<string, string[]>} tokenMap Tokens atuais por usuário.
 * @param {string[]} pendingTokens Tokens pendentes persistidos no doc.
 * @param {string[]} deliveredTokens Tokens já entregues persistidos no doc.
 * @return {DispatchTokensResult} Tokens a enviar e mapa token -> usuário.
 */
function buildDispatchTokens(
  userIds: string[],
  tokenMap: Map<string, string[]>,
  pendingTokens: string[] = [],
  deliveredTokens: string[] = []
): DispatchTokensResult {
  const pendingTokenSet = new Set(pendingTokens);
  const deliveredTokenSet = new Set(deliveredTokens);
  const restrictToPendingTokens = pendingTokenSet.size > 0;

  const tokens: string[] = [];
  const tokenToUser = new Map<string, string>();

  for (const userId of userIds) {
    const userTokens = tokenMap.get(userId) || [];
    for (const token of userTokens) {
      if (restrictToPendingTokens && !pendingTokenSet.has(token)) {
        continue;
      }
      if (!restrictToPendingTokens && deliveredTokenSet.has(token)) {
        continue;
      }
      if (tokenToUser.has(token)) {
        continue;
      }
      tokens.push(token);
      tokenToUser.set(token, userId);
    }
  }

  return {tokens, tokenToUser};
}

/**
 * Helpers expostos para testes focados da fila FCM.
 */
export const __testing = {
  addTargetedUserIds,
  buildDispatchTokens,
  fetchTokensInBatch,
  mergeChunkCheckpoint,
  sendMulticastInChunks,
  // #3941: helpers de recuperação/per-doc expostos para testes de regressão.
  recoverStaleProcessingDocs,
  revertDocToPending,
};

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
  const db = getFirestore();
  let tokenMap = new Map<string, string[]>();
  const canonicalOwners = new Map<string, string>();

  try {
    tokenMap = await getRegisteredPushTokens(userIds);
    tokenMap.forEach((tokens, userId) => {
      tokens.forEach((token) => canonicalOwners.set(token, userId));
    });
  } catch (error) {
    // Migração gradual: falha na coleção nova não interrompe fallback legado.
    logger.error("[BATCH_FCM] Erro ao buscar registro privado:", error);
  }

  // Chunks de 10 (limite do whereIn)
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += FIRESTORE_WHERE_IN_LIMIT) {  
    chunks.push(userIds.slice(i, i + FIRESTORE_WHERE_IN_LIMIT));
  }

  // Buscar em paralelo
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const snapshot = await db
          .collection("users")
          .where(
            FieldPath
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
      const merged = new Set(tokenMap.get(userId) ?? []);
      tokens.forEach((token) => {
        // Atribuição canônica vence um campo legado obsoleto de outro usuário.
        const canonicalOwner = canonicalOwners.get(token);
        if (!canonicalOwner || canonicalOwner === userId) merged.add(token);
      });
      if (merged.size > 0) tokenMap.set(userId, Array.from(merged));
    }
  }

  const allOwners = new Map<string, string>();
  tokenMap.forEach((tokens, userId) => {
    tokens.forEach((token) => allOwners.set(token, userId));
  });
  const filtered = await filterPushTokensByCanonicalOwner(
    allOwners,
    new Set(canonicalOwners.keys())
  );
  const safeMap = new Map<string, string[]>();
  filtered.forEach((userId, token) => {
    const tokens = safeMap.get(userId) ?? [];
    tokens.push(token);
    safeMap.set(userId, tokens);
  });
  return safeMap;
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
  const db = getFirestore();

  // Limpa primeiro a fonte canônica. allSettled mantém o cleanup legado mesmo
  // se um registro privado estiver concorrendo com rotação/relogin.
  await Promise.allSettled(
    tokensToRemove.map(({token, userId}) =>
      removeRegisteredPushToken(userId, token)
    )
  );

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
          FieldPath.documentId(),
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
          FieldValue.delete();
      }
      if (data?.fcmToken === token) {
        update.fcmToken =
          FieldValue.delete();
      }
      const arr = data?.fcmTokens;
      if (
        Array.isArray(arr) &&
        (arr as string[]).includes(token)
      ) {
        update.fcmTokens =
          FieldValue.arrayRemove(
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
        const db = getFirestore();
        await db.collection("metrics").add({
          type:
            "notification_batch_processed",
          timestamp:
            FieldValue
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
    appCheck: !process.env.FUNCTIONS_EMULATOR,
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
        "userIds é obrigatório e" +
        " deve ser um array"
      );
    }

    if (!title || !body || !type) {
      throw new HttpsError(
        "invalid-argument",
        "title, body e type são obrigatórios"
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
      const db = getFirestore();

      const oneDayAgo = new Date();
      oneDayAgo.setDate(
        oneDayAgo.getDate() - 1
      );
      const cutoffDate =
        Timestamp
          .fromDate(oneDayAgo);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(
        sevenDaysAgo.getDate() - 7
      );
      const staleCutoffDate =
        Timestamp
          .fromDate(sevenDaysAgo);

      let totalDeleted = 0;

      try {
        // Deletar notificações processadas > 24h (SENT, FAILED)
        // ou PENDING presas > 7 dias (stuck em retry loop)
        {
          let lastDoc:
            admin.firestore.QueryDocumentSnapshot | null = null;
          while (true) {
            const whereIn =
              ["SENT", "FAILED"];
            let query = db
              .collection(QUEUE_COLLECTION)
              .where("status", "in", whereIn)
              .where("createdAt", "<", cutoffDate)
              .limit(FIRESTORE_PAGINATION_LIMIT);

            if (lastDoc) {
              query = query.startAfter(lastDoc);
            }
            const snapshot = await query.get();
            if (snapshot.empty) break;

            const batch = db.batch();
            snapshot.docs.forEach((doc) => {
              batch.delete(doc.ref);
            });
            await batch.commit();
            totalDeleted += snapshot.size;

            if (snapshot.size < FIRESTORE_PAGINATION_LIMIT) break;
            lastDoc = snapshot.docs[snapshot.size - 1];
          }
        }

        // Deletar PENDING presas > 7 dias (stuck em retry loop)
        {
          let lastDoc:
            admin.firestore.QueryDocumentSnapshot | null = null;
          while (true) {
            let query = db
              .collection(QUEUE_COLLECTION)
              .where("status", "==", "PENDING")
              .where("createdAt", "<", staleCutoffDate)
              .limit(FIRESTORE_PAGINATION_LIMIT);

            if (lastDoc) {
              query = query.startAfter(lastDoc);
            }
            const snapshot = await query.get();
            if (snapshot.empty) break;

            const batch = db.batch();
            snapshot.docs.forEach((doc) => {
              batch.delete(doc.ref);
            });
            await batch.commit();
            totalDeleted += snapshot.size;

            if (snapshot.size < FIRESTORE_PAGINATION_LIMIT) break;
            lastDoc = snapshot.docs[snapshot.size - 1];
          }
        }

        // FIX #3941 F1: limpar PROCESSING travadas (> QUEUE_STALE_PROCESSING_MS)
        // via o MESMO helper paginado usado no início de cada execução. Antes
        // era `.limit(100)` SEM paginação — docs 101+ ficavam PROCESSING para
        // sempre. Agora a recuperação é completa (e redundante ao per-minute,
        // servindo apenas como backstop diário).
        await recoverStaleProcessingDocs(db);

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
