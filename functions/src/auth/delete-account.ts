/**
 * DELETE ACCOUNT — #4391 (LGPD art. 18, VI; Google Play; App Store 5.1.1(v))
 *
 * Callable `deleteAccount`, chamada pela web (services/cloudFunctions.ts),
 * pelo Android (AuthRepository.kt) e pelo iOS. Contrato mantido:
 * sem payload obrigatório, retorno `{success: true}`.
 *
 * Fluxo (spec: specs/BUGFIX_4391_DELETE_ACCOUNT.md):
 * 1. secureCallable: App Check, login obrigatório, 3 chamadas por hora;
 * 2. login recente: `auth_time` do token nos últimos 10 minutos;
 * 3. grupos de que o titular é dono: com outro membro ativo ⇒ bloqueia
 *    (o titular transfere a posse antes); sem ninguém ⇒ soft delete do grupo;
 * 4. TODA verificação acontece antes da primeira escrita: uma exclusão
 *    bloqueada deixa a conta intacta;
 * 5. exclui o usuário do Firebase Auth POR ÚLTIMO. Isso dispara o trigger
 *    `onUserDeleted` (account-cleanup.ts), que é a ÚNICA cascata de
 *    apagamento/anonimização (com retry via failurePolicy por até 24h).
 *    A cascata não roda aqui de propósito: ela pode levar minutos e os SDKs
 *    clientes desistem da callable em ~70s, o que reportaria falha para uma
 *    exclusão que deu certo. Deleções feitas pelo console também passam pela
 *    mesma cascata;
 * 6. log de auditoria sem PII: hash SHA-256 do uid, data e contagens.
 *
 * Idempotente: chamar de novo após o sucesso (token ainda válido) encontra o
 * usuário já excluído no Auth (`auth/user-not-found`) e responde sucesso.
 */

import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {createHash} from "crypto";
import {db} from "../_db";
import {getAuth} from "../utils/firebase-lazy";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {softDeleteGroupCascade} from "../utils/soft-delete-helper";
import {classifyOwnedGroups} from "./account-deletion-cascade";

/** Janela de login recente exigida para excluir a conta (segundos). */
export const RECENT_LOGIN_MAX_AGE_SECONDS = 10 * 60;

/** Tolerância de relógio entre o emissor do token e a função (segundos). */
const CLOCK_SKEW_SECONDS = 60;

/** Motivos de bloqueio expostos em `HttpsError.details.reason`. */
export const DELETE_ACCOUNT_BLOCK_REASONS = {
  recentLogin: "requires-recent-login",
  soleOwner: "sole-owner-groups",
} as const;

/**
 * Hash do uid para o log de auditoria: permite correlacionar pedidos sem
 * guardar o identificador do titular depois da exclusão.
 *
 * @param {string} uid uid do Firebase Auth
 * @return {string} SHA-256 em hexadecimal
 */
export function hashUid(uid: string): string {
  return createHash("sha256").update(uid, "utf8").digest("hex");
}

/**
 * Lança `failed-precondition` se o login não for recente.
 *
 * @param {unknown} authTime claim `auth_time` (segundos desde a época)
 * @param {number} nowMs agora em milissegundos
 * @return {void}
 */
export function assertRecentLogin(authTime: unknown, nowMs: number): void {
  const nowSeconds = Math.floor(nowMs / 1000);
  const valid = typeof authTime === "number" && Number.isFinite(authTime);
  const age = valid ? nowSeconds - authTime : Number.POSITIVE_INFINITY;
  if (age > RECENT_LOGIN_MAX_AGE_SECONDS || age < -CLOCK_SKEW_SECONDS) {
    throw new HttpsError(
      "failed-precondition",
      "Por segurança, entre de novo na sua conta e repita a exclusão " +
      "nos próximos 10 minutos.",
      {
        reason: DELETE_ACCOUNT_BLOCK_REASONS.recentLogin,
        maxAgeSeconds: RECENT_LOGIN_MAX_AGE_SECONDS,
      },
    );
  }
}

/**
 * @param {unknown} error erro do Admin SDK
 * @return {boolean} true se o usuário já não existe no Auth
 */
