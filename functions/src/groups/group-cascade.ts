/**
 * Cascata de HARD DELETE de grupo (trigger `onGroupDeleted`).
 *
 * FIX #4100: a versão anterior (inline em index.ts) fazia 7 `.get()` crus,
 * sem `limit()`, e acumulava todas as refs em um único array antes do
 * primeiro commit — regressão do #1964, que pediu paginação para
 * `onGameDeleted` E `onGroupDeleted` mas só foi aplicada no primeiro.
 * Além disso `wall_posts` e `group_polls` nunca eram limpos (gêmea do
 * #3390, que corrigiu apenas o caminho de soft delete).
 *
 * Estratégia aqui (espelha `softDeleteGroupCascade` em
 * utils/soft-delete-helper.ts):
 * - cada coleção é lida por cursor (`startAfter`) em páginas de
 *   FIRESTORE_BATCH_SAFE_LIMIT docs — nunca carrega um snapshot ilimitado;
 * - as operações vão para UM acumulador de batch que é commitado assim que
 *   atinge FIRESTORE_BATCH_SAFE_LIMIT ops, ou seja, a memória fica limitada
 *   a ~1 página + 1 batch, independentemente do tamanho do grupo;
 * - as coleções são processadas sequencialmente (não em Promise.all) de
 *   propósito: o acumulador é compartilhado e o hard delete é um caminho
 *   admin-only, onde previsibilidade de memória vale mais que latência.
 *
 * Mantido separado de `softDeleteGroupCascade`: as semânticas divergem
 * (soft = updates condicionais de status/deleted_at; hard = delete
 * incondicional) e as coleções também (hard cobre cashbox/schedules, soft
 * cobre `invites` legado). A tabela abaixo é a fonte de verdade do hard delete.
 *
 * | Coleção                                | Ação    |
 * |----------------------------------------|---------|
 * | groups/{id}/members                    | delete  |
 * | users/{uid}/groups/{id} (por membro)   | delete  |
 * | groups/{id}/cashbox                    | delete  |
 * | groups/{id}/cashbox_summary            | delete  |
 * | groups/{id}/join_requests              | delete  |
 * | groups/{id}/wall_posts                 | delete  |
 * | group_invites (group_id == id)         | delete  |
 * | group_polls (group_id == id)           | delete  |
 * | group_poll_votes (group_id == id)      | delete  |
 * | schedules (group_id == id)             | delete  |
 * | games (group_id == id)                 | update: orphaned (preserva histórico) |
 */
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {db} from "../_db";
import {FIRESTORE_BATCH_SAFE_LIMIT} from "../constants";

const LOG_PREFIX = "[CASCADE DELETE]";

/** Tamanho de página das leituras (igual ao teto de ops por batch). */
export const GROUP_CASCADE_PAGE_SIZE = FIRESTORE_BATCH_SAFE_LIMIT;

/** Subcoleções de `groups/{id}` removidas por delete simples. */
export const GROUP_CASCADE_SUBCOLLECTIONS = [
  "cashbox",
  "cashbox_summary",
  "join_requests",
  "wall_posts",
] as const;

/** Coleções root (filtradas por `group_id`) removidas por delete simples. */
export const GROUP_CASCADE_ROOT_COLLECTIONS = [
  "group_invites",
  "group_polls",
  "group_poll_votes",
  "schedules",
] as const;

export interface GroupCascadeResult {
  /** Total de operações (deletes + updates) enviadas ao Firestore. */
  totalOps: number;
  /** Quantidade de batches commitados. */
  batches: number;
  /** Docs encontrados por coleção (label → contagem). */
  found: Record<string, number>;
}

/**
 * Itera uma query em páginas de GROUP_CASCADE_PAGE_SIZE docs via cursor,
 * chamando `onPage` para cada página. Nunca materializa mais de uma página.
 *
 * @param {admin.firestore.Query} baseQuery - Query base, sem limit/cursor.
 * @param {string} label - Nome da coleção para log.
 * @param {Function} onPage - Callback por página (pode ser async).
 * @return {Promise<number>} Total de docs percorridos.
 */
export async function forEachQueryPage(
  baseQuery: admin.firestore.Query,
  label: string,
  onPage: (docs: admin.firestore.QueryDocumentSnapshot[]) => Promise<void>
): Promise<number> {
  let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
  let total = 0;

  while (true) {
    let query = baseQuery.limit(GROUP_CASCADE_PAGE_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.size === 0) break;

    await onPage(snapshot.docs);
    total += snapshot.size;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.size < GROUP_CASCADE_PAGE_SIZE) break;
  }

  logger.info(`${LOG_PREFIX} Found ${total} ${label} to process`);
  return total;
}

