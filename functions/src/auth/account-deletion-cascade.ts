/**
 * ACCOUNT DELETION CASCADE — #4391
 *
 * Etapas da exclusão de conta (LGPD art. 18, VI) que faltavam no
 * `onUserDeleted` (account-cleanup.ts) e as verificações da callable
 * `deleteAccount` (delete-account.ts). Spec:
 * specs/BUGFIX_4391_DELETE_ACCOUNT.md.
 *
 * Cada função recebe o Firestore e o uid, é IDEMPOTENTE (rodar de novo após
 * sucesso ou falha parcial não duplica efeito) e devolve contagens para o log
 * de auditoria. Nenhuma usa sentinela de FieldValue: contadores e arrays são
 * recalculados dentro de transação, o que mantém a correção sob concorrência.
 *
 * Formas de campo conferidas nos ESCRITORES (não nos modelos):
 * - users/{a}/following/{b} `target_user_id` e users/{b}/followers/{a}
 *   `follower_user_id`, contadores `following_count`/`followers_count`:
 *   social/follow.ts (toggleFollowUser);
 * - groups/{g}/members/{uid} `user_id`, `status`: web useGroups.ts,
 *   groups/invite-redeemed.ts, KMP FirebaseDataSource.kt (leaveGroup grava
 *   status INACTIVE);
 * - games/{id}/waitlist/{uid} `user_id`, `user_name`, `user_photo`:
 *   waitlist/join-game-waitlist.ts (exige membro ACTIVE do grupo do jogo);
 * - confirmations/{gameId}_{uid} `user_id`, `user_name`, `user_photo`:
 *   KMP FirebaseDataSource.kt, games/join-public-game.ts; `userId` legado
 *   (account-merge.ts lê as duas formas);
 * - games `owner_id`, `owner_name`, `co_organizers` (array de uid): web
 *   useGames.ts (criação), account-merge.ts (migração).
 */

import {ANONYMIZED_USER_NAME, GROUPS} from "./uid-owned-collections";

type Firestore = FirebaseFirestore.Firestore;
type DocumentData = FirebaseFirestore.DocumentData;
type QueryDocumentSnapshot = FirebaseFirestore.QueryDocumentSnapshot;
type Query = FirebaseFirestore.Query;

/** Guarda contra laço sem avanço de cursor (mesmo teto do #2323). */
export const MAX_CASCADE_ITERATIONS = 1000;

/** Tamanho de página: cabe com folga no teto de 500 operações por batch. */
const PAGE_SIZE = 200;

/** Limite de documentos por chamada de getAll. */
const GET_ALL_CHUNK = 100;

/** Transações paralelas por rodada no grafo de seguidores. */
const EDGE_PARALLELISM = 10;

/**
 * Status de jogo em que a confirmação é HISTÓRICO de outras pessoas
 * (súmula, lista de presença, MVP). Nesses jogos a confirmação é
 * anonimizada; nos demais (futuros ou cancelados) ela é apagada, e o
 * trigger onConfirmationWrite devolve a vaga (players_count).
 */
export const HISTORY_GAME_STATUSES: ReadonlySet<string> = new Set([
  "FINISHED",
  "LIVE",
]);

/**
 * Status do soft delete em andamento: `softDeleteGroupCascade` grava
 * DELETING antes de varrer os filhos e só no fim grava DELETED/deleted_at.
 * Um grupo nesse estado veio de uma tentativa anterior que falhou no meio e
 * precisa ser retomado, não ignorado.
 */
const GROUP_DELETING_STATUS = "DELETING";

/**
 * Espelha `isActiveMember` de groups/member-counter.ts: doc legado sem
 * status conta como ativo; status explícito diferente de ACTIVE não conta.
 *
 * @param {DocumentData | undefined} data Dados do membro
 * @return {boolean} true se o membro conta como ativo
 */
function isActiveMember(data: DocumentData | undefined): boolean {
  if (!data) return false;
  const status = data.status as string | undefined;
  return status ? status === "ACTIVE" : true;
}

