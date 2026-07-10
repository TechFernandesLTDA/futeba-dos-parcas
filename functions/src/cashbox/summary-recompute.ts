import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {db} from "../_db";
import {
  CashboxSummaryState,
  cashboxContribution,
  cashboxOperationExpiresAt,
  cashboxSummaryPayload,
  cashboxSummaryState,
  reconcileCashboxSummaryForGroup,
} from "./summary";

type EntryData = Record<string, unknown> | undefined;

/**
 * Identifica a transição relevante do documento.
 * @param {EntryData} before Estado anterior.
 * @param {EntryData} after Estado posterior.
 * @return {string} Nome estável da operação.
 */
function operationName(before: EntryData, after: EntryData): string {
  if (!before && after) return "create";
  if (before && !after) return "delete";
  if (before?.status !== "VOIDED" && after?.status === "VOIDED") return "void";
  return "update";
}

/**
 * Reconhece writes KMP legados que já atualizaram o summary atomicamente.
 * @param {EntryData} before Estado anterior.
 * @param {EntryData} after Estado posterior.
 * @return {boolean} True quando o delta já foi aplicado pelo cliente legado.
 */
function legacyClientAlreadyApplied(before: EntryData, after: EntryData): boolean {
  const data = after || before;
  if (typeof data?.created_by_id !== "string" || data.created_by !== undefined) return false;
  if (!before && after) return true;
  return before?.status !== "VOIDED" &&
    after?.status === "VOIDED" &&
    after.updated_at === undefined;
}

/**
 * Fallback para escritas antigas que não passaram pelos callables do caixa.
 * O caminho normal já grava entry, summary e marcador na mesma transação; por
 * isso o trigger apenas confirma o marcador. Escritas legadas recebem delta
 * idempotente, sem varrer o ledger inteiro.
 */
export const onCashboxEntryWritten = onDocumentWritten(
  {
    document: "groups/{groupId}/cashbox/{entryId}",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    const groupId = event.params.groupId;
    const entryId = event.params.entryId;
    const before = event.data?.before.exists ? event.data.before.data() : undefined;
    const after = event.data?.after.exists ? event.data.after.data() : undefined;
    const operation = operationName(before, after);
    const groupRef = db().collection("groups").doc(groupId);
    const summaryRef = groupRef.collection("cashbox_summary").doc("current");
    const operationRef = groupRef.collection("cashbox_summary_ops")
      .doc(`${operation}_${entryId}`);
    const beforeContribution = cashboxContribution(before);
    const afterContribution = cashboxContribution(after);
    const legacyApplied = legacyClientAlreadyApplied(before, after);

    try {
      const result = await db().runTransaction(async (tx) => {
        const [summaryDoc, operationDoc] = await Promise.all([
          tx.get(summaryRef),
          tx.get(operationRef),
        ]);
        if (operationDoc.exists) return "already-applied";

        if (legacyApplied) {
          tx.set(operationRef, {
            operation: operation.toUpperCase(),
            entry_id: entryId,
            legacy_summary_applied: true,
            applied_at: FieldValue.serverTimestamp(),
            expires_at: cashboxOperationExpiresAt(),
          });
          return "legacy-applied";
        }

        const summary = cashboxSummaryState(summaryDoc);
        if (!summary) return "reconcile";

        const incomeDelta = afterContribution.incomeCents -
          beforeContribution.incomeCents;
        const expenseDelta = afterContribution.expenseCents -
          beforeContribution.expenseCents;
        const countDelta = afterContribution.entryCount -
          beforeContribution.entryCount;
        const nextState: CashboxSummaryState = {
          incomeCents: summary.incomeCents + incomeDelta,
          expenseCents: summary.expenseCents + expenseDelta,
          balanceCents: summary.balanceCents + incomeDelta - expenseDelta,
          entryCount: Math.max(0, summary.entryCount + countDelta),
          ledgerVersion: summary.ledgerVersion + 1,
          lastEntryAt: !before && after ?
            after.created_at ?? FieldValue.serverTimestamp() :
            summary.lastEntryAt,
        };
        tx.set(
          summaryRef,
          {
            ...cashboxSummaryPayload(nextState, "legacy_trigger"),
            source_event_version: event.time || "",
          },
          {merge: true}
        );
        tx.set(operationRef, {
          operation: operation.toUpperCase(),
          entry_id: entryId,
          ledger_version: nextState.ledgerVersion,
          source_event_id: event.id || "",
          applied_at: FieldValue.serverTimestamp(),
          expires_at: cashboxOperationExpiresAt(),
        });
        return "incremental";
      });

      if (result === "reconcile") {
        await reconcileCashboxSummaryForGroup(groupId, {
          source: "legacy_trigger_reconciliation",
          coveredOperationRef: operationRef,
        });
      }
      logger.info(`[CASHBOX] ${operation} ${result} grupo ${groupId}`);
    } catch (error) {
      logger.error(`[CASHBOX] atualização incremental falhou grupo ${groupId}:`, error);
      throw error;
    }
  }
);
