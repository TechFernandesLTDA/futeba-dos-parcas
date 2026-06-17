import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {db} from "../_db";

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
 * soma INCOME/EXPENSE de entries nao-VOIDED, com teto de 1000 entradas
 * (#952). Inclui legacy entries sem campo `status` (#2363).
 */
const MAX_ENTRIES = 1000;

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
      await db().runTransaction(async (tx) => {
        const snap = await tx.get(
          db()
            .collection("groups")
            .doc(groupId)
            .collection("cashbox")
            .limit(MAX_ENTRIES + 1)
        );

        if (snap.size > MAX_ENTRIES) {
          logger.warn(
            `[CASHBOX] grupo ${groupId} tem >${MAX_ENTRIES} entradas; ` +
            "summary truncado (paridade com client)."
          );
        }

        let totalIncome = 0;
        let totalExpense = 0;
        let entryCount = 0;
        let lastEntryMillis = 0;

        snap.docs.slice(0, MAX_ENTRIES).forEach((doc) => {
          const data = doc.data();
          if (data.status === "VOIDED") return;
          const amount = typeof data.amount === "number" ? data.amount : 0;
          if (data.type === "INCOME") {
            totalIncome += amount;
          } else if (data.type === "EXPENSE") {
            totalExpense += amount;
          }
          entryCount++;

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
        });

        const balance = totalIncome - totalExpense;

        tx.set(
          db()
            .collection("groups")
            .doc(groupId)
            .collection("cashbox_summary")
            .doc("current"),
          {
            balance,
            total_income: totalIncome,
            total_expense: totalExpense,
            entry_count: entryCount,
            last_entry_at: lastEntryMillis > 0 ?
              Timestamp.fromMillis(lastEntryMillis) :
              null,
            recomputed_at: FieldValue.serverTimestamp(),
          },
          {merge: true}
        );
      });

      logger.info(
        `[CASHBOX] summary recomputado grupo ${groupId}`
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