/**
 * Percorre uma consulta em páginas por cursor (startAfter), sem orderBy
 * explícito (ordem implícita por __name__, índice single-field automático).
 *
 * @param {Query} base Consulta base (sem limit)
 * @param {string} label Rótulo para a mensagem de erro da guarda
 * @param {Function} onPage Callback por página
 * @return {Promise<void>}
 */
async function forEachPage(
  base: Query,
  label: string,
  onPage: (docs: QueryDocumentSnapshot[]) => Promise<void>,
): Promise<void> {
  let lastDoc: QueryDocumentSnapshot | null = null;
  for (let iteration = 1; ; iteration++) {
    if (iteration > MAX_CASCADE_ITERATIONS) {
      throw new Error(
        `[ACCOUNT_DELETION] Limite de ${MAX_CASCADE_ITERATIONS} iterações ` +
        `excedido ao paginar ${label}`
      );
    }
    let query = base.limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) return;
    await onPage(snap.docs);
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) return;
  }
}

/**
 * Lê documentos por caminho em lotes de getAll.
 *
 * @param {Firestore} db Firestore
 * @param {string[]} paths Caminhos dos documentos
 * @return {Promise<Map<string, DocumentData | undefined>>} path → dados
 *   (undefined quando o doc não existe)
 */
async function getAllByPath(
  db: Firestore,
  paths: string[],
): Promise<Map<string, DocumentData | undefined>> {
  const result = new Map<string, DocumentData | undefined>();
  const unique = [...new Set(paths)];
  for (let i = 0; i < unique.length; i += GET_ALL_CHUNK) {
    const refs = unique.slice(i, i + GET_ALL_CHUNK).map((p) => db.doc(p));
    if (refs.length === 0) continue;
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      result.set(snap.ref.path, snap.exists ? snap.data() : undefined);
    }
  }
  return result;
}

/**
 * Remove UMA aresta do grafo de seguidores no lado do OUTRO usuário (o
 * espelho fora do subtree do titular) e decrementa o contador dele, na mesma
 * transação. Idempotente: espelho ausente ⇒ nada muda (o contador só desce
 * junto com a remoção real do espelho).
 *
 * @param {Firestore} db Firestore
 * @param {string} mirrorPath users/{outro}/followers|following/{uid}
 * @param {string} otherUserPath users/{outro}
 * @param {string} counterField followers_count | following_count
 * @return {Promise<boolean>} true se o espelho existia e foi removido
 */
async function detachFollowEdge(
  db: Firestore,
  mirrorPath: string,
  otherUserPath: string,
  counterField: "followers_count" | "following_count",
): Promise<boolean> {
  const mirrorRef = db.doc(mirrorPath);
  const otherUserRef = db.doc(otherUserPath);
  return db.runTransaction(async (tx) => {
    const [mirrorSnap, otherSnap] = await Promise.all([
      tx.get(mirrorRef),
      tx.get(otherUserRef),
    ]);
    if (!mirrorSnap.exists) return false;
    tx.delete(mirrorRef);
    if (otherSnap.exists) {
      const current = otherSnap.data()?.[counterField];
      const safe = typeof current === "number" && Number.isFinite(current) ?
        Math.max(0, Math.trunc(current)) : 0;
      tx.update(otherUserRef, {[counterField]: Math.max(0, safe - 1)});
    }
    return true;
  });
}

/**
 * Desfaz o grafo de seguidores do titular: apaga users/{x}/followers/{uid}
 * de quem ele seguia e users/{y}/following/{uid} de quem o seguia,
 * corrigindo os contadores. As subcoleções do PRÓPRIO titular
 * (users/{uid}/following e /followers) são as únicas que localizam esses
 * espelhos, por isso esta etapa precisa rodar ANTES do recursiveDelete de
 * users/{uid}. Elas mesmas são apagadas depois pelo recursiveDelete.
 *
 * @param {Firestore} db Firestore
 * @param {string} uid Titular excluído
 * @return {Promise<{following: number, followers: number}>} arestas removidas
 */
