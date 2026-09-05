/**
 * NOTIFICAÇÕES DE PRESENÇA E GRUPO
 * Triggers para confirmações de jogo, convites de
 * grupo, membros entrando/saindo, e caixa.
 */

import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {
  FUNCTION_REGION,
} from "../constants";
import {
  NotificationType,
  sendNotificationToUser,
  sendNotificationToUsers,
  sendAndSaveNotification,
} from "./helpers";

// Lazy initialization para evitar erro de initializeApp
const getDb = () => admin.firestore();

// Tempo de expiração de convites de grupo (48h em ms)
const INVITE_EXPIRATION_MS = 48 * 60 * 60 * 1000;

// ==========================================
// GAME CONFIRMED (player confirmed presence)
// ==========================================

/**
 * Trigger: Quando uma confirmação é criada.
 * Notifica o dono do jogo sobre nova confirmação.
 */
export const onGameConfirmed = onDocumentCreated(
  {document: "confirmations/{confirmationId}", region: FUNCTION_REGION},
  async (event) => {
    const confirmation = event.data?.data();
    if (
      !confirmation ||
      confirmation.status !== "CONFIRMED"
    ) {
      return;
    }

    const gameId =
      confirmation.game_id || confirmation.gameId;
    const userId =
      confirmation.user_id || confirmation.userId;

    try {
      const gameDoc = await getDb()
        .collection("games")
        .doc(gameId)
        .get();
      if (!gameDoc.exists) return;

      const game = gameDoc.data();
      if (!game) return;

      if (game.owner_id !== userId) {
        const userDoc = await getDb()
          .collection("users")
          .doc(userId)
          .get();
        const userName = userDoc.exists ?
          (userDoc.data()?.name ||
            userDoc.data()?.nickname ||
            "Um jogador") :
          "Um jogador";

        await sendNotificationToUser(
          game.owner_id,
          {
            title: "Nova confirmacao!",
            body: userName +
              " confirmou presenca no jogo.",
            type:
              NotificationType.GAME_CONFIRMED,
            data: {
              gameId: gameId,
            },
          }
        );
      }
    } catch (e) {
      console.error(
        "Erro ao notificar confirmacao:",
        e
      );
    }
  }
);

// ==========================================
// GROUP INVITE CREATED
// ==========================================

/**
 * Trigger que envia notificação push FCM quando
 * um convite de grupo é criado.
 */
export const onGroupInviteCreated =
  onDocumentCreated(
    "group_invites/{inviteId}",
    async (event) => {
      const invite = event.data?.data();
      if (!invite) return;

      const inviteId = event.params.inviteId;
      const invitedUserId =
        invite.invited_user_id ||
        invite.invitedUserId;
      const groupId =
        invite.group_id || invite.groupId;
      const groupName =
        invite.group_name ||
        invite.groupName ||
        "um grupo";
      const invitedByName =
        invite.invited_by_name ||
        invite.invitedByName ||
        "Alguem";

      // Validar campos obrigatórios
      if (!invitedUserId) {
        console.error(
          "[GROUP_INVITE] Convite" +
          ` ${inviteId} sem invited_user_id`
        );
        return;
      }

      if (!groupId) {
        console.error(
          "[GROUP_INVITE] Convite" +
          ` ${inviteId} sem group_id`
        );
        return;
      }

      console.log(
        "[GROUP_INVITE] Enviando notificacao" +
        ` para ${invitedUserId} - Convite` +
        ` para ${groupName}` +
        ` por ${invitedByName}`
      );

      try {
        const senderId =
          invite.invited_by_id ||
          invite.invitedById ||
          null;

        await sendAndSaveNotification(
          invitedUserId,
          {
            userId: invitedUserId,
            title: "Convite para grupo",
            body: `${invitedByName} convidou` +
              ` voce para ${groupName}`,
            type: NotificationType.GROUP_INVITE,
            groupId: groupId,
            senderId: senderId,
            senderName: invitedByName,
            action:
              "group_invite/" + inviteId,
          }
        );

        console.log(
          "[GROUP_INVITE] Notificacao enviada" +
          ` com sucesso para ${invitedUserId}`
        );
      } catch (e) {
        console.error(
          "[GROUP_INVITE] Erro ao enviar" +
          ` notificacao para ${invitedUserId}:`,
          e
        );
      }
    }
  );

