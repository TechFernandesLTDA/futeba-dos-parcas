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

import * as admin from "firebase-admin";

const getDb = () => admin.firestore();

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
      console.log(
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
        admin.firestore.FieldValue
          .serverTimestamp(),
      deleted_by: deletedBy,
      updated_at:
        admin.firestore.FieldValue
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

    console.log(
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
    console.error(
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
        admin.firestore.FieldValue.delete(),
      deleted_by:
        admin.firestore.FieldValue.delete(),
      deleted_reason:
        admin.firestore.FieldValue.delete(),
      updated_at:
        admin.firestore.FieldValue
          .serverTimestamp(),
      restored_at:
        admin.firestore.FieldValue
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

    console.log(
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
    console.error(
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
    console.error(
      "[SOFT_DELETE] Erro ao verificar " +
      `${collection}/${docId}:`,
      error
    );
    return false;
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
 * @return {Promise<CleanupResult>} Resultado
 */
export async function cleanupSoftDeleted(
  collection: string,
  retentionDays = 30,
  maxBatches = 10,
  batchSize = 100
): Promise<CleanupResult> {
  const db = getDb();
  const startTime = Date.now();

  const cutoffDate = new Date();
  cutoffDate.setDate(
    cutoffDate.getDate() - retentionDays
  );
  const cutoffTimestamp =
    admin.firestore.Timestamp.fromDate(cutoffDate);

  let totalDeleted = 0;
  let batchCount = 0;

  try {
    const query = db
      .collection(collection)
      .where("deleted_at", "<", cutoffTimestamp)
      .orderBy("deleted_at")
      .limit(batchSize);

    let hasMore = true;

    while (hasMore && batchCount < maxBatches) {
      const snapshot = await query.get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      // Deletar permanentemente em batch
      const batch = db.batch();
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
      }

      await batch.commit();
      totalDeleted += snapshot.size;
      batchCount++;

      console.log(
        "[SOFT_DELETE_CLEANUP] Batch " +
        `${batchCount}: ${snapshot.size} ` +
        "documentos removidos de " +
        `${collection}`
      );

      if (snapshot.size < batchSize) {
        hasMore = false;
      }
    }

    const durationMs = Date.now() - startTime;

    console.log(
      "[SOFT_DELETE_CLEANUP] " +
      `${collection}: ${totalDeleted} ` +
      "documentos permanentemente removidos " +
      `em ${batchCount} batches ` +
      `(${durationMs}ms)`
    );

    return {
      collection,
      totalDeleted,
      batchCount,
      cutoffDate,
      durationMs,
    };
  } catch (error: unknown) {
    console.error(
      "[SOFT_DELETE_CLEANUP] Erro em " +
      `${collection}:`,
      error
    );
    return {
      collection,
      totalDeleted,
      batchCount,
      cutoffDate,
      durationMs: Date.now() - startTime,
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
    const batch = db.batch();
    const now =
      admin.firestore.FieldValue.serverTimestamp();

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

    batch.update(groupRef, {
      deleted_at: now,
      deleted_by: deletedBy,
      deleted_reason:
        reason || "Grupo deletado pelo proprietário",
      updated_at: now,
    });

    // 2. Soft-delete dos jogos do grupo
    const gamesSnap = await db
      .collection("games")
      .where("group_id", "==", groupId)
      .get();

    let gamesDeleted = 0;

    for (const gameDoc of gamesSnap.docs) {
      const gameData = gameDoc.data();

      // Pular jogos já deletados
      if (gameData.deleted_at) continue;

      batch.update(gameDoc.ref, {
        deleted_at: now,
        deleted_by: deletedBy,
        deleted_reason:
          `Grupo deletado: ${reason}`,
        status: "DELETED",
        updated_at: now,
      });

      gamesDeleted++;
    }

    await batch.commit();

    console.log(
      "[SOFT_DELETE_CASCADE] Grupo " +
      `${groupId}: 1 grupo + ` +
      `${gamesDeleted} jogos soft-deleted`
    );

    return {groupDeleted: true, gamesDeleted};
  } catch (error: unknown) {
    const typedError =
      error as Record<string, unknown>;
    console.error(
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
