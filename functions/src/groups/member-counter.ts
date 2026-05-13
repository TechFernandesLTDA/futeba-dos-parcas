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
 * trigger calcula delta + atualiza `groups/{gid}.member_count` via admin SDK
 * (bypassa rules).
 */
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
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
  if (!status) return false;
  return ACTIVE_STATUSES.has(status);
}

/**
 * Detecta se o member foi criado via join-request approval,
 * que já incrementou member_count atomicamente na transação.
 *
 * @param {Record<string, unknown> | undefined} data Member doc data
 * @return {boolean} true se ja foi contado pelo join-request
 */
function isCountedByJoinRequest(
  data: Record<string, unknown> | undefined
): boolean {
  return data?._counted_by_join_request === true;
}

/**
 * Trigger fire em CREATE, UPDATE ou DELETE de `groups/{gid}/members/{uid}`.
 *
 * Calcula delta baseado em transição de "active member" antes/depois e aplica
 * `FieldValue.increment(delta)` em `groups/{gid}.member_count`.
 *
 * Cenários:
 * | Before active | After active | Delta | Cenário              |
 * |---------------|--------------|-------|----------------------|
 * | -             | yes          | +1    | CREATE (join)        |
 * | yes           | -            | -1    | DELETE (rare)        |
 * | yes           | no           | -1    | leave/kick (status)  |
 * | no            | yes          | +1    | re-activate          |
 * | yes           | yes          |  0    | profile update       |
 * | no            | no           |  0    | INACTIVE → REMOVED   |
 *
 * Idempotency: trigger pode re-fire em retry. Se delta=0 (sem mudança),
 * skip update — sem efeito colateral. Se delta != 0, increment é aplicado mesmo
 * em retry, mas Eventarc dedup minimiza repetição. Tolerável em sistema de
 * gamificação (member_count é counter, não financeiro).
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

    // FIX #651-B1: join-request approval already increments member_count
    // atomically in a transaction. Skip double-count on CREATE only.
    // FIX #1144: Subsequent writes (kicks, leaves) must go through delta
    // logic to decrement — flag was never cleared on those paths.
    const beforeExists = !!event.data?.before?.data();
    if (!beforeExists && isCountedByJoinRequest(after)) {
      console.log(
        `[MEMBER_COUNTER] Skipping CREATE for ${groupId}/${memberId} — ` +
        "member_count already incremented by join-request approval"
      );
      return;
    }

    // FIX #651-B2: member doc status changed away from ACTIVE
    // via soft-delete or other mechanisms. onMemberWritten detects
    // the transition and decrements.
    const wasActive = isActiveMember(before);
    const isActive = isActiveMember(after);

    let delta = 0;
    let reason = "";

    if (!wasActive && isActive) {
      delta = 1;
      reason = !before ? "CREATE_ACTIVE" : "REACTIVATED";
    } else if (wasActive && !isActive) {
      delta = -1;
      reason = !after ? "DELETE_WAS_ACTIVE" : "DEACTIVATED";
    } else {
      // Sem mudança em count semantics — skip
      console.log(
        `[MEMBER_COUNTER] No-op for ${groupId}/${memberId} ` +
        `(wasActive=${wasActive}, isActive=${isActive})`
      );
      return;
    }

    try {
      await db().doc(`groups/${groupId}`).update({
        member_count: admin.firestore.FieldValue.increment(delta),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(
        `[MEMBER_COUNTER] ${reason}: groups/${groupId}.member_count ` +
        `${delta > 0 ? "+" : ""}${delta} (member ${memberId})`
      );
    } catch (err) {
      // Group doc pode ter sido deleted enquanto trigger rodava (cascade).
      // Logar mas não throw — não há recovery útil.
      console.error(
        `[MEMBER_COUNTER] Failed to update groups/${groupId}.member_count ` +
        `(${reason}): ${(err as Error).message}`
      );
    }
  }
);