// ==========================================
// CLEANUP EXPIRED INVITES
// ==========================================

/**
 * Função agendada para limpar convites expirados
 * (mais de 48 horas). Executa diariamente para
 * marcar convites pendentes antigos como EXPIRED.
 */
export const cleanupExpiredInvites = onSchedule(
  {schedule: "every 24 hours", region: FUNCTION_REGION},
  async () => {
    console.log(
      "[CLEANUP] Iniciando limpeza de" +
      " convites expirados..."
    );

    try {
      // Calcular timestamp de expiração (48h)
      const expirationTime = new Date(
        Date.now() - INVITE_EXPIRATION_MS
      );

      // Buscar convites pendentes antigos
      const expiredInvitesSnap = await getDb()
        .collection("group_invites")
        .where("status", "==", "PENDING")
        .where(
          "created_at",
          "<",
          expirationTime
        )
        .get();

      if (expiredInvitesSnap.empty) {
        console.log(
          "[CLEANUP] Nenhum convite" +
          " expirado encontrado"
        );
        return;
      }

      console.log(
        "[CLEANUP] Encontrados " +
        `${expiredInvitesSnap.size}` +
        " convites expirados"
      );

      // Atualizar em batch (máximo de 500)
      type QDocSnap =
        admin.firestore.QueryDocumentSnapshot;
      const chunks: QDocSnap[][] = [];
      const docs = expiredInvitesSnap.docs;

      for (
        let i = 0;
        i < docs.length;
        i += 500
      ) {
        chunks.push(docs.slice(i, i + 500));
      }

      let totalUpdated = 0;

      for (const chunk of chunks) {
        const batch = getDb().batch();

        for (const doc of chunk) {
          batch.update(doc.ref, {
            status: "EXPIRED",
            expired_at:
              admin.firestore.FieldValue
                .serverTimestamp(),
          });
        }

        await batch.commit();
        totalUpdated += chunk.length;
      }

      console.log(
        `[CLEANUP] ${totalUpdated}` +
        " convites marcados como EXPIRED"
      );
    } catch (e) {
      console.error(
        "[CLEANUP] Erro ao limpar" +
        " convites expirados:",
        e
      );
      throw e;
    }
  }
);

// ==========================================
// GROUP INVITE RESPONSE
// ==========================================

/**
 * Trigger quando um convite de grupo é aceito ou
 * recusado. Notifica quem enviou o convite.
 */
export const onGroupInviteResponse =
  onDocumentUpdated(
    "group_invites/{inviteId}",
    async (event) => {
      const before = event.data?.before.data();
      const after = event.data?.after.data();
      if (!before || !after) return;

      const inviteId = event.params.inviteId;
      const beforeStatus = before.status;
      const afterStatus = after.status;

      // Só notifica se mudou de PENDING
      if (beforeStatus !== "PENDING") return;
      if (
        afterStatus !== "ACCEPTED" &&
        afterStatus !== "DECLINED"
      ) {
        return;
      }

      const invitedById =
        after.invited_by_id || after.invitedById;
      const invitedUserName =
        after.invited_user_name ||
        after.invitedUserName ||
        "Um jogador";
      const groupName =
        after.group_name ||
        after.groupName ||
        "seu grupo";

      if (!invitedById) {
        console.log(
          "[GROUP_INVITE_RESPONSE] Convite" +
          ` ${inviteId} sem invited_by_id`
        );
        return;
      }

      console.log(
        "[GROUP_INVITE_RESPONSE] Convite" +
        ` ${inviteId}: ${beforeStatus}` +
        ` -> ${afterStatus}`
      );

      try {
        if (afterStatus === "ACCEPTED") {
          const grpId =
            after.group_id || after.groupId;
          await sendAndSaveNotification(
            invitedById,
            {
              userId: invitedById,
              title: "Convite aceito!",
              body: `${invitedUserName}` +
                " aceitou seu convite" +
                ` para ${groupName}`,
              type: NotificationType
                .GROUP_INVITE_ACCEPTED,
              groupId: grpId,
              action:
                "group_detail/" + grpId,
            }
          );
        } else {
          await sendAndSaveNotification(
            invitedById,
            {
              userId: invitedById,
              title: "Convite recusado",
              body: `${invitedUserName}` +
                " recusou seu convite" +
                ` para ${groupName}`,
              type: NotificationType
                .GROUP_INVITE_DECLINED,
              groupId:
                after.group_id ||
                after.groupId,
            }
          );
        }

        console.log(
          "[GROUP_INVITE_RESPONSE]" +
          " Notificacao enviada" +
          ` para ${invitedById}`
        );
      } catch (e) {
        console.error(
          "[GROUP_INVITE_RESPONSE] Erro ao" +
          ` notificar ${invitedById}:`,
          e
        );
      }
    }
  );

