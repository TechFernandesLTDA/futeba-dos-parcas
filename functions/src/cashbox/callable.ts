import * as functions from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {db} from "../_db";
import {
  CASHBOX_MAX_AMOUNT_CENTS,
  cashboxAmountToCents,
  centsToCashboxAmount,
} from "./money";
import {
  CashboxSummaryState,
  cashboxContribution,
  cashboxOperationExpiresAt,
  cashboxSummaryPayload,
  cashboxSummaryState,
  reconcileCashboxSummaryForGroup,
} from "./summary";

interface CreateCashboxEntryData {
  groupId: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  receiptUrl?: string | null;
  requestId: string;
  category?: string;
  customCategory?: string | null;
  referenceDate?: number;
  playerId?: string | null;
  playerName?: string | null;
  gameId?: string | null;
}

const VERIFICATION_GRACE_END_MS = Date.UTC(2026, 7, 3);

/**
 * Detecta grupos indisponíveis para novas movimentações.
 * @param {Record<string, unknown> | undefined} raw Documento bruto do grupo.
 * @return {boolean} True quando o grupo está deletado/inativo.
 */
function isGroupUnavailable(raw: Record<string, unknown> | undefined): boolean {
  if (!raw) return true;
  return raw.deleted_at !== null && raw.deleted_at !== undefined ||
    raw.deletedAt !== null && raw.deletedAt !== undefined ||
    raw.status === "DELETED" ||
    raw.is_active === false;
}

/**
 * Valida se o usuário pode movimentar o caixa do grupo.
 * @param {Record<string, unknown> | undefined} memberData Membership do usuário.
 * @param {Record<string, unknown> | undefined} groupData Documento do grupo.
 * @param {string} userId UID autenticado.
 * @return {boolean} True para owner/admin ativo.
 */
function isActiveGroupManager(
  memberData: Record<string, unknown> | undefined,
  groupData: Record<string, unknown> | undefined,
  userId: string
): boolean {
  if (groupData?.owner_id === userId) return true;

  const status = memberData?.status;
  const role = memberData?.role;
  return status === "ACTIVE" && (role === "ADMIN" || role === "OWNER");
}

interface VoidCashboxEntryData {
  groupId: string;
  entryId: string;
}

interface ReconcileCashboxSummaryData {
  groupId: string;
}

