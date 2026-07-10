import {
  FieldPath,
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import {db} from "../_db";
import {cashboxAmountToCents, centsToCashboxAmount} from "./money";

export const CASHBOX_LEDGER_PAGE_SIZE = 500;
export const CASHBOX_OPERATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RECONCILIATION_ATTEMPTS = 3;

/**
 * Expiração dos marcadores idempotentes para evitar crescimento ilimitado.
 * @return {Date} Instante de expiração aceito nativamente pelo Firestore.
 */
export function cashboxOperationExpiresAt(): Date {
  return new Date(Date.now() + CASHBOX_OPERATION_TTL_MS);
}

export interface CashboxContribution {
  incomeCents: number;
  expenseCents: number;
  entryCount: number;
}

export interface CashboxSummaryState extends CashboxContribution {
  balanceCents: number;
  ledgerVersion: number;
  lastEntryAt: unknown;
}

interface ReconcileOptions {
  source: string;
  coveredOperationRef?: FirebaseFirestore.DocumentReference;
}

/**
 * Normaliza contador/versionamento salvo no Firestore.
 * @param {unknown} value Valor bruto.
 * @return {number} Inteiro seguro ou zero.
 */
function safeInteger(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : 0;
}

/**
 * Retorna a contribuição ativa de uma entrada para o agregado.
 * @param {Record<string, unknown> | undefined} data Entrada bruta.
 * @return {CashboxContribution} Delta monetário em centavos.
 */
export function cashboxContribution(
  data: Record<string, unknown> | undefined
): CashboxContribution {
  if (!data || data.status === "VOIDED") {
    return {incomeCents: 0, expenseCents: 0, entryCount: 0};
  }

  const amountCents = cashboxAmountToCents(data.amount);
  if (amountCents <= 0) {
    return {incomeCents: 0, expenseCents: 0, entryCount: 0};
  }
  if (data.type === "INCOME") {
    return {incomeCents: amountCents, expenseCents: 0, entryCount: 1};
  }
  if (data.type === "EXPENSE") {
    return {incomeCents: 0, expenseCents: amountCents, entryCount: 1};
  }
  return {incomeCents: 0, expenseCents: 0, entryCount: 0};
}

/**
 * Converte summary/current para centavos e rejeita summaries não autoritativos.
 * @param {FirebaseFirestore.DocumentSnapshot} snapshot Snapshot do summary.
 * @return {CashboxSummaryState | null} Estado válido ou null.
 */
export function cashboxSummaryState(
  snapshot: FirebaseFirestore.DocumentSnapshot
): CashboxSummaryState | null {
  if (!snapshot.exists) return null;
  const data = snapshot.data() || {};
  if (data.recomputed_by_server !== true || data.truncated === true) return null;

  const incomeCents = Number.isSafeInteger(data.total_income_cents) ?
    data.total_income_cents as number :
    cashboxAmountToCents(data.total_income);
  const expenseCents = Number.isSafeInteger(data.total_expense_cents) ?
    data.total_expense_cents as number :
    cashboxAmountToCents(data.total_expense);
  const balanceCents = incomeCents - expenseCents;

  return {
    incomeCents,
    expenseCents,
    balanceCents,
    entryCount: Math.max(0, safeInteger(data.entry_count)),
    ledgerVersion: Math.max(0, safeInteger(data.ledger_version)),
    lastEntryAt: data.last_entry_at ?? null,
  };
}

/**
 * Cria payload canônico, mantendo BRL e centavos autoritativos.
 * @param {CashboxSummaryState} state Estado agregado.
 * @param {string} source Origem da atualização.
 * @return {Record<string, unknown>} Payload para summary/current.
 */
export function cashboxSummaryPayload(
  state: CashboxSummaryState,
  source: string
): Record<string, unknown> {
  return {
    balance: centsToCashboxAmount(state.balanceCents),
    total_income: centsToCashboxAmount(state.incomeCents),
    total_expense: centsToCashboxAmount(state.expenseCents),
    balance_cents: state.balanceCents,
    total_income_cents: state.incomeCents,
    total_expense_cents: state.expenseCents,
    entry_count: state.entryCount,
    last_entry_at: state.lastEntryAt,
    ledger_version: state.ledgerVersion,
    summary_version: state.ledgerVersion,
    truncated: false,
    recomputed_by_server: true,
    recomputed_at: FieldValue.serverTimestamp(),
    summary_source: source,
  };
}

/**
 * Converte timestamps aceitos para epoch millis.
 * @param {unknown} value Timestamp bruto.
 * @return {number} Epoch millis ou zero.
 */
function createdAtMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Percorre todo o ledger com cursor estável por documentId.
 * @param {FirebaseFirestore.CollectionReference} cashboxRef Coleção do ledger.
 * @return {Promise<Omit<CashboxSummaryState, "ledgerVersion">>} Totais lidos.
 */
async function scanCashboxLedger(
  cashboxRef: FirebaseFirestore.CollectionReference
): Promise<Omit<CashboxSummaryState, "ledgerVersion">> {
  let incomeCents = 0;
  let expenseCents = 0;
  let entryCount = 0;
  let lastEntryMillis = 0;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let pageQuery: FirebaseFirestore.Query = cashboxRef
      .orderBy(FieldPath.documentId())
      .limit(CASHBOX_LEDGER_PAGE_SIZE);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);

    const page = await pageQuery.get();
    for (const snapshot of page.docs) {
      const data = snapshot.data();
      const contribution = cashboxContribution(data);
      incomeCents += contribution.incomeCents;
      expenseCents += contribution.expenseCents;
      entryCount += contribution.entryCount;
      if (contribution.entryCount > 0) {
        lastEntryMillis = Math.max(
          lastEntryMillis,
          createdAtMillis(data.created_at)
        );
      }
    }

    if (page.size < CASHBOX_LEDGER_PAGE_SIZE) break;
    cursor = page.docs[page.docs.length - 1] || null;
  }

  return {
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    entryCount,
    lastEntryAt: lastEntryMillis > 0 ? Timestamp.fromMillis(lastEntryMillis) : null,
  };
}

