import * as functions from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {db} from "../_db";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {RATE_LIMITS} from "../middleware/rate-limiter";
import {VERIFICATION_GRACE_END_MS} from "../auth/verification-grace";
import {
  CASHBOX_MAX_AMOUNT_CENTS,
  cashboxAmountToCents,
  centsToCashboxAmount,
} from "./money";
import {
  CASHBOX_LEDGER_SCAN_LIMIT_EXCEEDED,
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

const MONTHLY_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

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
export function isActiveGroupManager(
  memberData: Record<string, unknown> | undefined,
  groupData: Record<string, unknown> | undefined,
  userId: string
): boolean {
  if (groupData?.owner_id === userId) return true;

  const status = memberData?.status;
  const role = memberData?.role;
  return memberData?.user_id === userId &&
    status === "ACTIVE" &&
    (role === "ADMIN" || role === "OWNER");
}

interface VoidCashboxEntryData {
  groupId: string;
  entryId: string;
}

interface ReconcileCashboxSummaryData {
  groupId: string;
}

/**
 * Retorna true para IDs simples aceitos como segmento Firestore.
 * @param {string} value ID recebido.
 * @return {boolean} Se o valor e um segmento seguro.
 */
function isSafeDocumentId(value: string): boolean {
  return value.length > 0 && value.length <= 128 && !value.includes("/");
}

/**
 * Lê um valor monetário persistido em centavos sem aceitar coerção.
 * @param {unknown} value Valor bruto do documento.
 * @param {string} field Nome do campo para diagnóstico.
 * @return {number} Valor inteiro não negativo.
 */
function storedNonNegativeCents(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `${field} precisa ser reconciliado`
    );
  }
  return value as number;
}

/**
 * Normaliza uma string opcional limitada ou rejeita o payload.
 * @param {unknown} value Valor recebido.
 * @param {string} field Nome do campo.
 * @param {number} maxLength Limite de caracteres.
 * @return {string | null} String normalizada ou null.
 */
function optionalString(
  value: unknown,
  field: string,
  maxLength: number
): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `${field} inválido`
    );
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `${field} inválido`
    );
  }
  return normalized;
}

/**
 * Confere se um retry representa exatamente a movimentação já persistida.
 * @param {Record<string, unknown>} existing Entrada existente.
 * @param {object} input Intencao normalizada do caller.
 * @return {boolean} Se a operacao e um retry identico.
 */
function isSameCreateIntent(
  existing: Record<string, unknown>,
  input: {
    userId: string;
    type: "INCOME" | "EXPENSE";
    amountCents: number;
    description: string;
    category: string;
    customCategory: string | null;
    referenceDate: number | undefined;
    playerId: string | null;
    playerName: string | null;
    gameId: string | null;
    receiptUrl: string | null;
  }
): boolean {
  const existingAmountCents = Number.isSafeInteger(existing.amount_cents) ?
    existing.amount_cents as number :
    cashboxAmountToCents(existing.amount);
  return (existing.created_by ?? existing.created_by_id) === input.userId &&
    existing.type === input.type &&
    existingAmountCents === input.amountCents &&
    existing.description === input.description &&
    (existing.category ?? "OTHER") === input.category &&
    (existing.custom_category ?? null) === input.customCategory &&
    (existing.reference_date ?? undefined) === input.referenceDate &&
    (existing.player_id ?? null) === input.playerId &&
    (existing.player_name ?? null) === input.playerName &&
    (existing.game_id ?? null) === input.gameId &&
    (existing.receipt_url ?? null) === input.receiptUrl;
}