// ==========================================
// MEMBER JOINED/LEFT GROUP
// ==========================================

/**
 * Trigger quando um membro entra em um grupo.
 * Notifica admins/owners do grupo.
 */
export const onMemberJoined = onDocumentCreated(
  {document: "groups/{groupId}/members/{memberId}", region: FUNCTION_REGION},
  async (event) => {
    const member = event.data?.data();
    if (!member) return;

    const groupId = event.params.groupId;
    const memberId = event.params.memberId;

    // Não notifica se é o owner
    const role = member.role || member.memberRole;
    if (role === "OWNER") return;

    console.log(
      `[MEMBER_JOINED] Member ${memberId}` +
      ` joined group ${groupId}`
    );

    try {
      // Buscar dados do grupo e do novo membro
      const [groupDoc, memberUserDoc] =
        await Promise.all([
          getDb()
            .collection("groups")
            .doc(groupId)
            .get(),
          getDb()
            .collection("users")
            .doc(memberId)
            .get(),
        ]);

      if (!groupDoc.exists) return;

      const group = groupDoc.data();
      const memberUser = memberUserDoc.exists ?
        memberUserDoc.data() :
        null;
      const memberName =
        memberUser?.name ||
        memberUser?.nickname ||
        "Um jogador";
      const groupName =
        group?.name || "o grupo";

      // Buscar admins e owners
      const adminsSnap = await getDb()
        .collection("groups")
        .doc(groupId)
        .collection("members")
        .where(
          "role",
          "in",
          ["ADMIN", "OWNER"]
        )
        .get();

      type DocSnap =
        admin.firestore.QueryDocumentSnapshot;
      const adminIds = adminsSnap.docs
        .map((doc: DocSnap) => doc.id)
        .filter(
          (id: string) => id !== memberId
        );

      if (adminIds.length > 0) {
        await sendNotificationToUsers(
          adminIds,
          {
            title: "Novo membro!",
            body: `${memberName}` +
              ` entrou em ${groupName}`,
            type:
              NotificationType.MEMBER_JOINED,
            data: {
              groupId: groupId,
              memberId: memberId,
              action:
                "group_detail/" + groupId,
            },
          }
        );

        console.log(
          "[MEMBER_JOINED] Notificacao" +
          " enviada para " +
          `${adminIds.length} admins`
        );
      }
    } catch (e) {
      console.error(
        "[MEMBER_JOINED] Erro ao processar:",
        e
      );
    }
  }
);

/**
 * Trigger quando um membro sai de um grupo.
 * Notifica admins/owners do grupo.
 */
