/**
 * UTILITÁRIO REUTILIZÁVEL DE SOFT DELETE - P2 #40
 *
 * Padrão de soft-delete para documentos Firestore.
 * Em vez de deletar fisicamente, marca com
 * `deleted_at` e `deleted_by`.
 *
 * BENEFÍCIOS:
 * - Reversível (pode restaurar)
 * - Auditável (registra quem/quando deletou)
 * - Compliance-friendly (LGPD/GDPR)
 * - Integridade referencial mantida
 *
 * CAMPOS ADICIONADOS AO DOCUMENTO:
 * - deleted_at: Timestamp (null=ativo)
 * - deleted_by: string (UID do usuário)
 * - deleted_reason: string (motivo opcional)
 * - status: "DELETED" (opcional)
 *
 * CLEANUP AUTOMÁTICO:
 * - Documentos soft-deleted são removidos após 30d
 * - Funções agendadas em maintenance/soft-delete.ts
 *
 * @see specs/P2_40_SOFT_DELETE_PATTERN.md
 */

import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {FieldValue, FieldPath, Timestamp} from "firebase-admin/firestore";

const getDb = () => admin.firestore();

// Teto de concorrência para recursiveDelete/BulkWriter por batch (#2529).
// Impede que um batch de 500 docs dispare 500 BulkWriters simultâneos.
const RECURSIVE_DELETE_CONCURRENCY = 10;

// ==========================================
// INTERFACES
// ==========================================

/** Resultado de uma operação de soft-delete */
export interface SoftDeleteResult {
  success: boolean;
  docId: string;
  collection: string;
  deletedAt: Date;
  deletedBy: string;
  error?: string;
}

/** Resultado de uma operação de restauração */
export interface RestoreResult {
  success: boolean;
  docId: string;
  collection: string;
  restoredAt: Date;
  restoredBy: string;
  previousStatus?: string;
  error?: string;
}

/** Opções para o soft-delete */
export interface SoftDeleteOptions {
  /** Motivo da deleção (opcional) */
  reason?: string;
  /** Alterar status para "DELETED" (padrão: true) */
  setStatusDeleted?: boolean;
  /** Campos adicionais para atualizar */
  additionalFields?: Record<string, unknown>;
}

/** Opções para restauração */
export interface RestoreOptions {
  /** Status para restaurar */
  restoreStatus?: string;
  /** Campos adicionais para atualizar */
  additionalFields?: Record<string, unknown>;
}

/** Resultado de cleanup de docs soft-deleted */
export interface CleanupResult {
  collection: string;
  totalDeleted: number;
  batchCount: number;
  cutoffDate: Date;
  durationMs: number;
  /**
   * Teto de batches permitido por execução. Exportado para que o chamador
   * saiba qual era a "janela de trabalho" da varredura (issue #3969).
   */
  maxBatches: number;
  /**
   * `true` quando o laço saiu por `batchCount >= maxBatches` ainda existindo
   * documentos elegíveis (i.e. `hasMore` permaneceu `true`). Significa que o
   * backlog NÃO foi totalmente drenado nesta execução e documentos além do
   * TTL de retenção seguirão carregando PII até a próxima varredura (risco
   * LGPD — issues #2481 / #3969). O chamador deve logar em `warn` e emitir
   * um alerta quando isto acontecer.
   */
  truncated: boolean;
}

/** Resultado da cascata de dependências de um jogo. */
export interface SoftDeleteGameCascadeResult extends SoftDeleteResult {
  dependentsDeleted: number;
}

// ==========================================
// FUNÇÕES PRINCIPAIS
// ==========================================

/**
 * Marca um documento como soft-deleted.
 *
 * Não remove fisicamente o documento, apenas
 * adiciona campos:
 * - deleted_at: timestamp atual
 * - deleted_by: UID do usuário
 * - deleted_reason: motivo (opcional)
 * - status: "DELETED" (se setStatusDeleted=true)
 *
 * @param {string} collection - Nome da coleção
 * @param {string} docId - ID do documento
 * @param {string} deletedBy - UID do usuário
 * @param {SoftDeleteOptions} options - Opções
 * @return {Promise<SoftDeleteResult>} Resultado
 */
