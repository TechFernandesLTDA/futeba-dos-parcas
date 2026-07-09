import * as functions from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {db} from "../_db";
import {
  CASHBOX_MAX_AMOUNT_CENTS,
  cashboxAmountToCents,
  centsToCashboxAmount,
} from "./money";

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

interface CashboxSummaryState {
  balanceCents: number;
  totalIncomeCents: number;
  totalExpenseCents: number;
  entryCount: number;
}

const LEDGER_PAGE_SIZE = 500;
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

/**
 * Recalcula o estado monetário a partir do ledger inteiro.
 * @param {Array<object>} docs Docs do ledger.
 * @return {CashboxSummaryState} Totais e saldo em centavos.
 */
function summarizeLedgerFromDocs(docs: Array<{data: () => Record<string, unknown>}>): CashboxSummaryState {
  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  let entryCount = 0;

  for (const snapshot of docs) {
    const data = snapshot.data();
    if (data.status === "VOIDED") continue;

    const amountCents = cashboxAmountToCents(data.amount);
    if (data.type === "INCOME") {
      totalIncomeCents += amountCents;
      entryCount += 1;
    } else if (data.type === "EXPENSE") {
      totalExpenseCents += amountCents;
      entryCount += 1;
    }
  }

  return {
    balanceCents: totalIncomeCents - totalExpenseCents,
    totalIncomeCents,
    totalExpenseCents,
    entryCount,
  };
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

  try {
    const result = await db().runTransaction(async (tx) => {
      const entryRef = cashboxRef.doc(requestId);
      const [groupDoc, memberDoc, userDoc, existingEntryDoc] = await Promise.all([
        tx.get(groupRef),
        tx.get(memberRef),
        tx.get(userRef),
        tx.get(entryRef),
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

      const ledgerDocs: Array<{data: () => Record<string, unknown>}> = [];
      let ledgerQuery: FirebaseFirestore.Query = cashboxRef.limit(LEDGER_PAGE_SIZE);
      while (true) {
        const ledgerPage = await tx.get(ledgerQuery);
        ledgerDocs.push(...ledgerPage.docs);
        if (ledgerPage.size < LEDGER_PAGE_SIZE) break;
        ledgerQuery = cashboxRef
          .startAfter(ledgerPage.docs[ledgerPage.docs.length - 1])
          .limit(LEDGER_PAGE_SIZE);
      }
      const summaryState = summarizeLedgerFromDocs(ledgerDocs);
      if (existingEntryDoc.exists) {
        const existingData = existingEntryDoc.data() || {};
        return {
          entryId: entryRef.id,
          balance: centsToCashboxAmount(summaryState.balanceCents),
          balanceCents: summaryState.balanceCents,
          duplicate: true,
          existingType: existingData.type,
        };
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
      const nextTotalIncomeCents = type === "INCOME" ?
        summaryState.totalIncomeCents + amountCents :
        summaryState.totalIncomeCents;
      const nextTotalExpenseCents = type === "EXPENSE" ?
        summaryState.totalExpenseCents + amountCents :
        summaryState.totalExpenseCents;
      const nextBalanceCents = nextTotalIncomeCents - nextTotalExpenseCents;

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

      tx.set(summaryRef, {
        balance: centsToCashboxAmount(nextBalanceCents),
        total_income: centsToCashboxAmount(nextTotalIncomeCents),
        total_expense: centsToCashboxAmount(nextTotalExpenseCents),
        entry_count: summaryState.entryCount + 1,
        last_entry_at: FieldValue.serverTimestamp(),
        truncated: false,
        recomputed_by_server: true,
        recomputed_at: FieldValue.serverTimestamp(),
      }, {merge: true});

      return {
        entryId: entryRef.id,
        balance: centsToCashboxAmount(nextBalanceCents),
        balanceCents: nextBalanceCents,
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
