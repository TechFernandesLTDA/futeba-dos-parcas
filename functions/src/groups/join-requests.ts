/**
 * Cloud Function trigger para join_requests (issue #517 Phase 2).
 *
 * Quando owner/admin aprova um request (status: PENDING -> APPROVED),
 * automaticamente:
 *  1. Cria membro em groups/{gid}/members/{uid}
 *  2. Incrementa group.member_count
 *  3. Cria denormalized users/{uid}/groups/{gid}
 *  4. Envia push notification ao requester (best-effort)
 *
 * Defesa em profundidade: rules ja validam transicao PENDING->APPROVED
 * por owner/admin, mas a function re-valida para evitar member criado
 * por race condition ou bypass.
 */

import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {
  NotificationType,
  sendNotificationToUser,
} from "../notifications/helpers";
import {PRESENCE_NOTIFICATIONS} from "../notifications/notification-messages";
import {isRecord} from "../validation/guards";
import {db} from "../_db";

interface JoinRequestData {
  user_id: string;
  user_name: string;
  user_photo?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  responded_by?: string;
}

/**
 * FIX #2284: valida o shape mínimo de um join_request (user_id + status
 * strings) antes do cast cego sobre dados crus do Firestore.
 * @param {unknown} data dados crus do snapshot
 * @return {boolean} true se válido
 */
function isJoinRequestShape(data: unknown): data is JoinRequestData {
  return (
    isRecord(data) &&
    typeof data.user_id === "string" &&
    typeof data.status === "string"
  );
}

export const onJoinRequestApproved = onDocumentUpdated(
  {
    document: "groups/{groupId}/join_requests/{userId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    if (!event.data) return;

    const beforeRaw = event.data.before.data();
    const afterRaw = event.data.after.data();
    // FIX #2284: valida shape antes do cast; early-return se malformado.
    if (!isJoinRequestShape(beforeRaw) || !isJoinRequestShape(afterRaw)) {
      if (beforeRaw || afterRaw) {
        logger.error("[GUARD] join_request malformado", {
          ...event.params,
        });
      }
      return;
    }
    const before: JoinRequestData = beforeRaw;
    const after: JoinRequestData = afterRaw;

    // So processa transicao PENDING -> APPROVED
    if (before.status !== "PENDING" || after.status !== "APPROVED") {
      return;
    }

    const {groupId, userId} = event.params;

    // Validar coerencia (defesa em profundidade)
    if (after.user_id !== userId) {
      logger.warn("join_request user_id mismatch", {
        groupId,
        userId,
        requestUserId: after.user_id,
      });
      return;
    }
    if (!after.responded_by) {
      logger.warn("join_request approved sem responded_by", {groupId, userId});
      return;
    }

    // Verificar se ja eh membro fora da transação
    // (idempotencia: early exit barato)
    const memberRef = db().doc(`groups/${groupId}/members/${userId}`);
    const memberSnap = await memberRef.get();
    if (memberSnap.exists) {
      logger.info("join_request already member, skipping member creation", {
        groupId,
        userId,
      });
      return;
    }

    // FIX #620: runTransaction para re-ler group.member_count dentro da
    // transação e evitar drift em aprovações concorrentes. Antes: snapshot
    // lido fora → aprovações simultâneas resultavam em member_count stale+1
    // no doc users/{uid}/groups/{gid} (usado como fallback em fetchUserGroups,
    // web/src/hooks/useGroups.ts:58).
    //
    // Estratégia: existência e metadados (name/photo) verificados fora da
    // transação (early-exit barato); member_count re-lido dentro para garantir
    // consistência durante o commit.
    const groupRef = db().doc(`groups/${groupId}`);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      logger.error("join_request group not found", {groupId, userId});
      return;
    }
    const groupMeta = groupSnap.data() as Record<string, unknown>;
    const groupName = (groupMeta.name as string) ?? "";
    const groupPhoto = (groupMeta.photo_url as string | null) ?? null;

    await db().runTransaction(async (tx) => {
      // FIX #1399: checar existência do member DENTRO da transação para
      // garantir idempotência sob entrega duplicada (Firestore triggers são
      // at-least-once). O early-exit fora da transação é otimização barata,
      // mas só esta checagem garante atomicidade contra retries do Cloud
      // Functions scheduler / restart de instância.
      const txMemberSnap = await tx.get(memberRef);
      if (txMemberSnap.exists) {
        logger.info("join_request member already exists (idempotent retry)", {
          groupId,
          userId,
        });
        return;
      }

      // Re-ler group DENTRO da transação — garante member_count consistente
      // mesmo com aprovações concorrentes de admins diferentes
      const freshGroupSnap = await tx.get(groupRef);
      const freshGroup = freshGroupSnap.data() as
        Record<string, unknown> | undefined;

      const currentMemberCount =
        typeof freshGroup?.member_count === "number" ?
          freshGroup.member_count : 0;

      tx.set(memberRef, {
        id: userId,
        user_id: userId,
        user_name: after.user_name,
        user_photo: after.user_photo ?? null,
        role: "MEMBER",
        status: "ACTIVE",
        joined_at: FieldValue.serverTimestamp(),
        invited_by: after.responded_by,
        _counted_by_join_request: true,
      });

      tx.update(groupRef, {
        member_count: FieldValue.increment(1),
        updated_at: FieldValue.serverTimestamp(),
      });

      tx.set(db().doc(`users/${userId}/groups/${groupId}`), {
        id: groupId,
        group_id: groupId,
        group_name: groupName,
        group_photo: groupPhoto,
        role: "MEMBER",
        // member_count lido na transação + 1 (reflete estado pós-commit)
        member_count: currentMemberCount + 1,
        joined_at: FieldValue.serverTimestamp(),
      });
    });

    logger.info("join_request approved and member created", {
      groupId,
      userId,
      approvedBy: after.responded_by,
    });

    // Push notification (best-effort, nao bloqueia)
    try {
      await sendNotificationToUser(userId, {
        type: NotificationType.GROUP_JOIN_APPROVED,
        title: PRESENCE_NOTIFICATIONS.GROUP_JOIN_APPROVED.title["pt-BR"](),
        body: PRESENCE_NOTIFICATIONS.GROUP_JOIN_APPROVED.body["pt-BR"]({
          groupName,
        }),
        data: {
          groupId,
          action: "OPEN_GROUP",
        },
      });
    } catch (e) {
      const error = e as Error;
      logger.warn("join_request push notification failed", {
        groupId,
        userId,
        error: error.message,
      });
    }
  }
);
