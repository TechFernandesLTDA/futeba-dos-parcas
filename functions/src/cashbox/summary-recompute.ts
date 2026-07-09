import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {db} from "../_db";
import {cashboxAmountToCents, centsToCashboxAmount} from "./money";

/**
 * Auditoria 2026-05-30 #2352 — recompute server-side de cashbox_summary.
 *
 * Antes: o cliente (group admin) gravava `cashbox_summary/current` com
 * `balance` arbitrario; a rule so validava tipos (`balance is number`), nao
 * a consistencia `balance == total_income - total_expense`. Um admin podia
 * exibir um saldo divergente do ledger real.
 *
 * Validar a igualdade na rule (float) travaria writes legitimos por
 * arredondamento. Em vez disso, esta CF recomputa o summary a partir do
 * ledger imutavel (`cashbox`) a CADA escrita de entry — tornando o
 * summary self-healing: o valor exibido converge sempre para os lancamentos
 * reais, independente do que o cliente gravou.
 *
 * Espelha a logica de `recalculateCashboxBalance` (FirebaseDataSource.kt):
 * soma INCOME/EXPENSE de entries nao-VOIDED. Inclui legacy entries sem
 * campo `status` (#2363) e normaliza valores antigos para centavos antes
 * de voltar para BRL no summary.
 */
const PAGE_SIZE = 500;

export const onCashboxEntryWritten = onDocumentWritten(
  {
    // region herdada de setGlobalOptions (southamerica-east1)
    document: "groups/{groupId}/cashbox/{entryId}",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    const groupId = event.params.groupId;
    try {
      const groupRef = db().collection("groups").doc(groupId);
      const cashboxRef = groupRef.collection("cashbox");

      let totalIncomeCents = 0;
      let totalExpenseCents = 0;
      let entryCount = 0;
      let lastEntryMillis = 0;
      let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

      while (true) {
        let pageQuery: FirebaseFirestore.Query = cashboxRef.limit(PAGE_SIZE);
        if (lastDoc) {
          pageQuery = pageQuery.startAfter(lastDoc);
        }

        const page = await pageQuery.get();
        if (page.empty) break;

        for (const snapshot of page.docs) {
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

          const createdAt = data.created_at;
          let createdMillis = 0;
          if (createdAt instanceof Timestamp) {
            createdMillis = createdAt.toMillis();
          } else if (typeof createdAt === "number") {
            createdMillis = createdAt;
          }

          if (createdMillis > lastEntryMillis) {
            lastEntryMillis = createdMillis;
          }
        }

        if (page.size < PAGE_SIZE) break;
        lastDoc = page.docs[page.docs.length - 1] || null;
      }

      const balanceCents = totalIncomeCents - totalExpenseCents;

      const summaryRef = groupRef.collection("cashbox_summary").doc("current");
      const eventVersion = event.time || "";
      const updated = await db().runTransaction(async (tx) => {
        const currentSummary = await tx.get(summaryRef);
        const currentVersion = currentSummary.exists &&
          typeof currentSummary.data()?.source_event_version === "string" ?
          currentSummary.data()?.source_event_version as string : "";
        if (eventVersion && currentVersion > eventVersion) return false;

        tx.set(summaryRef, {
          balance: centsToCashboxAmount(balanceCents),
          total_income: centsToCashboxAmount(totalIncomeCents),
          total_expense: centsToCashboxAmount(totalExpenseCents),
          entry_count: entryCount,
          last_entry_at: lastEntryMillis > 0 ?
            Timestamp.fromMillis(lastEntryMillis) :
            null,
          truncated: false,
          recomputed_by_server: true,
          recomputed_at: FieldValue.serverTimestamp(),
          source_event_version: eventVersion,
        }, {merge: true});
        return true;
      });

      logger.info(updated ?
        `[CASHBOX] summary recomputado grupo ${groupId}` :
        `[CASHBOX] recompute obsoleto ignorado grupo ${groupId}`
      );
    } catch (err) {
      logger.error(
        `[CASHBOX] recompute falhou para grupo ${groupId}:`,
        err
      );
      throw err;
    }
  }
);