export const createCashboxEntry = functions.https.onCall<CreateCashboxEntryData>({
  region: "southamerica-east1",
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
  consumeAppCheckToken: false,
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Usuário precisa estar autenticado"
    );
  }
  const groupId = typeof request.data?.groupId === "string" ?
    request.data.groupId.trim() :
    "";
  const type = request.data?.type;
  const description = typeof request.data?.description === "string" ?
    request.data.description.trim() :
    "";
  const receiptUrl = optionalString(request.data?.receiptUrl, "receiptUrl", 2048);
  const amountCents = cashboxAmountToCents(request.data?.amount);
  const requestId = typeof request.data?.requestId === "string" ?
    request.data.requestId.trim() : "";
  const category = request.data?.category == null ?
    "OTHER" :
    optionalString(request.data.category, "category", 64) ?? "OTHER";
  const customCategory = optionalString(
    request.data?.customCategory,
    "customCategory",
    120
  );
  const playerId = optionalString(request.data?.playerId, "playerId", 128);
  const playerName = optionalString(request.data?.playerName, "playerName", 120);
  const gameId = optionalString(request.data?.gameId, "gameId", 128);
  const referenceDate = request.data?.referenceDate;

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

  if (!isSafeDocumentId(groupId)) {
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
  if ((playerId && !isSafeDocumentId(playerId)) ||
      (gameId && !isSafeDocumentId(gameId))) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "playerId ou gameId inválido"
    );
  }
  if (
    referenceDate !== undefined &&
    (typeof referenceDate !== "number" || !Number.isFinite(referenceDate))
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "referenceDate inválido"
    );
  }
  if (receiptUrl) {
    let protocol = "";
    try {
      protocol = new URL(receiptUrl).protocol;
    } catch {
      protocol = "";
    }
    if (protocol !== "https:") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "receiptUrl inválido"
      );
    }
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
      if (existingEntryDoc.exists) {
        const existingData = existingEntryDoc.data() || {};
        if (!isSameCreateIntent(existingData, {
          userId,
          type,
          amountCents,
          description,
          category,
          customCategory,
          referenceDate,
          playerId,
          playerName,
          gameId,
          receiptUrl,
        })) {
          throw new functions.https.HttpsError(
            "already-exists",
            "requestId já foi usado com outra transação"
          );
        }
        if (!summaryState) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Resumo do caixa precisa ser reconciliado"
          );
        }
        return {
          entryId: entryRef.id,
          balance: centsToCashboxAmount(summaryState.balanceCents),
          balanceCents: summaryState.balanceCents,
          duplicate: true,
          existingType: existingData.type,
        };
      }
      if (operationDoc.exists) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Marcador idempotente sem transação correspondente"
        );
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
        amount_cents: amountCents,
        description,
        category,
        status: "ACTIVE",
        ...(customCategory ? {custom_category: customCategory} : {}),
        ...(referenceDate !== undefined ? {reference_date: referenceDate} : {}),
        ...(playerId ? {player_id: playerId} : {}),
        ...(playerName ? {player_name: playerName} : {}),
        ...(gameId ? {game_id: gameId} : {}),
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
  if (!isSafeDocumentId(groupId) || !isSafeDocumentId(entryId)) {
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

      const entry = entryDoc.data() || {};
      const isManagedMonthlyEntry =
        entry.monthly_settlement_path != null ||
        (entry.category === "MONTHLY_FEE" && entry.monthly_period_key != null);
      let monthlyReversal: {
        periodRef: FirebaseFirestore.DocumentReference;
        payerRef: FirebaseFirestore.DocumentReference;
        settlementRef: FirebaseFirestore.DocumentReference;
        nextPaidCents: number;
        nextOutstandingCents: number;
        nextPayerStatus: "PENDING" | "PARTIAL" | "PAID";
        nextReceivedCents: number;
        nextOpenCents: number;
        nextSettlementCount: number;
        nextPeriodStatus: "DRAFT" | "FINALIZED";
        nextPaymentCount: number;
        clearLastPayment: boolean;
        previousPaymentEntryId: string | null;
        previousPaymentSequence: number | null;
        previousPaymentAt: unknown | null;
      } | null = null;

      if (isManagedMonthlyEntry) {
        const periodKey = typeof entry.monthly_period_key === "string" ?
          entry.monthly_period_key : "";
        const payerId = typeof entry.monthly_payer_id === "string" ?
          entry.monthly_payer_id : "";
        const requestId = typeof entry.request_id === "string" ?
          entry.request_id : "";
        if (entry.category !== "MONTHLY_FEE" || entry.type !== "INCOME" ||
            !MONTHLY_PERIOD_PATTERN.test(periodKey) ||
            !isSafeDocumentId(payerId) || !isSafeDocumentId(requestId)) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Vínculo da mensalidade precisa ser reconciliado"
          );
        }

        const periodRef = groupRef.collection("monthly_finance_periods")
          .doc(periodKey);
        const payerRef = periodRef.collection("payers").doc(payerId);
        const settlementRef = periodRef.collection("settlements").doc(requestId);
        if (entry.monthly_settlement_path !== settlementRef.path) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Vínculo da baixa mensal é inconsistente"
          );
        }

        const [periodDoc, payerDoc, settlementDoc] = await Promise.all([
          tx.get(periodRef),
          tx.get(payerRef),
          tx.get(settlementRef),
        ]);
        if (!periodDoc.exists || !payerDoc.exists || !settlementDoc.exists) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Baixa mensal precisa ser reconciliada antes do estorno"
          );
        }

        const period = periodDoc.data() || {};
        const payer = payerDoc.data() || {};
        const settlement = settlementDoc.data() || {};
        const paymentSequence = storedNonNegativeCents(
          settlement.payment_sequence,
          "payment_sequence"
        );
        const amountCents = contribution.incomeCents;
        const expectedCents = storedNonNegativeCents(
          payer.expected_cents,
          "expected_cents"
        );
        const paidCents = storedNonNegativeCents(payer.paid_cents, "paid_cents");
        const outstandingCents = storedNonNegativeCents(
          payer.outstanding_cents,
          "outstanding_cents"
        );
        const receivedCents = storedNonNegativeCents(
          period.received_cents,
          "received_cents"
        );
        const openCents = storedNonNegativeCents(
          period.open_cents,
          "open_cents"
        );
        const totalCents = storedNonNegativeCents(
          period.total_court_cost_cents,
          "total_court_cost_cents"
        );
        if (amountCents <= 0 || settlement.status !== "ACTIVE" ||
            settlement.request_id !== requestId ||
            settlement.payer_id !== payerId ||
            settlement.period_key !== periodKey ||
            settlement.cashbox_entry_id !== entryId ||
            settlement.amount_cents !== amountCents ||
            paymentSequence <= 0 ||
            entry.monthly_payment_sequence !== paymentSequence ||
            payer.user_id !== payerId || payer.period_key !== periodKey ||
            paidCents < amountCents ||
            paidCents + outstandingCents !== expectedCents ||
            receivedCents < amountCents ||
            receivedCents + openCents !== totalCents) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Totais da mensalidade precisam ser reconciliados"
          );
        }

        const activeSettlementsQuery = periodRef.collection("settlements")
          .where("status", "==", "ACTIVE")
          .limit(2);
        const activeSettlements = await tx.get(activeSettlementsQuery);
        const hasOtherActiveSettlement = activeSettlements.docs.some((doc) =>
          doc.id !== requestId && doc.data()?.status === "ACTIVE"
        );

        const nextPaidCents = paidCents - amountCents;
        const nextOutstandingCents = expectedCents - nextPaidCents;
        const nextPayerStatus = nextPaidCents === 0 ? "PENDING" :
          nextPaidCents < expectedCents ? "PARTIAL" : "PAID";
        const nextReceivedCents = receivedCents - amountCents;
        const nextSettlementCount = Math.max(
          0,
          Number.isSafeInteger(period.settlement_count) ?
            (period.settlement_count as number) - 1 : 0
        );
        const nextPeriodStatus = nextReceivedCents === 0 &&
          !hasOtherActiveSettlement ? "DRAFT" : "FINALIZED";
        const clearLastPayment = payer.last_payment_entry_id === entryId;
        let previousPaymentEntryId: string | null = null;
        let previousPaymentSequence: number | null = null;
        let previousPaymentAt: unknown | null = null;
        if (clearLastPayment) {
          const activeSettlementsQuery = periodRef.collection("settlements")
            .where("payer_id", "==", payerId)
            .where("status", "==", "ACTIVE")
            .orderBy("payment_sequence", "desc")
            .limit(2);
          const activeSettlements = await tx.get(activeSettlementsQuery);
          const previous = activeSettlements.docs
            .map((doc) => ({id: doc.id, data: doc.data() || {}}))
            .filter(({id, data}) =>
              id !== requestId &&
              data.payer_id === payerId &&
              data.status === "ACTIVE" &&
              Number.isSafeInteger(data.payment_sequence) &&
              (data.payment_sequence as number) > 0 &&
              typeof data.cashbox_entry_id === "string"
            )
            .sort((left, right) =>
              (right.data.payment_sequence as number) -
              (left.data.payment_sequence as number)
            )[0];
          if (previous) {
            previousPaymentEntryId = previous.data.cashbox_entry_id as string;
            previousPaymentSequence = previous.data.payment_sequence as number;
            previousPaymentAt = previous.data.created_at ?? null;
          }
        }
        monthlyReversal = {
          periodRef,
          payerRef,
          settlementRef,
          nextPaidCents,
          nextOutstandingCents,
          nextPayerStatus,
          nextReceivedCents,
          nextOpenCents: openCents + amountCents,
          nextSettlementCount,
          nextPeriodStatus,
          nextPaymentCount: Math.max(
            0,
            Number.isSafeInteger(payer.payment_count) ?
              (payer.payment_count as number) - 1 : 0
          ),
          clearLastPayment,
          previousPaymentEntryId,
          previousPaymentSequence,
          previousPaymentAt,
        };
      }

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
      if (monthlyReversal) {
        tx.update(monthlyReversal.payerRef, {
          paid_cents: monthlyReversal.nextPaidCents,
          outstanding_cents: monthlyReversal.nextOutstandingCents,
          status: monthlyReversal.nextPayerStatus,
          payment_count: monthlyReversal.nextPaymentCount,
          ...(monthlyReversal.clearLastPayment ? {
            last_payment_entry_id:
              monthlyReversal.previousPaymentEntryId,
            last_payment_sequence:
              monthlyReversal.previousPaymentSequence,
            last_payment_at: monthlyReversal.previousPaymentAt,
          } : {}),
          last_void_entry_id: entryId,
          last_voided_by: userId,
          last_voided_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
        tx.update(monthlyReversal.periodRef, {
          status: monthlyReversal.nextPeriodStatus,
          received_cents: monthlyReversal.nextReceivedCents,
          open_cents: monthlyReversal.nextOpenCents,
          settlement_count: monthlyReversal.nextSettlementCount,
          closed_by: FieldValue.delete(),
          closed_at: FieldValue.delete(),
          ...(monthlyReversal.nextPeriodStatus === "DRAFT" ? {
            finalized_by: FieldValue.delete(),
            finalized_at: FieldValue.delete(),
          } : {}),
          reopened_by: userId,
          reopened_at: FieldValue.serverTimestamp(),
          last_void_entry_id: entryId,
          updated_at: FieldValue.serverTimestamp(),
        });
        tx.update(monthlyReversal.settlementRef, {
          status: "VOIDED",
          charge_status_after_void: monthlyReversal.nextPayerStatus,
          paid_cents_after_void: monthlyReversal.nextPaidCents,
          outstanding_cents_after_void:
            monthlyReversal.nextOutstandingCents,
          period_status_after_void: monthlyReversal.nextPeriodStatus,
          voided_by: userId,
          voided_at: FieldValue.serverTimestamp(),
        });
      }
      tx.set(operationRef, {
        operation: "VOID",
        entry_id: entryId,
        monthly_reversed: monthlyReversal !== null,
        monthly_settlement_path: monthlyReversal?.settlementRef.path ?? null,
        ledger_version: nextState.ledgerVersion,
        applied_at: FieldValue.serverTimestamp(),
        expires_at: cashboxOperationExpiresAt(),
      });
      return {
        entryId,
        balance: centsToCashboxAmount(nextState.balanceCents),
        balanceCents: nextState.balanceCents,
        monthlyReversed: monthlyReversal !== null,
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
  secureCallable<ReconcileCashboxSummaryData>({
    // SECFIX #3881: era onCall cru sem rate limit — varredura completa do
    // ledger (até 3x em contenção de CAS) custava milhões de leituras/min
    // sustentado em loop. secureCallable ganha rate limit + audit log de
    // brinde. consumeAppCheckToken:true evita replay do token em loop.
    consumeAppCheckToken: true,
    rateLimit: RATE_LIMITS.CASHBOX_RECONCILE,
    auditLogContext: async (request: functions.https.CallableRequest) => {
      const data = request.data && typeof request.data === "object" ?
        request.data as Record<string, unknown> : {};
      return {
        action: "reconcile_cashbox_summary",
        group_id: typeof data.groupId === "string" ? data.groupId : null,
      };
    },
  }, async (request) => {
    const userId = request.auth?.uid;
    const groupId = typeof request.data?.groupId === "string" ?
      request.data.groupId.trim() : "";
    if (!userId) {
      throw new functions.https.HttpsError("unauthenticated", "Usuário precisa estar autenticado");
    }
    if (!isSafeDocumentId(groupId)) {
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
        authorizeTransaction: async (tx) => {
          const [freshGroup, freshMember] = await Promise.all([
            tx.get(groupRef),
            tx.get(groupRef.collection("members").doc(userId)),
          ]);
          if (!freshGroup.exists || isGroupUnavailable(freshGroup.data())) {
            throw new functions.https.HttpsError(
              "failed-precondition",
              "Grupo indisponível"
            );
          }
          if (!isActiveGroupManager(
            freshMember.exists ? freshMember.data() : undefined,
            freshGroup.data(),
            userId
          )) {
            throw new functions.https.HttpsError(
              "permission-denied",
              "Apenas administradores do grupo podem reconciliar o caixa"
            );
          }
        },
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
      if (error instanceof functions.https.HttpsError) throw error;
      logger.error(`[CASHBOX] reconciliação falhou para grupo ${groupId}:`, error);
      const isConflict = error instanceof Error &&
        error.message === "CASHBOX_RECONCILIATION_CONFLICT";
      const isTooLarge = error instanceof Error &&
        error.message === CASHBOX_LEDGER_SCAN_LIMIT_EXCEEDED;
      if (isTooLarge) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          "O caixa deste grupo é grande demais para reconciliar " +
          "automaticamente. Contate o suporte."
        );
      }
      throw new functions.https.HttpsError(
        isConflict ? "aborted" : "internal",
        "Não foi possível reconciliar o caixa"
      );
    }
  });
