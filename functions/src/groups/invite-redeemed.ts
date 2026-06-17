/**
 * Cloud Function trigger para redenção de convites compartilháveis (`invites/`).
 *
 * Issue #2517 (regressão de #2153): a rule de self-create MEMBER exige
 * `is_public == true`, o que torna IMPOSSÍVEL entrar por convite em grupo
 * PRIVADO — justamente o propósito do código de convite. A própria correção
 * de #2153 previa o caminho legítimo: "self-create MEMBER ... OU convite
 * aprovado via trigger". O caminho de join_request ganhou seu trigger
 * (`onJoinRequestApproved`), mas o de convite ficou sem nenhum.
 *
 * Este trigger espelha `onJoinRequestApproved`: quando um convite válido é
 * marcado como usado (`used: false -> true`), cria a membership via admin SDK
 * (bypassa as rules) — funcionando tanto para grupos públicos quanto privados,
 * sem reabrir o buraco de #2153 (o gate `is_public == true` da rule continua
 * intacto; o cliente não cria mais o member doc).
 *
 * Fluxo:
 *  1. Cliente (web/Android) só marca `invites/{code}.used = true`,
 *     `used_by = self`, `used_at`.
 *  2. Este trigger cria `groups/{gid}/members/{uid}` com status ACTIVE.
 *  3. `onMemberWritten` (member-counter.ts) detecta o CREATE e incrementa
 *     `member_count` (server-authoritative). Por isso aqui NÃO setamos
 *     `_counted_by_join_request` e NÃO incrementamos o counter — evita
 *     double-count.
 *  4. Cria denormalized `users/{uid}/groups/{gid}` (best-effort de UX).
 */

import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {isRecord} from "../validation/guards";

const db = () => admin.firestore();

interface InviteData {
  group_id?: string;
  group_name?: string;
  used: boolean;
  used_by?: string;
  expires_at?: Timestamp | null;
}

/**
 * FIX #2517: valida o shape mínimo de um invite (`used` boolean) antes do
 * cast cego sobre dados crus do Firestore.
 * @param {unknown} data dados crus do snapshot
 * @return {boolean} true se válido
 */
function isInviteShape(data: unknown): data is InviteData {
  return isRecord(data) && typeof data.used === "boolean";
}

export const onInviteRedeemed = onDocumentUpdated(
  {
    document: "invites/{code}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    if (!event.data) return;

    const beforeRaw = event.data.before.data();
    const afterRaw = event.data.after.data();
    if (!isInviteShape(beforeRaw) || !isInviteShape(afterRaw)) {
      if (beforeRaw || afterRaw) {
        logger.error("[GUARD] invite malformado", {...event.params});
      }
      return;
    }
    const before: InviteData = beforeRaw;
    const after: InviteData = afterRaw;

    // Só processa transição used: false -> true (redenção).
    if (before.used !== false || after.used !== true) {
      return;
    }

    const {code} = event.params;
    const userId = after.used_by;
    const groupId = after.group_id;

    // Coerência mínima: quem redime (used_by) e o grupo precisam existir.
    // A rule de update de invites já garante used_by == auth.uid e que o
    // convite não estava usado nem expirado, mas re-validamos por defesa em
    // profundidade (triggers rodam fora do contexto de auth do cliente).
    if (!userId || typeof userId !== "string") {
      logger.warn("invite redeemed sem used_by válido", {code});
      return;
    }
    if (!groupId || typeof groupId !== "string") {
      logger.warn("invite redeemed sem group_id", {code, userId});
      return;
    }

    // Defesa em profundidade: convite expirado não cria membership mesmo se
    // o update tiver passado (clock skew etc).
    if (after.expires_at && after.expires_at.toMillis() < Date.now()) {
      logger.warn("invite redeemed mas expirado — abortando", {code, userId});
      return;
    }

    // Idempotência barata fora da transação.
    const memberRef = db().doc(`groups/${groupId}/members/${userId}`);
    const memberSnap = await memberRef.get();
    if (memberSnap.exists) {
      logger.info("invite redeemed mas já é membro — skip", {groupId, userId});
      return;
    }

    // Grupo precisa existir e estar ATIVO.
    const groupRef = db().doc(`groups/${groupId}`);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      logger.error("invite redeemed mas grupo não encontrado", {
        code,
        groupId,
        userId,
      });
      return;
    }
    const groupMeta = groupSnap.data() as Record<string, unknown>;
    const groupStatus = (groupMeta.status as string | undefined) ?? "ACTIVE";
    if (groupStatus !== "ACTIVE") {
      logger.warn("invite redeemed mas grupo inativo — abortando", {
        groupId,
        userId,
        groupStatus,
      });
      return;
    }
    const groupName = (groupMeta.name as string) ??
      (after.group_name as string | undefined) ?? "";
    const groupPhoto = (groupMeta.photo_url as string | null) ?? null;

    // O convite só guarda o nome do INVITER, não do JOINER. Buscamos o perfil
    // de quem redimiu (used_by) para popular name/photo do member doc.
    let joinerName = "Jogador";
    let joinerPhoto: string | null = null;
    try {
      const userSnap = await db().doc(`users/${userId}`).get();
      const userData = userSnap.data() as Record<string, unknown> | undefined;
      if (userData) {
        joinerName = (userData.name as string) ??
          (userData.display_name as string) ?? joinerName;
        joinerPhoto = (userData.photo_url as string | null) ??
          (userData.photoUrl as string | null) ?? null;
      }
    } catch (e) {
      logger.warn("invite redeemed: falha ao ler perfil do joiner", {
        userId,
        error: (e as Error).message,
      });
    }

    await db().runTransaction(async (tx) => {
      // FIX #2517: idempotência sob entrega duplicada (triggers são
      // at-least-once). Checagem DENTRO da transação garante atomicidade.
      const txMemberSnap = await tx.get(memberRef);
      if (txMemberSnap.exists) {
        logger.info("invite redeemed: member já existe (retry idempotente)", {
          groupId,
          userId,
        });
        return;
      }

      // Criamos o member SEM `_counted_by_join_request` e SEM incrementar
      // member_count: `onMemberWritten` detecta o CREATE_ACTIVE e faz o
      // único +1 (server-authoritative). Setar a flag ou incrementar aqui
      // causaria count=0 (flag suprime o trigger) ou double-count.
      tx.set(memberRef, {
        id: userId,
        user_id: userId,
        user_name: joinerName,
        user_photo: joinerPhoto,
        role: "MEMBER",
        status: "ACTIVE",
        joined_at: FieldValue.serverTimestamp(),
        joined_via_invite: code,
      });

      // Denormalized users/{uid}/groups/{gid} (UX: lista de grupos do user).
      tx.set(db().doc(`users/${userId}/groups/${groupId}`), {
        id: groupId,
        group_id: groupId,
        group_name: groupName,
        group_photo: groupPhoto,
        role: "MEMBER",
        joined_at: FieldValue.serverTimestamp(),
      });
    });

    logger.info("invite redeemed e member criado", {
      code,
      groupId,
      userId,
    });
  }
);