export async function softDelete(
  collection: string,
  docId: string,
  deletedBy: string,
  options: SoftDeleteOptions = {}
): Promise<SoftDeleteResult> {
  const db = getDb();
  const now = new Date();

  try {
    const docRef = db
      .collection(collection)
      .doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return {
        success: false,
        docId,
        collection,
        deletedAt: now,
        deletedBy,
        error:
          `Documento ${docId} não encontrado ` +
          `na coleção ${collection}`,
      };
    }

    const docData = docSnap.data();

    // Verificar se já está deletado (idempotência)
    if (docData?.deleted_at) {
      logger.info(
        "[SOFT_DELETE] Documento " +
        `${collection}/${docId} ` +
        "já está soft-deleted"
      );
      return {
        success: true,
        docId,
        collection,
        deletedAt: docData.deleted_at.toDate ?
          docData.deleted_at.toDate() :
          now,
        deletedBy:
          docData.deleted_by || deletedBy,
      };
    }

    // Montar campos de atualização
    const updateFields: Record<string, unknown> = {
      deleted_at:
        FieldValue
          .serverTimestamp(),
      deleted_by: deletedBy,
      updated_at:
        FieldValue
          .serverTimestamp(),
      ...options.additionalFields,
    };

    if (options.reason) {
      updateFields.deleted_reason = options.reason;
    }

    if (options.setStatusDeleted !== false) {
      updateFields.status = "DELETED";
    }

    await docRef.update(updateFields);

    logger.info(
      "[SOFT_DELETE] Documento " +
      `${collection}/${docId} ` +
      `soft-deleted por ${deletedBy}` +
      (options.reason ?
        ` (motivo: ${options.reason})` :
        "")
    );

    return {
      success: true,
      docId,
      collection,
      deletedAt: now,
      deletedBy,
    };
  } catch (error: unknown) {
    const typedError =
      error as Record<string, unknown>;
    logger.error(
      "[SOFT_DELETE] Erro ao soft-delete " +
      `${collection}/${docId}:`,
      error
    );
    return {
      success: false,
      docId,
      collection,
      deletedAt: now,
      deletedBy,
      error:
        (typedError.message as string) ||
        "Erro desconhecido",
    };
  }
}

/**
 * Restaura um documento soft-deleted.
 *
 * Remove os campos de deleção e opcionalmente
 * restaura o status original.
 *
 * @param {string} collection - Nome da coleção
 * @param {string} docId - ID do documento
 * @param {string} restoredBy - UID do usuário
 * @param {RestoreOptions} options - Opções
 * @return {Promise<RestoreResult>} Resultado
 */
export async function restoreSoftDeleted(
  collection: string,
  docId: string,
  restoredBy: string,
  options: RestoreOptions = {}
): Promise<RestoreResult> {
  const db = getDb();
  const now = new Date();

  try {
    const docRef = db
      .collection(collection)
      .doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return {
        success: false,
        docId,
        collection,
        restoredAt: now,
        restoredBy,
        error:
          `Documento ${docId} não encontrado ` +
          `na coleção ${collection}`,
      };
    }

    const docData = docSnap.data();

    // Verificar se está realmente deletado
    if (!docData?.deleted_at) {
      return {
        success: false,
        docId,
        collection,
        restoredAt: now,
        restoredBy,
        error:
          `Documento ${collection}/${docId} ` +
          "não está soft-deleted",
      };
    }

    // Montar campos de atualização
    const updateFields: Record<string, unknown> = {
      deleted_at:
        FieldValue.delete(),
      deleted_by:
        FieldValue.delete(),
      deleted_reason:
        FieldValue.delete(),
      updated_at:
        FieldValue
          .serverTimestamp(),
      restored_at:
        FieldValue
          .serverTimestamp(),
      restored_by: restoredBy,
      ...options.additionalFields,
    };

    // Restaurar status se especificado
    if (options.restoreStatus) {
      updateFields.status =
        options.restoreStatus;
    }

    await docRef.update(updateFields);

    logger.info(
      "[SOFT_DELETE] Documento " +
      `${collection}/${docId} ` +
      `restaurado por ${restoredBy}`
    );

    return {
      success: true,
      docId,
      collection,
      restoredAt: now,
      restoredBy,
    };
  } catch (error: unknown) {
    const typedError =
      error as Record<string, unknown>;
    logger.error(
      "[SOFT_DELETE] Erro ao restaurar " +
      `${collection}/${docId}:`,
      error
    );
    return {
      success: false,
      docId,
      collection,
      restoredAt: now,
      restoredBy,
      error:
        (typedError.message as string) ||
        "Erro desconhecido",
    };
  }
}

