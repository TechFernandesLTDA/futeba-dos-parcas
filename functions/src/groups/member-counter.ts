/**
 * Cloud Function trigger para manter `groups/{gid}.member_count` consistente
 * com a subcollection `groups/{gid}/members/{uid}` (server-authoritative).
 *
 * Resolve issue #611 / #626: antes, clientes (web + android) escreviam
 * `member_count` direto via batch/transaction, o que abria privilege escalation
 * (qualquer auth podia overwrite) ou quebrava join-via-invite (rule member-only
 * negava op antes do member doc ser commit).
 *
 * Agora: client apenas escreve `members/{uid}` (com status ACTIVE etc), e este
 * trigger reconta os membros ativos da subcollection e grava o valor absoluto
 * em `groups/{gid}.member_count` via admin SDK (bypassa rules).
 */
import {logger} from "firebase-functions";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {FieldValue} from "firebase-admin/firestore";
import {db} from "../_db";

/**
 * Statuses que CONTAM como membro ativo no member_count.
 * Outros statuses (INACTIVE, REMOVED, PENDING, BANNED, etc) NÃO contam.
 */
const ACTIVE_STATUSES = new Set([
  "ACTIVE",
]);

/**
 * Considera membro ativo se:
 * - status === "ACTIVE" (semantics atual de Android + web)
 * - OU status ausente E doc existe (web join legacy não setava status)
 *
 * Esta tolerância evita drift em data legacy. Cloud Function é authoritative
 * pra count, então qualquer ambiguidade é resolvida aqui em vez de no client.
 *
 * @param {Record<string, unknown> | undefined} data Member doc data
 * @return {boolean} true se member conta no member_count
 */
function isActiveMember(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const status = data.status as string | undefined;
  if (!status) return true;
  return ACTIVE_STATUSES.has(status);
}

/**
 * Reconta os documentos de membros ativos na fonte autoritativa.
 *
 * @param {string} groupId Group id
 * @return {Promise<number>} Quantidade real de membros ativos
 */
async function countActiveMembers(groupId: string): Promise<number> {
  const membersSnap = await db()
    .collection("groups")
    .doc(groupId)
    .collection("members")
    .get();

  return membersSnap.docs.reduce((total, memberDoc) => {
    const data = memberDoc.data() as Record<string, unknown> | undefined;
    return total + (isActiveMember(data) ? 1 : 0);
  }, 0);
}

/**
 * Trigger fire em CREATE, UPDATE ou DELETE de `groups/{gid}/members/{uid}`.
 *
 * Reconta o total de "active member" em `groups/{gid}/members` e aplica o
 * valor absoluto em `groups/{gid}.member_count`.
 *
 * Cenários:
 * | Before active | After active | Cenário             | Ação             |
 * |---------------|--------------|---------------------|------------------|
 * | -             | yes          | CREATE (join)       | recount absoluto |
 * | yes           | -            | DELETE (rare)       | recount absoluto |
 * | yes           | no           | leave/kick (status) | recount absoluto |
 * | no            | yes          | re-activate         | recount absoluto |
 * | yes           | yes          | profile update      | heal se houver drift |
 * | no            | no           | INACTIVE → REMOVED  | heal se houver drift |
 *
 * Idempotency: trigger pode re-fire em retry. Como gravamos o valor absoluto
 * recontado da subcollection, retries, aprovações via join-request e drift
 * legado convergem para o mesmo `member_count`.
 */
export const onMemberWritten = onDocumentWritten(
  {
    document: "groups/{groupId}/members/{memberId}",
    region: "southamerica-east1",
  },
  async (event) => {
    const groupId = event.params.groupId;
    const memberId = event.params.memberId;

    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    const wasActive = isActiveMember(before);
    const isActive = isActiveMember(after);

    let reason = "";

    if (!wasActive && isActive) {
      reason = !before ? "CREATE_ACTIVE" : "REACTIVATED";
    } else if (wasActive && !isActive) {
      reason = !after ? "DELETE_WAS_ACTIVE" : "DEACTIVATED";
    } else {
      reason = "RECOUNT_NO_SEMANTIC_CHANGE";
    }

    try {
      const groupRef = db().doc(`groups/${groupId}`);
      const [activeCount, groupSnap] = await Promise.all([
        countActiveMembers(groupId),
        groupRef.get(),
      ]);

      if (!groupSnap.exists) {
        logger.info(
          `[MEMBER_COUNTER] Group ${groupId} not found, ` +
          "skipping counter update"
        );
        return;
      }

      const groupData = groupSnap.data() as Record<string, unknown>;
      const currentCount =
        typeof groupData.member_count === "number" ?
          groupData.member_count : 0;

      if (currentCount === activeCount) {
        logger.info(
          `[MEMBER_COUNTER] ${reason}: groups/${groupId}.member_count ` +
          `already consistent at ${activeCount} (member ${memberId})`
        );
        return;
      }

      await groupRef.update({
        member_count: activeCount,
        updated_at: FieldValue.serverTimestamp(),
      });

      logger.info(
        `[MEMBER_COUNTER] ${reason}: groups/${groupId}.member_count ` +
        `${currentCount} → ${activeCount} (member ${memberId})`
      );
    } catch (err) {
      // Group doc pode ter sido deleted enquanto trigger rodava (cascade).
      // Logar mas não throw — não há recovery útil.
      logger.error(
        `[MEMBER_COUNTER] Failed to update groups/${groupId}.member_count ` +
        `(${reason}): ${(err as Error).message}`
      );
    }
  }
);