/**
 * Reconcilia o ledger paginado. A gravação só ocorre se nenhum write
 * incremental alterou ledger_version durante a varredura.
 * @param {string} groupId Grupo a reconciliar.
 * @param {ReconcileOptions} options Origem e marcador opcional coberto.
 * @return {Promise<CashboxSummaryState>} Summary reconciliado.
 */
export async function reconcileCashboxSummaryForGroup(
  groupId: string,
  options: ReconcileOptions
): Promise<CashboxSummaryState> {
  const groupRef = db().collection("groups").doc(groupId);
  const cashboxRef = groupRef.collection("cashbox");
  const summaryRef = groupRef.collection("cashbox_summary").doc("current");

  for (let attempt = 0; attempt < RECONCILIATION_ATTEMPTS; attempt += 1) {
    const startingSummary = await summaryRef.get();
    const startingVersion = cashboxSummaryState(startingSummary)?.ledgerVersion ??
      Math.max(0, safeInteger(startingSummary.data()?.ledger_version));
    const scanned = await scanCashboxLedger(cashboxRef);
    const nextState: CashboxSummaryState = {
      ...scanned,
      ledgerVersion: startingVersion,
    };

    const committed = await db().runTransaction(async (tx) => {
      const refs: FirebaseFirestore.DocumentReference[] = [summaryRef];
      if (options.coveredOperationRef) refs.push(options.coveredOperationRef);
      const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
      const currentSummary = snapshots[0];
      const currentVersion = cashboxSummaryState(currentSummary)?.ledgerVersion ??
        Math.max(0, safeInteger(currentSummary.data()?.ledger_version));
      if (currentVersion !== startingVersion) return false;

      tx.set(summaryRef, cashboxSummaryPayload(nextState, options.source), {merge: true});
      if (options.coveredOperationRef && !snapshots[1]?.exists) {
        tx.set(options.coveredOperationRef, {
          reconciled: true,
          applied_at: FieldValue.serverTimestamp(),
          expires_at: cashboxOperationExpiresAt(),
        });
      }
      return true;
    });

    if (committed) return nextState;
  }

  throw new Error("CASHBOX_RECONCILIATION_CONFLICT");
}