export const onMemberLeft = onDocumentDeleted(
  {document: "groups/{groupId}/members/{memberId}", region: FUNCTION_REGION},
  async (event) => {
    const groupId = event.params.groupId;
    const memberId = event.params.memberId;

    console.log(
      `[MEMBER_LEFT] Member ${memberId}` +
      ` left group ${groupId}`
    );

    try {
      // Buscar dados do grupo e do membro
      const [groupDoc, memberUserDoc] =
        await Promise.all([
          getDb()
            .collection("groups")
            .doc(groupId)
            .get(),
          getDb()
            .collection("users")
            .doc(memberId)
            .get(),
        ]);

      if (!groupDoc.exists) return;

      const group = groupDoc.data();
      const memberUser = memberUserDoc.exists ?
        memberUserDoc.data() :
        null;
      const memberName =
        memberUser?.name ||
        memberUser?.nickname ||
        "Um jogador";
      const groupName =
        group?.name || "o grupo";

      // Buscar admins e owners
      const adminsSnap = await getDb()
        .collection("groups")
        .doc(groupId)
        .collection("members")
        .where(
          "role",
          "in",
          ["ADMIN", "OWNER"]
        )
        .get();

      type DocSnap =
        admin.firestore.QueryDocumentSnapshot;
      const adminIds = adminsSnap.docs.map(
        (doc: DocSnap) => doc.id
      );

      if (adminIds.length > 0) {
        await sendNotificationToUsers(
          adminIds,
          {
            title: "Membro saiu",
            body: `${memberName}` +
              ` saiu de ${groupName}`,
            type:
              NotificationType.MEMBER_LEFT,
            data: {
              groupId: groupId,
              memberId: memberId,
              action:
                "group_detail/" + groupId,
            },
          }
        );

        console.log(
          "[MEMBER_LEFT] Notificacao" +
          " enviada para " +
          `${adminIds.length} admins`
        );
      }
    } catch (e) {
      console.error(
        "[MEMBER_LEFT] Erro ao processar:",
        e
      );
    }
  }
);

// ==========================================
// CASHBOX NOTIFICATIONS
// ==========================================

/**
 * Trigger quando uma transação de caixa é criada.
 * Notifica admins do grupo sobre entradas e saídas.
 */
export const onCashboxTransaction =
  onDocumentCreated(
    "groups/{groupId}/cashbox/{transactionId}",
    async (event) => {
      const transaction = event.data?.data();
      if (!transaction) return;

      const groupId = event.params.groupId;
      const transactionId =
        event.params.transactionId;

      const txType =
        transaction.type ||
        transaction.transactionType;
      const amount = transaction.amount || 0;
      const description =
        transaction.description || "";
      const createdById =
        transaction.created_by_id ||
        transaction.createdById;

      console.log(
        `[CASHBOX] Transaction ${transactionId}` +
        ` in group ${groupId}:` +
        ` ${txType} R$${amount}`
      );

      try {
        // Buscar dados do grupo
        const groupDoc = await getDb()
          .collection("groups")
          .doc(groupId)
          .get();
        if (!groupDoc.exists) return;

        // Buscar admins e owners
        const adminsSnap = await getDb()
          .collection("groups")
          .doc(groupId)
          .collection("members")
          .where(
            "role",
            "in",
            ["ADMIN", "OWNER"]
          )
          .get();

        type DocSnap =
          admin.firestore.QueryDocumentSnapshot;
        const adminIds = adminsSnap.docs
          .map((doc: DocSnap) => doc.id)
          .filter(
            (id: string) => id !== createdById
          );

        if (adminIds.length === 0) return;

        const isEntry =
          txType === "ENTRY" ||
          txType === "INCOME" ||
          txType === "RECEITA";
        const notificationType = isEntry ?
          NotificationType.CASHBOX_ENTRY :
          NotificationType.CASHBOX_EXIT;

        const title = isEntry ?
          "Entrada no caixa" :
          "Saida do caixa";
        const amountStr = amount.toFixed(2);
        const verb = isEntry ?
          "adicionado" :
          "retirado";
        const descPart = description ?
          ` - ${description}` :
          "";
        const body =
          `R$${amountStr} ${verb}${descPart}`;

        await sendNotificationToUsers(
          adminIds,
          {
            title,
            body,
            type: notificationType,
            data: {
              groupId: groupId,
              transactionId: transactionId,
              action:
                "group_cashbox/" + groupId,
            },
          }
        );

        console.log(
          "[CASHBOX] Notificacao enviada" +
          ` para ${adminIds.length} admins`
        );
      } catch (e) {
        console.error(
          "[CASHBOX] Erro ao processar" +
          " transacao:",
          e
        );
      }
    }
  );