/**
 * Verifica se um documento está soft-deleted.
 *
 * @param {string} collection - Nome da coleção
 * @param {string} docId - ID do documento
 * @return {Promise<boolean>} true se soft-deleted
 */
export async function isSoftDeleted(
  collection: string,
  docId: string
): Promise<boolean> {
  const db = getDb();

  try {
    const docSnap = await db
      .collection(collection)
      .doc(docId)
      .get();
    if (!docSnap.exists) return false;

    const data = docSnap.data();
    return data?.deleted_at != null;
  } catch (error) {
    logger.error(
      "[SOFT_DELETE] Erro ao verificar " +
      `${collection}/${docId}:`,
      error
    );
    return false;
  }
}

/**
 * Soft-delete de um jogo e de seus dados operacionais associados.
 *
 * As coleções raiz são paginadas por `game_id`; as subcoleções do jogo são
 * percorridas diretamente. O jogo só recebe `deleted_at` depois dos filhos,
 * para que uma falha parcial permaneça repetível sem deixar o pai terminal.
 *
 * @param {string} gameId ID do jogo
 * @param {string} deletedBy UID de quem solicitou a exclusão
 * @param {string} reason Motivo opcional
 * @return {Promise<SoftDeleteGameCascadeResult>} resultado da cascata
 */
export async function softDeleteGameCascade(
  gameId: string,
  deletedBy: string,
  reason = ""
): Promise<SoftDeleteGameCascadeResult> {
  const db = getDb();
  const now = new Date();
  const gameRef = db.collection("games").doc(gameId);
  const BATCH_LIMIT = 450;
  const PAGE_SIZE = 500;
  let dependentsDeleted = 0;

  try {
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) {
      return {
        success: false,
        docId: gameId,
        collection: "games",
        deletedAt: now,
        deletedBy,
        dependentsDeleted,
        error: "Jogo não encontrado",
      };
    }

    const gameData = gameSnap.data();
    if (gameData?.deleted_at) {
      return {
        success: true,
        docId: gameId,
        collection: "games",
        deletedAt: gameData.deleted_at.toDate ?
          gameData.deleted_at.toDate() : now,
        deletedBy: gameData.deleted_by || deletedBy,
        dependentsDeleted,
      };
    }

    const deletedFields = {
      deleted_at: FieldValue.serverTimestamp(),
      deleted_by: deletedBy,
      deleted_reason: reason || "Jogo deletado pelo proprietário",
      updated_at: FieldValue.serverTimestamp(),
    };
    let batch = db.batch();
    let ops = 0;
    const flush = async () => {
      if (ops === 0) return;
      await batch.commit();
      batch = db.batch();
      ops = 0;
    };
    const queueUpdate = (
      doc: admin.firestore.QueryDocumentSnapshot,
      fields: Record<string, unknown>
    ) => {
      if (doc.data().deleted_at) return;
      batch.update(doc.ref, {...deletedFields, ...fields});
      ops++;
      dependentsDeleted++;
    };
    const cascadeRootCollection = async (
      collectionName: string,
      fields: Record<string, unknown>
    ) => {
      let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
      while (true) {
        let query = db.collection(collectionName)
          .where("game_id", "==", gameId)
          .orderBy(FieldPath.documentId())
          .limit(PAGE_SIZE);
        if (lastDoc) query = query.startAfter(lastDoc);

        const snapshot = await query.get();
        if (snapshot.empty) break;
        for (const doc of snapshot.docs) {
          queueUpdate(doc, fields);
          if (ops >= BATCH_LIMIT) await flush();
        }
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < PAGE_SIZE) break;
      }
    };
    const cascadeSubcollection = async (
      collectionName: string,
      fields: Record<string, unknown>
    ) => {
      let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
      while (true) {
        let query = gameRef.collection(collectionName)
          .orderBy(FieldPath.documentId())
          .limit(PAGE_SIZE);
        if (lastDoc) query = query.startAfter(lastDoc);

        const snapshot = await query.get();
        if (snapshot.empty) break;
        for (const doc of snapshot.docs) {
          queueUpdate(doc, fields);
          if (ops >= BATCH_LIMIT) await flush();
        }
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < PAGE_SIZE) break;
      }
    };

    await cascadeRootCollection("confirmations", {status: "CANCELLED"});
    await cascadeRootCollection("game_rides", {status: "CANCELLED"});
    await cascadeSubcollection("chat", {});
    await cascadeSubcollection("comments", {});
    await cascadeSubcollection("waitlist", {status: "CANCELLED"});
    await flush();

    await gameRef.update({
      ...deletedFields,
      status: "DELETED",
    });

    logger.info(
      "[SOFT_DELETE_CASCADE] Jogo " +
      `${gameId}: 1 jogo + ${dependentsDeleted} dependências soft-deleted`
    );
    return {
      success: true,
      docId: gameId,
      collection: "games",
      deletedAt: now,
      deletedBy,
      dependentsDeleted,
    };
  } catch (error: unknown) {
    const typedError = error as Record<string, unknown>;
    logger.error(
      "[SOFT_DELETE_CASCADE] Erro para jogo " +
      `${gameId}:`,
      error
    );
    return {
      success: false,
      docId: gameId,
      collection: "games",
      deletedAt: now,
      deletedBy,
      dependentsDeleted,
      error: (typedError.message as string) || "Erro desconhecido",
    };
  }
}

