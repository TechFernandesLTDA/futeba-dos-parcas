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
import * as admin from "firebase-admin";
import {FUNCTION_REGION} from "../constants";
import {
  NotificationType,
  sendNotificationToUser,
} from "../notifications/helpers";

const db = () => admin.firestore();

interface JoinRequestData {
  user_id: string;
  user_name: string;
  user_photo?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  responded_by?: string;
}

export const onJoinRequestApproved = onDocumentUpdated(
  {
    document: "groups/{groupId}/join_requests/{userId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.data() as JoinRequestData | undefined;
    const after = event.data.after.data() as JoinRequestData | undefined;
    if (!before || !after) return;

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

    // Verificar se ja eh membro (idempotencia: re-aprovacao nao duplica)
    const memberRef = db().doc(`groups/${groupId}/members/${userId}`);
    const memberSnap = await memberRef.get();
    if (memberSnap.exists) {
      logger.info("join_request already member, skipping member creation", {
        groupId,
        userId,
      });
      return;
    }

    // Buscar dados do grupo (necessario para denormalized user/groups)
    const groupSnap = await db().doc(`groups/${groupId}`).get();
    if (!groupSnap.exists) {
      logger.error("join_request group not found", {groupId, userId});
      return;
    }
    const group = groupSnap.data() as Record<string, unknown>;

    // Batch atomico: member + counter + user/groups
    const batch = db().batch();

    batch.set(memberRef, {
      id: userId,
      user_id: userId,
      user_name: after.user_name,
      user_photo: after.user_photo ?? null,
      role: "MEMBER",
      status: "ACTIVE",
      joined_at: admin.firestore.FieldValue.serverTimestamp(),
      invited_by: after.responded_by,
    });

    batch.update(db().doc(`groups/${groupId}`), {
      member_count: admin.firestore.FieldValue.increment(1),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const currentMemberCount =
      typeof group.member_count === "number" ? group.member_count : 0;
    batch.set(db().doc(`users/${userId}/groups/${groupId}`), {
      id: groupId,
      group_id: groupId,
      group_name: (group.name as string) ?? "",
      group_photo: (group.photo_url as string | null) ?? null,
      role: "MEMBER",
      member_count: currentMemberCount + 1,
      joined_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    logger.info("join_request approved and member created", {
      groupId,
      userId,
      approvedBy: after.responded_by,
    });

    // Push notification (best-effort, nao bloqueia)
    try {
      await sendNotificationToUser(userId, {
        type: NotificationType.GROUP_JOIN_APPROVED,
        title: `Voce foi aceito em ${group.name}!`,
        body: "Toque pra abrir o grupo e ver os jogos.",
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