export const createCashboxEntry = functions.https.onCall<CreateCashboxEntryData>({
  region: "southamerica-east1",
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
  consumeAppCheckToken: false,
}, async (request) => {
  const userId = request.auth?.uid;
  const groupId = typeof request.data?.groupId === "string" ?
    request.data.groupId.trim() :
    "";
  const type = request.data?.type;
  const description = typeof request.data?.description === "string" ?
    request.data.description.trim() :
    "";
  const receiptUrl = typeof request.data?.receiptUrl === "string" &&
    request.data.receiptUrl.trim().length > 0 ?
    request.data.receiptUrl.trim() :
    null;
  const amountCents = cashboxAmountToCents(request.data?.amount);
  const requestId = typeof request.data?.requestId === "string" ?
    request.data.requestId.trim() : "";
  const category = typeof request.data?.category === "string" &&
    request.data.category.trim().length > 0 ? request.data.category.trim() : "OTHER";

  if (!userId) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Usuário precisa estar autenticado"
    );
  }

  const authToken: Record<string, unknown> = request.auth?.token || {};
  const isGlobalAdmin = authToken.admin === true || authToken.role === "ADMIN";
  const isVerifiedOrGrace = authToken.verified === true ||
    Date.now() < VERIFICATION_GRACE_END_MS;
  if (!isGlobalAdmin && !isVerifiedOrGrace) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Verificação necessária para movimentar o caixa"
    );
  }

  if (!groupId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "groupId é obrigatório"
    );
  }

  if (type !== "INCOME" && type !== "EXPENSE") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Tipo de transação inválido"
    );
  }

  if (amountCents <= 0 || amountCents > CASHBOX_MAX_AMOUNT_CENTS) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Valor da transação inválido"
    );
  }

  if (!description || description.length > 500) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Descrição da transação inválida"
    );
  }

  if (!requestId || !/^[A-Za-z0-9_-]{16,128}$/.test(requestId)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "requestId inválido"
    );
  }

  const groupRef = db().collection("groups").doc(groupId);
  const memberRef = groupRef.collection("members").doc(userId);
  const summaryRef = groupRef.collection("cashbox_summary").doc("current");
  const userRef = db().collection("users").doc(userId);
  const cashboxRef = groupRef.collection("cashbox");
  const operationRef = groupRef.collection("cashbox_summary_ops")
    .doc(`create_${requestId}`);

  try {
    const result = await db().runTransaction(async (tx) => {
      const entryRef = cashboxRef.doc(requestId);
      const [
        groupDoc,
        memberDoc,
        userDoc,
        existingEntryDoc,
        summaryDoc,
        operationDoc,
      ] = await Promise.all([
        tx.get(groupRef),
        tx.get(memberRef),
        tx.get(userRef),
        tx.get(entryRef),
        tx.get(summaryRef),
        tx.get(operationRef),
      ]);

      if (!groupDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Grupo não encontrado"
        );
      }

      const groupData = groupDoc.data() || {};
      const memberData = memberDoc.exists ? memberDoc.data() || {} : undefined;

      if (isGroupUnavailable(groupData)) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Grupo indisponível para movimentações no caixa"
        );
      }

      if (!isActiveGroupManager(memberData, groupData, userId)) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Apenas administradores do grupo podem registrar transações"
        );
      }

      const summaryState = cashboxSummaryState(summaryDoc);
      if (existingEntryDoc.exists || operationDoc.exists) {
        const existingData = existingEntryDoc.data() || {};
        return {
          entryId: entryRef.id,
          balance: centsToCashboxAmount(summaryState?.balanceCents ?? 0),
          balanceCents: summaryState?.balanceCents ?? 0,
          duplicate: true,
          existingType: existingData.type,
        };
      }

      if (!summaryState) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Resumo do caixa precisa ser reconciliado"
        );
      }

      if (type === "EXPENSE" && amountCents > summaryState.balanceCents) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Saldo insuficiente para registrar essa saída"
        );
      }

      const createdByName = typeof request.auth?.token?.name === "string" &&
        request.auth.token.name.trim().length > 0 ?
        request.auth.token.name.trim() :
        typeof userDoc.data()?.name === "string" &&
          userDoc.data()?.name.trim().length > 0 ?
          userDoc.data()?.name.trim() :
          "Usuário";
      const normalizedAmount = centsToCashboxAmount(amountCents);
      const contribution = cashboxContribution({type, amount: normalizedAmount});
      const nextState: CashboxSummaryState = {
        incomeCents: summaryState.incomeCents + contribution.incomeCents,
        expenseCents: summaryState.expenseCents + contribution.expenseCents,
        balanceCents: summaryState.balanceCents +
          contribution.incomeCents - contribution.expenseCents,
        entryCount: summaryState.entryCount + 1,
        ledgerVersion: summaryState.ledgerVersion + 1,
        lastEntryAt: FieldValue.serverTimestamp(),
      };

      tx.set(entryRef, {
        group_id: groupId,
        type,
        amount: normalizedAmount,
        description,
        category,
        status: "ACTIVE",
        ...(request.data?.customCategory ? {custom_category: request.data.customCategory} : {}),
        ...(typeof request.data?.referenceDate === "number" ?
          {reference_date: request.data.referenceDate} : {}),
        ...(request.data?.playerId ? {player_id: request.data.playerId} : {}),
        ...(request.data?.playerName ? {player_name: request.data.playerName} : {}),
        ...(request.data?.gameId ? {game_id: request.data.gameId} : {}),
        ...(receiptUrl ? {receipt_url: receiptUrl} : {}),
        created_by: userId,
        created_by_id: userId,
        created_by_name: createdByName,
        created_at: FieldValue.serverTimestamp(),
      });

      tx.set(
        summaryRef,
        cashboxSummaryPayload(nextState, "create_callable"),
        {merge: true}
      );
      tx.set(operationRef, {
        operation: "CREATE",
        entry_id: entryRef.id,
        ledger_version: nextState.ledgerVersion,
        applied_at: FieldValue.serverTimestamp(),
        expires_at: cashboxOperationExpiresAt(),
      });

      return {
        entryId: entryRef.id,
        balance: centsToCashboxAmount(nextState.balanceCents),
        balanceCents: nextState.balanceCents,
        duplicate: false,
      };
    });

    logger.info(`[CASHBOX] entry criada via callable para grupo ${groupId}`);
    return result;
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    logger.error(`[CASHBOX] erro ao criar entry via callable para grupo ${groupId}:`, error);
    throw new functions.https.HttpsError(
      "internal",
      "Erro ao registrar transação no caixa"
    );
  }
});