/**
 * Cleanup genérico de documentos soft-deleted
 * antigos. Remove permanentemente documentos que
 * foram soft-deleted há mais de `retentionDays`.
 *
 * @param {string} collection - Nome da coleção
 * @param {number} retentionDays - Dias de retenção
 * @param {number} maxBatches - Máx batches
 * @param {number} batchSize - Tamanho do batch
 * @param {boolean} recursive - Se true, usa recursiveDelete (apaga
 *   subcoleções). Necessário para coleções com subcoleções (ex.: groups tem
 *   members/league_standings, locations tem reviews) — FIX #2481 (LGPD).
 * @return {Promise<CleanupResult>} Resultado
 */
export async function cleanupSoftDeleted(
  collection: string,
  retentionDays = 30,
  maxBatches = 10,
  batchSize = 100,
  recursive = false
): Promise<CleanupResult> {
  const db = getDb();
  const startTime = Date.now();

  const cutoffDate = new Date();
  cutoffDate.setDate(
    cutoffDate.getDate() - retentionDays
  );
  const cutoffTimestamp =
    Timestamp.fromDate(cutoffDate);

  let totalDeleted = 0;
  let batchCount = 0;
  // Hoistado para fora do try: precisamos dele no catch para reportar se a
  // varredura foi truncada por saturação mesmo quando um erro interrompe
  // o laço (issue #3969).
  let hasMore = true;

  try {
    let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;

    while (hasMore && batchCount < maxBatches) {
      let query = db
        .collection(collection)
        .where("deleted_at", "<", cutoffTimestamp)
        .orderBy("deleted_at")
        .limit(batchSize);
      if (lastDoc) query = query.startAfter(lastDoc);

      const snapshot = await query.get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      // FIX #2481 (LGPD): batch.delete NÃO apaga subcoleções — deixava
      // groups/{id}/members/* órfãos (PII retida). Para coleções com
      // subcoleções, recursiveDelete (BulkWriter) remove a árvore inteira.
      //
      // FIX #2529 (PERF): limita concorrência de recursiveDelete/BulkWriter.
      // Promise.all irrestrito disparava até batchSize=500 BulkWriters
      // simultâneos → risco de OOM no runtime de 512MiB. Processa em chunks
      // de RECURSIVE_DELETE_CONCURRENCY para manter vazão controlada.
      if (recursive) {
        for (
          let i = 0;
          i < snapshot.docs.length;
          i += RECURSIVE_DELETE_CONCURRENCY
        ) {
          const chunk = snapshot.docs.slice(
            i, i + RECURSIVE_DELETE_CONCURRENCY
          );
          await Promise.all(
            chunk.map((doc) => db.recursiveDelete(doc.ref))
          );
        }
      } else {
        const batch = db.batch();
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
      totalDeleted += snapshot.size;
      batchCount++;

      logger.info(
        "[SOFT_DELETE_CLEANUP] Batch " +
        `${batchCount}: ${snapshot.size} ` +
        "documentos removidos de " +
        `${collection}`
      );

      if (snapshot.size < batchSize) {
        hasMore = false;
      } else {
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
      }
    }

    const durationMs = Date.now() - startTime;

    // Issue #3969: sinal de saturação. O laço sai por `batchCount >= maxBatches`
    // somente quando `hasMore` ainda é true (ou seja, ainda havia documentos
    // elegíveis). Distinguimos isto do esvaziamento natural para que o chamador
    // possa alertar — documentos além do TTL de retenção carregam PII (LGPD).
    const truncated = hasMore && batchCount >= maxBatches;

    if (truncated) {
      // O job é semanal: cada execução truncada adia a remoção por uma semana
      // inteira. Avisar aqui garante que a saturação nunca passe em silêncio.
      logger.warn(
        "[SOFT_DELETE_CLEANUP] SATURACAO: " +
        `${collection} atingiu o teto de ${maxBatches} batches ` +
        `(${totalDeleted} documentos removidos) e ainda ha backlog. ` +
        "Documentos soft-deleted alem do TTL de retencao " +
        "permanecerao ate a proxima execucao (risco LGPD)."
      );
    }

    logger.info(
      "[SOFT_DELETE_CLEANUP] " +
      `${collection}: ${totalDeleted} ` +
      "documentos permanentemente removidos " +
      `em ${batchCount} batches ` +
      `(${durationMs}ms)` +
      (truncated ? " [TRUNCADO]" : "")
    );

    return {
      collection,
      totalDeleted,
      batchCount,
      cutoffDate,
      durationMs,
      maxBatches,
      truncated,
    };
  } catch (error: unknown) {
    logger.error(
      "[SOFT_DELETE_CLEANUP] Erro em " +
      `${collection}:`,
      error
    );
    // Em caso de erro não há como afirmar se restou backlog; reportamos o
    // estado parcial conhecido (não truncado — a falha já será alertada).
    return {
      collection,
      totalDeleted,
      batchCount,
      cutoffDate,
      durationMs: Date.now() - startTime,
      maxBatches,
      truncated: hasMore && batchCount >= maxBatches,
    };
  }
}

/**
 * Soft-delete em cascata para um grupo e seus
 * jogos associados.
 *
 * Marca o grupo e todos os jogos ativos do grupo
 * como soft-deleted. Usa batch write para
 * atomicidade.
 *
 * @param {string} groupId - ID do grupo
 * @param {string} deletedBy - UID do usuário
 * @param {string} reason - Motivo da deleção
 * @return {Promise<object>} Resultado com contagem
 */
export async function softDeleteGroupCascade(
  groupId: string,
  deletedBy: string,
  reason = ""
): Promise<{
  groupDeleted: boolean;
  gamesDeleted: number;
  error?: string;
}> {
  const db = getDb();

  try {
    const now =
      FieldValue.serverTimestamp();
    const nowTimestamp = Timestamp.now();

    // 1. Soft-delete do grupo
    const groupRef = db
      .collection("groups")
      .doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return {
        groupDeleted: false,
        gamesDeleted: 0,
        error: "Grupo não encontrado",
      };
    }

    if (groupSnap.data()?.deleted_at) {
      return {
        groupDeleted: false,
        gamesDeleted: 0,
        error: "Grupo já deletado",
      };
    }

    // 2. Soft-delete dos jogos do grupo
    // FIX #757 + #2499: paginação + UM acumulador com flush por limiar.
    // Antes: overflowBatch acumulava 450 ops/página e estourava 500 writes em
    // grupos com >1000 jogos (INVALID_ARGUMENT). Além disso, o group update
    // era commitado ANTES dos jogos do overflow → em falha, grupo ficava
    // DELETED com jogos órfãos ativos e a cascata não podia ser retentada
    // (guard "Grupo já deletado"). Agora: deleta TODOS os jogos primeiro
    // (flush a cada BATCH_LIMIT ops), e marca o grupo por ÚLTIMO. Em falha
    // parcial, o grupo permanece ativo → retry reprocessa (idempotente: pula
    // jogos já deletados). Verdadeira atomicidade >500 writes é impossível no
    // Firestore; esta ordem garante retry-safety.
    const BATCH_LIMIT = 450;
    let gamesDeleted = 0;
    let lastGameDoc: admin.firestore.QueryDocumentSnapshot | undefined;

    let batch = db.batch();
    let ops = 0;
    const flush = async () => {
      if (ops > 0) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    };

    // Processar jogos em páginas de 500 docs
    while (true) {
      let q = db
        .collection("games")
        .where("group_id", "==", groupId)
        .orderBy(FieldPath.documentId())
        .limit(500);
      if (lastGameDoc) q = q.startAfter(lastGameDoc);

      const gamesSnap = await q.get();
      if (gamesSnap.empty) break;

      for (const gameDoc of gamesSnap.docs) {
        if (gameDoc.data().deleted_at) continue; // idempotente em retry
        batch.update(gameDoc.ref, {
          deleted_at: now,
          deleted_by: deletedBy,
          deleted_reason: `Grupo deletado: ${reason}`,
          status: "DELETED",
          updated_at: now,
        });
        ops++;
        gamesDeleted++;
        if (ops >= BATCH_LIMIT) await flush();
      }

      lastGameDoc = gamesSnap.docs[gamesSnap.docs.length - 1];
      if (gamesSnap.size < 500) break;
    }

    // Flush dos jogos restantes antes de bloquear novas memberships.
    await flush();

    // Marca o início da deleção antes de escanear membros. A transação de
    // onInviteRedeemed lê este estado, impedindo que um resgate concorrente
    // crie membership ACTIVE depois que esta varredura passar pelo usuário.
    // Não usa deleted_at aqui: se a cascata falhar, uma nova execução ainda
    // consegue retomá-la e só o estado final DELETED é terminal.
    await groupRef.update({
      status: "DELETING",
      deletion_started_at: now,
      updated_at: now,
    });

    let lastMemberDoc: admin.firestore.QueryDocumentSnapshot | undefined;
    while (true) {
      let q = groupRef.collection("members")
        .orderBy(FieldPath.documentId())
        .limit(500);
      if (lastMemberDoc) q = q.startAfter(lastMemberDoc);

      const membersSnap = await q.get();
      if (membersSnap.empty) break;

      for (const memberDoc of membersSnap.docs) {
        const memberData = memberDoc.data();
        const memberUserId =
          typeof memberData.user_id === "string" ?
            memberData.user_id :
            memberDoc.id;

        if (memberData.status !== "INACTIVE" && memberData.status !== "REMOVED") {
          batch.update(memberDoc.ref, {
            status: "INACTIVE",
            updated_at: now,
          });
          ops++;
        }

        batch.delete(db.doc(`users/${memberUserId}/groups/${groupId}`));
        ops++;
        if (ops >= BATCH_LIMIT) await flush();
      }

      lastMemberDoc = membersSnap.docs[membersSnap.docs.length - 1];
      if (membersSnap.size < 500) break;
    }

    let lastJoinRequestDoc: admin.firestore.QueryDocumentSnapshot | undefined;
    while (true) {
      let q = groupRef.collection("join_requests")
        .orderBy(FieldPath.documentId())
        .limit(500);
      if (lastJoinRequestDoc) q = q.startAfter(lastJoinRequestDoc);

      const joinRequestsSnap = await q.get();
      if (joinRequestsSnap.empty) break;

      for (const joinRequestDoc of joinRequestsSnap.docs) {
        batch.delete(joinRequestDoc.ref);
        ops++;
        if (ops >= BATCH_LIMIT) await flush();
      }

      lastJoinRequestDoc = joinRequestsSnap.docs[joinRequestsSnap.docs.length - 1];
      if (joinRequestsSnap.size < 500) break;
    }

    let lastWallPostDoc: admin.firestore.QueryDocumentSnapshot | undefined;
    while (true) {
      let q = groupRef.collection("wall_posts")
        .orderBy(FieldPath.documentId())
        .limit(500);
      if (lastWallPostDoc) q = q.startAfter(lastWallPostDoc);

      const wallPostsSnap = await q.get();
      if (wallPostsSnap.empty) break;

      for (const wallPostDoc of wallPostsSnap.docs) {
        if (wallPostDoc.data().deleted_at) continue;
        batch.update(wallPostDoc.ref, {
          deleted_at: now,
          deleted_by: deletedBy,
          updated_at: now,
        });
        ops++;
        if (ops >= BATCH_LIMIT) await flush();
      }

      lastWallPostDoc = wallPostsSnap.docs[wallPostsSnap.docs.length - 1];
      if (wallPostsSnap.size < 500) break;
    }

    const cascadeRootCollection = async (
      collectionName: string,
      applyDoc: (doc: admin.firestore.QueryDocumentSnapshot) => boolean,
    ) => {
      let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
      while (true) {
        let q = db.collection(collectionName)
          .where("group_id", "==", groupId)
          .orderBy(FieldPath.documentId())
          .limit(500);
        if (lastDoc) q = q.startAfter(lastDoc);

        const snap = await q.get();
        if (snap.empty) break;

        for (const collectionDoc of snap.docs) {
          if (!applyDoc(collectionDoc)) continue;
          ops++;
          if (ops >= BATCH_LIMIT) await flush();
        }

        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.size < 500) break;
      }
    };

    await cascadeRootCollection("group_polls", (pollDoc) => {
      if (pollDoc.data().status === "CLOSED") return false;
      batch.update(pollDoc.ref, {
        status: "CLOSED",
        updated_at: now,
      });
      return true;
    });

    await cascadeRootCollection("group_invites", (inviteDoc) => {
      const status = inviteDoc.data().status;
      if (status === "ACCEPTED" || status === "REJECTED" || status === "CANCELLED") {
        return false;
      }
      batch.update(inviteDoc.ref, {
        status: "CANCELLED",
        updated_at: now,
      });
      return true;
    });

    await cascadeRootCollection("invites", (inviteDoc) => {
      if (inviteDoc.data().used === true) return false;
      batch.update(inviteDoc.ref, {
        expires_at: nowTimestamp,
      });
      return true;
    });

    await flush();

    // Estado terminal é aplicado por último; DELETING mantém o grupo fechado
    // a convites enquanto permite retomar uma cascata interrompida.
    await groupRef.update({
      deleted_at: now,
      deleted_by: deletedBy,
      deleted_reason: reason || "Grupo deletado pelo proprietário",
      status: "DELETED",
      updated_at: now,
    });

    logger.info(
      "[SOFT_DELETE_CASCADE] Grupo " +
      `${groupId}: 1 grupo + ` +
      `${gamesDeleted} jogos soft-deleted`
    );

    return {groupDeleted: true, gamesDeleted};
  } catch (error: unknown) {
    const typedError =
      error as Record<string, unknown>;
    logger.error(
      "[SOFT_DELETE_CASCADE] Erro para grupo " +
      `${groupId}:`,
      error
    );
    return {
      groupDeleted: false,
      gamesDeleted: 0,
      error:
        (typedError.message as string) ||
        "Erro desconhecido",
    };
  }
}