export async function cleanupFollowGraph(
  db: Firestore,
  uid: string,
): Promise<{following: number; followers: number}> {
  const totals = {following: 0, followers: 0};

  const sides: Array<{
    subcollection: "following" | "followers";
    mirror: "followers" | "following";
    counter: "followers_count" | "following_count";
    total: "following" | "followers";
  }> = [
    // Quem o titular seguia perde um seguidor.
    {subcollection: "following", mirror: "followers", counter: "followers_count", total: "following"},
    // Quem seguia o titular passa a seguir um a menos.
    {subcollection: "followers", mirror: "following", counter: "following_count", total: "followers"},
  ];

  for (const side of sides) {
    await forEachPage(
      db.collection(`users/${uid}/${side.subcollection}`),
      `users/${uid}/${side.subcollection}`,
      async (docs) => {
        const otherIds = docs.map((doc) => doc.id).filter((id) => id && id !== uid);
        for (let i = 0; i < otherIds.length; i += EDGE_PARALLELISM) {
          const results = await Promise.all(
            otherIds.slice(i, i + EDGE_PARALLELISM).map((otherId) =>
              detachFollowEdge(
                db,
                `users/${otherId}/${side.mirror}/${uid}`,
                `users/${otherId}`,
                side.counter,
              ))
          );
          totals[side.total] += results.filter(Boolean).length;
        }
      },
    );
  }
  return totals;
}

/**
 * Descobre TODOS os grupos em que o titular tem doc de membro (ativo ou
 * não), via collectionGroup("members") em `user_id` — o fieldOverride de
 * firestore.indexes.json (members.user_id, COLLECTION_GROUP ASC) cobre a
 * consulta. Diferente do espelho users/{uid}/groups, alcança também grupos
 * que o usuário já DEIXOU e sobrevive ao recursiveDelete de users/{uid}
 * (o retry via failurePolicy reencontra os grupos).
 *
 * @param {Firestore} db Firestore
 * @param {string} uid Titular excluído
 * @return {Promise<string[]>} ids de grupo, sem repetição
 */
export async function discoverMemberGroupIds(
  db: Firestore,
  uid: string,
): Promise<string[]> {
  const groupIds = new Set<string>();
  await forEachPage(
    db.collectionGroup(GROUPS.membersSubcollection).where("user_id", "==", uid),
    "collectionGroup members (user_id)",
    async (docs) => {
      for (const doc of docs) {
        // Só groups/{g}/members/{id}: outra coleção chamada "members" em
        // outro ponto da árvore não é grupo.
        const parts = doc.ref.path.split("/");
        if (parts.length === 4 && parts[0] === GROUPS.collection) {
          groupIds.add(parts[1]);
        }
      }
    },
  );
  return [...groupIds];
}

/**
 * Apaga as entradas de fila de espera do titular (games/{id}/waitlist/{uid},
 * com user_name/user_photo). Não há índice de collectionGroup em
 * waitlist.user_id, então os jogos vêm dos grupos do titular (o escritor só
 * aceita membro ACTIVE do grupo do jogo) e cada entrada é lida pelo ID.
 *
 * @param {Firestore} db Firestore
 * @param {string} uid Titular excluído
 * @param {string[]} groupIds Grupos do titular (discoverMemberGroupIds)
 * @return {Promise<number>} entradas apagadas
 */
export async function removeWaitlistEntries(
  db: Firestore,
  uid: string,
  groupIds: string[],
): Promise<number> {
  let removed = 0;
  for (const groupId of groupIds) {
    await forEachPage(
      db.collection("games").where("group_id", "==", groupId),
      `games (group_id=${groupId})`,
      async (gameDocs) => {
        const paths = gameDocs.map((game) => `games/${game.id}/waitlist/${uid}`);
        const entries = await getAllByPath(db, paths);
        const batch = db.batch();
        let ops = 0;
        for (const [path, data] of entries) {
          if (data === undefined) continue;
          batch.delete(db.doc(path));
          ops++;
        }
        if (ops > 0) {
          await batch.commit();
          removed += ops;
        }
      },
    );
  }
  return removed;
}