export const voidCashboxEntry = functions.https.onCall<VoidCashboxEntryData>({
  region: "southamerica-east1",
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
  consumeAppCheckToken: false,
}, async (request) => {
  const userId = request.auth?.uid;
  const groupId = typeof request.data?.groupId === "string" ?
    request.data.groupId.trim() : "";
  const entryId = typeof request.data?.entryId === "string" ?
    request.data.entryId.trim() : "";
  if (!userId) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário precisa estar autenticado");
  }
  if (!groupId || !entryId) {
    throw new functions.https.HttpsError("invalid-argument", "groupId e entryId são obrigatórios");
  }

  const groupRef = db().collection("groups").doc(groupId);
  const memberRef = groupRef.collection("members").doc(userId);
  const entryRef = groupRef.collection("cashbox").doc(entryId);
  const summaryRef = groupRef.collection("cashbox_summary").doc("current");
  const operationRef = groupRef.collection("cashbox_summary_ops")
    .doc(`void_${entryId}`);

  try {
    return await db().runTransaction(async (tx) => {
      const [groupDoc, memberDoc, entryDoc, summaryDoc, operationDoc] =
        await Promise.all([
          tx.get(groupRef),
          tx.get(memberRef),
          tx.get(entryRef),
          tx.get(summaryRef),
          tx.get(operationRef),
        ]);
      if (!groupDoc.exists || isGroupUnavailable(groupDoc.data())) {
        throw new functions.https.HttpsError("failed-precondition", "Grupo indisponível");
      }
      if (!isActiveGroupManager(
        memberDoc.exists ? memberDoc.data() : undefined,
        groupDoc.data(),
        userId
      )) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Apenas administradores do grupo podem estornar transações"
        );
      }
      if (!entryDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Transação não encontrada");
      }

      const summaryState = cashboxSummaryState(summaryDoc);
      if (operationDoc.exists || entryDoc.data()?.status === "VOIDED") {
        return {
          entryId,
          balance: centsToCashboxAmount(summaryState?.balanceCents ?? 0),
          balanceCents: summaryState?.balanceCents ?? 0,
          duplicate: true,
        };
      }
      if (!summaryState) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Resumo do caixa precisa ser reconciliado"
        );
      }

      const contribution = cashboxContribution(entryDoc.data());
      const nextState: CashboxSummaryState = {
        incomeCents: summaryState.incomeCents - contribution.incomeCents,
        expenseCents: summaryState.expenseCents - contribution.expenseCents,
        balanceCents: summaryState.balanceCents -
          contribution.incomeCents + contribution.expenseCents,
        entryCount: Math.max(0, summaryState.entryCount - contribution.entryCount),
        ledgerVersion: summaryState.ledgerVersion + 1,
        lastEntryAt: summaryState.lastEntryAt,
      };

      tx.update(entryRef, {
        status: "VOIDED",
        voided_by: userId,
        voided_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      tx.set(
        summaryRef,
        cashboxSummaryPayload(nextState, "void_callable"),
        {merge: true}
      );
      tx.set(operationRef, {
        operation: "VOID",
        entry_id: entryId,
        ledger_version: nextState.ledgerVersion,
        applied_at: FieldValue.serverTimestamp(),
        expires_at: cashboxOperationExpiresAt(),
      });
      return {
        entryId,
        balance: centsToCashboxAmount(nextState.balanceCents),
        balanceCents: nextState.balanceCents,
        duplicate: false,
      };
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    logger.error(`[CASHBOX] erro ao estornar entry ${entryId}:`, error);
    throw new functions.https.HttpsError("internal", "Erro ao estornar transação");
  }
});

export const reconcileCashboxSummary =
  functions.https.onCall<ReconcileCashboxSummaryData>({
    region: "southamerica-east1",
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: false,
  }, async (request) => {
    const userId = request.auth?.uid;
    const groupId = typeof request.data?.groupId === "string" ?
      request.data.groupId.trim() : "";
    if (!userId) {
      throw new functions.https.HttpsError("unauthenticated", "Usuário precisa estar autenticado");
    }
    if (!groupId) {
      throw new functions.https.HttpsError("invalid-argument", "groupId é obrigatório");
    }

    const groupRef = db().collection("groups").doc(groupId);
    const [groupDoc, memberDoc] = await Promise.all([
      groupRef.get(),
      groupRef.collection("members").doc(userId).get(),
    ]);
    if (!groupDoc.exists || isGroupUnavailable(groupDoc.data())) {
      throw new functions.https.HttpsError("failed-precondition", "Grupo indisponível");
    }
    if (!isActiveGroupManager(
      memberDoc.exists ? memberDoc.data() : undefined,
      groupDoc.data(),
      userId
    )) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Apenas administradores do grupo podem reconciliar o caixa"
      );
    }

    try {
      const summary = await reconcileCashboxSummaryForGroup(groupId, {
        source: "reconcile_callable",
      });
      return {
        balance: centsToCashboxAmount(summary.balanceCents),
        balanceCents: summary.balanceCents,
        totalIncome: centsToCashboxAmount(summary.incomeCents),
        totalExpense: centsToCashboxAmount(summary.expenseCents),
        entryCount: summary.entryCount,
        ledgerVersion: summary.ledgerVersion,
      };
    } catch (error) {
      logger.error(`[CASHBOX] reconciliação falhou para grupo ${groupId}:`, error);
      throw new functions.https.HttpsError(
        error instanceof Error && error.message === "CASHBOX_RECONCILIATION_CONFLICT" ?
          "aborted" : "internal",
        "Não foi possível reconciliar o caixa"
      );
    }
  });