/**
 * Executa a cascata de hard delete de um grupo já removido.
 * Lança em caso de falha para que o trigger faça retry (at-least-once);
 * todas as operações são idempotentes (delete de doc inexistente é no-op,
 * update de jogo já órfão reaplica os mesmos campos).
 *
 * @param {string} groupId - ID do grupo deletado.
 * @return {Promise<GroupCascadeResult>} Resumo das operações.
 */
export async function hardDeleteGroupCascade(
  groupId: string
): Promise<GroupCascadeResult> {
  const firestore = db();
  const groupRef = firestore.collection("groups").doc(groupId);

  let batch = firestore.batch();
  let pendingOps = 0;
  let totalOps = 0;
  let batches = 0;
  const found: Record<string, number> = {};

  const flush = async (): Promise<void> => {
    if (pendingOps === 0) return;
    const committing = batch;
    const size = pendingOps;
    batch = firestore.batch();
    pendingOps = 0;
    await committing.commit();
    batches++;
    logger.info(`${LOG_PREFIX} Committed batch ${batches} (${size} ops)`);
  };

  const enqueue = async (
    apply: (b: admin.firestore.WriteBatch) => void
  ): Promise<void> => {
    apply(batch);
    pendingOps++;
    totalOps++;
    if (pendingOps >= FIRESTORE_BATCH_SAFE_LIMIT) await flush();
  };

  // 1. Members + users/{uid}/groups/{groupId}
  // FIX #2605: collectionGroup("groups").where(documentId(), "==", groupId)
  // falhava com "odd number of segments" — iteramos os membros e deletamos
  // a referência espelhada por path direto.
  let userGroupRefs = 0;
  found.members = await forEachQueryPage(
    groupRef.collection("members"),
    "members",
    async (docs) => {
      for (const memberDoc of docs) {
        // ORDEM IMPORTA: a referência espelhada em users/{uid}/groups/{id} é
        // enfileirada ANTES do doc do membro. Se um flush cair entre as duas
        // ops e o batch seguinte falhar, o retry ainda encontra o membro e
        // reapaga a referência (delete é idempotente). Na ordem inversa, o
        // membro já teria sido commitado e a referência ficaria órfã.
        const uid = memberDoc.data()?.user_id;
        if (typeof uid === "string" && uid.length > 0) {
          const userGroupRef = firestore
            .collection("users")
            .doc(uid)
            .collection("groups")
            .doc(groupId);
          await enqueue((b) => b.delete(userGroupRef));
          userGroupRefs++;
        }
        await enqueue((b) => b.delete(memberDoc.ref));
      }
    }
  );
  found.user_group_refs = userGroupRefs;
  logger.info(
    `${LOG_PREFIX} Found ${userGroupRefs} user group references to delete`
  );

  // 2. Subcoleções de groups/{id}: cashbox, cashbox_summary, join_requests,
  //    wall_posts (FIX #4100 — wall_posts ficavam órfãos e inalcançáveis).
  for (const name of GROUP_CASCADE_SUBCOLLECTIONS) {
    found[name] = await forEachQueryPage(
      groupRef.collection(name),
      name,
      async (docs) => {
        for (const doc of docs) {
          await enqueue((b) => b.delete(doc.ref));
        }
      }
    );
  }

  // 3. Coleções root chaveadas por group_id: group_invites, group_polls,
  //    group_poll_votes (FIX #4100), schedules.
  for (const name of GROUP_CASCADE_ROOT_COLLECTIONS) {
    found[name] = await forEachQueryPage(
      firestore.collection(name).where("group_id", "==", groupId),
      name,
      async (docs) => {
        for (const doc of docs) {
          await enqueue((b) => b.delete(doc.ref));
        }
      }
    );
  }

  // 4. Games: marcar como órfãos (não deletar — preserva histórico/XP).
  found.games = await forEachQueryPage(
    firestore.collection("games").where("group_id", "==", groupId),
    "games",
    async (docs) => {
      for (const doc of docs) {
        await enqueue((b) => b.update(doc.ref, {
          group_id: null,
          group_deleted: true,
          group_deleted_at: FieldValue.serverTimestamp(),
        }));
      }
    }
  );
  logger.info(`${LOG_PREFIX} Marked ${found.games} games as orphaned`);

  await flush();

  if (totalOps > 0) {
    logger.info(
      `${LOG_PREFIX} Successfully processed ${totalOps} operations ` +
      `in ${batches} batches for group ${groupId}`
    );
  } else {
    logger.info(
      `${LOG_PREFIX} No related documents found for group ${groupId}`
    );
  }

  return {totalOps, batches, found};
}