/**
 * Confirmações do titular (`user_id`; `userId` legado):
 * - jogo FINISHED/LIVE ⇒ ANONIMIZA (nome vira "Usuário removido", foto
 *   sai). Apagar mudaria a súmula e o players_count de uma partida que
 *   outras pessoas jogaram;
 * - demais (futuro, cancelado, jogo inexistente) ⇒ APAGA; o trigger
 *   onConfirmationWrite devolve a vaga do jogo futuro.
 *
 * @param {Firestore} db Firestore
 * @param {string} uid Titular excluído
 * @return {Promise<{deleted: number, anonymized: number}>} contagens
 */
export async function cleanupConfirmations(
  db: Firestore,
  uid: string,
): Promise<{deleted: number; anonymized: number}> {
  const totals = {deleted: 0, anonymized: 0};
  for (const field of ["user_id", "userId"]) {
    await forEachPage(
      db.collection("confirmations").where(field, "==", uid),
      `confirmations (${field})`,
      async (docs) => {
        const gamePaths = docs
          .map((doc) => doc.data().game_id ?? doc.data().gameId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
          .map((id) => `games/${id}`);
        const games = await getAllByPath(db, gamePaths);
        const batch = db.batch();
        let ops = 0;
        for (const doc of docs) {
          const data = doc.data();
          const gameId = data.game_id ?? data.gameId;
          const status = typeof gameId === "string" ?
            games.get(`games/${gameId}`)?.status : undefined;
          if (typeof status === "string" && HISTORY_GAME_STATUSES.has(status)) {
            const patch: Record<string, unknown> = {};
            for (const nameField of ["user_name", "userName"]) {
              if (nameField in data && data[nameField] !== ANONYMIZED_USER_NAME) {
                patch[nameField] = ANONYMIZED_USER_NAME;
              }
            }
            for (const photoField of ["user_photo", "user_photo_url", "userPhoto"]) {
              if (photoField in data && data[photoField] !== null) {
                patch[photoField] = null;
              }
            }
            if (Object.keys(patch).length > 0) {
              batch.update(doc.ref, patch);
              ops++;
              totals.anonymized++;
            }
          } else {
            batch.delete(doc.ref);
            ops++;
            totals.deleted++;
          }
        }
        if (ops > 0) await batch.commit();
      },
    );
  }
  return totals;
}

/**
 * Jogos em que o titular é dono ou co-organizador (irmão account-merge.ts
 * migra os dois): o jogo pertence ao grupo e a outras pessoas, então fica;
 * o `owner_name` é anonimizado e o uid sai de `co_organizers` (transação
 * por jogo: o array é relido e regravado sem o uid).
 *
 * @param {Firestore} db Firestore
 * @param {string} uid Titular excluído
 * @return {Promise<{ownerNameAnonymized: number, coOrganizerRemoved: number}>}
 *   contagens
 */
export async function detachFromGames(
  db: Firestore,
  uid: string,
): Promise<{ownerNameAnonymized: number; coOrganizerRemoved: number}> {
  const totals = {ownerNameAnonymized: 0, coOrganizerRemoved: 0};

  await forEachPage(
    db.collection("games").where("owner_id", "==", uid),
    "games (owner_id)",
    async (docs) => {
      const batch = db.batch();
      let ops = 0;
      for (const doc of docs) {
        const ownerName = doc.data().owner_name;
        if (typeof ownerName === "string" && ownerName !== ANONYMIZED_USER_NAME) {
          batch.update(doc.ref, {owner_name: ANONYMIZED_USER_NAME});
          ops++;
        }
      }
      if (ops > 0) {
        await batch.commit();
        totals.ownerNameAnonymized += ops;
      }
    },
  );

  // A consulta array-contains deixa de casar com o jogo já corrigido, então
  // não há cursor: repete até esvaziar (com a guarda de iterações).
  for (let iteration = 1; ; iteration++) {
    if (iteration > MAX_CASCADE_ITERATIONS) {
      throw new Error(
        `[ACCOUNT_DELETION] Limite de ${MAX_CASCADE_ITERATIONS} iterações ` +
        "excedido ao remover co_organizers"
      );
    }
    const snap = await db.collection("games")
      .where("co_organizers", "array-contains", uid)
      .limit(PAGE_SIZE)
      .get();
    if (snap.empty) break;
    let changedInPage = 0;
    for (const doc of snap.docs) {
      const changed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        const list = fresh.data()?.co_organizers;
        if (!Array.isArray(list) || !list.includes(uid)) return false;
        tx.update(doc.ref, {
          co_organizers: list.filter((id: unknown) => id !== uid),
        });
        return true;
      });
      if (changed) changedInPage++;
    }
    totals.coOrganizerRemoved += changedInPage;
    // Sem progresso na página ⇒ índice defasado; não insistir.
    if (changedInPage === 0 || snap.size < PAGE_SIZE) break;
  }

  return totals;
}