function isUserNotFound(error: unknown): boolean {
  const code = (error as {code?: unknown} | null)?.code;
  return code === "auth/user-not-found";
}

export const deleteAccount = secureCallable<unknown, {success: true}>(
  {
    rateLimit: {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
      keyPrefix: "delete_account",
    },
    // O audit do wrapper grava uid cru e IP em audit_logs (campo `userId`,
    // fora do alcance do onUserDeleted) e DEPOIS do handler, ou seja, depois
    // da varredura. Esta callable grava o próprio registro, sem PII.
    enableAuditLog: false,
    // App Check continua exigido (default do wrapper em produção). Sem
    // consumir o token: o cliente pode repetir a chamada depois de
    // transferir um grupo ou entrar de novo, e o token reaproveitado seria
    // rejeitado como replay. Login recente + rate limit cobrem o abuso.
    consumeAppCheckToken: false,
    timeoutSeconds: 120,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      // O wrapper já exige auth; defesa em profundidade.
      throw new HttpsError("unauthenticated", "Faça login para excluir a conta.");
    }

    // 1. Login recente (antes de qualquer leitura de dados).
    assertRecentLogin(request.auth?.token?.auth_time, Date.now());

    // 2. Grupos de que o titular é dono. Só leitura até aqui.
    const firestore = db();
    const owned = await classifyOwnedGroups(firestore, uid);
    if (owned.blocking.length > 0) {
      const names = owned.blocking.map((group) => group.name).filter(Boolean);
      throw new HttpsError(
        "failed-precondition",
        "Você é dono de grupo(s) com outros membros" +
        (names.length > 0 ? ` (${names.join(", ")})` : "") +
        ". Transfira a posse ou exclua o grupo antes de excluir sua conta.",
        {
          reason: DELETE_ACCOUNT_BLOCK_REASONS.soleOwner,
          groupCount: owned.blocking.length,
          groups: owned.blocking,
        },
      );
    }

    // 3. Grupos sem mais ninguém: soft delete (mesma cascata do
    //    softDeleteGroup; os jogos do grupo são marcados juntos). O
    //    onUserDeleted depois anonimiza o owner_name.
    let orphanGroupsDeleted = 0;
    for (const group of owned.orphan) {
      const result = await softDeleteGroupCascade(
        group.id,
        uid,
        "Conta do dono excluída (LGPD art. 18, VI)",
      );
      if (result.groupDeleted) {
        orphanGroupsDeleted++;
      } else if (result.error && result.error !== "Grupo já deletado") {
        // Falha antes de excluir o Auth: a conta continua intacta e o
        // usuário pode tentar de novo.
        logger.error("[DELETE_ACCOUNT] Falha ao excluir grupo sem membros", {
          uidHash: hashUid(uid),
          groupId: group.id,
          error: result.error,
        });
        throw new HttpsError(
          "internal",
          "Não foi possível concluir a exclusão. Tente novamente."
        );
      }
    }

    // 4. Firebase Auth por último. Dispara onUserDeleted (cascata LGPD).
    let alreadyDeleted = false;
    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      if (!isUserNotFound(error)) throw error;
      alreadyDeleted = true;
    }

    // 5. Auditoria sem PII. Falha aqui não desfaz a exclusão nem vira erro
    //    para o cliente (a conta já foi excluída).
    const uidHash = hashUid(uid);
    try {
      await firestore.collection("audit_logs").add({
        action: "ACCOUNT_DELETED",
        source: "deleteAccount",
        uid_sha256: uidHash,
        deleted_at: FieldValue.serverTimestamp(),
        already_deleted: alreadyDeleted,
        counts: {
          orphan_groups_soft_deleted: orphanGroupsDeleted,
        },
      });
    } catch (auditError) {
      logger.error("[DELETE_ACCOUNT] Falha ao gravar auditoria", {
        uidHash,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    logger.info("[DELETE_ACCOUNT] Conta excluída", {
      uidHash,
      alreadyDeleted,
      orphanGroupsDeleted,
    });

    return {success: true};
  },
);