/** Grupo do qual o titular é dono. */
export interface OwnedGroup {
  id: string;
  name: string;
}

/**
 * Classifica os grupos em que o titular é DONO (`owner_id`; `ownerId`
 * legado), ignorando grupos já excluídos (`deleted_at` ou DELETED):
 * - `blocking`: há outro membro ativo ⇒ a exclusão da conta é bloqueada até
 *   o titular transferir a posse (ou excluir o grupo);
 * - `orphan`: ninguém mais ativo ⇒ o grupo é excluído junto (soft delete).
 *   Grupo em DELETING (cascata anterior interrompida) vai direto para cá, sem
 *   contar membros, que já podem estar INACTIVE; o helper retoma a cascata.
 *
 * @param {Firestore} db Firestore
 * @param {string} uid Titular
 * @return {Promise<{blocking: OwnedGroup[], orphan: OwnedGroup[]}>}
 *   grupos por categoria
 */
export async function classifyOwnedGroups(
  db: Firestore,
  uid: string,
): Promise<{blocking: OwnedGroup[]; orphan: OwnedGroup[]}> {
  const seen = new Set<string>();
  const blocking: OwnedGroup[] = [];
  const orphan: OwnedGroup[] = [];

  for (const ownerField of GROUPS.ownerIdFields) {
    await forEachPage(
      db.collection(GROUPS.collection).where(ownerField, "==", uid),
      `groups (${ownerField})`,
      async (docs) => {
        for (const doc of docs) {
          if (seen.has(doc.id)) continue;
          seen.add(doc.id);
          const data = doc.data();
          if (data[ownerField] !== uid) continue;
          if (data.deleted_at || data.status === "DELETED") continue;
          const group = {
            id: doc.id,
            name: typeof data.name === "string" ? data.name : "",
          };
          if (data.status === GROUP_DELETING_STATUS) {
            orphan.push(group);
          } else if (await hasOtherActiveMember(db, doc.id, uid)) {
            blocking.push(group);
          } else {
            orphan.push(group);
          }
        }
      },
    );
  }
  return {blocking, orphan};
}

/**
 * @param {Firestore} db Firestore
 * @param {string} groupId Grupo
 * @param {string} uid Titular (ignorado na contagem)
 * @return {Promise<boolean>} true se existe outro membro ativo
 */
async function hasOtherActiveMember(
  db: Firestore,
  groupId: string,
  uid: string,
): Promise<boolean> {
  let found = false;
  let lastDoc: QueryDocumentSnapshot | null = null;
  for (let iteration = 1; !found; iteration++) {
    if (iteration > MAX_CASCADE_ITERATIONS) {
      throw new Error(
        `[ACCOUNT_DELETION] Limite de ${MAX_CASCADE_ITERATIONS} iterações ` +
        `excedido ao listar membros de ${groupId}`
      );
    }
    let query = db.collection(`${GROUPS.collection}/${groupId}/members`)
      .limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) break;
    found = snap.docs.some((doc) => {
      const data = doc.data();
      const memberUid = typeof data.user_id === "string" ? data.user_id : doc.id;
      return doc.id !== uid && memberUid !== uid && isActiveMember(data);
    });
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }
  return found;
}
