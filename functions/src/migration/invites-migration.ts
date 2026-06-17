/**
 * Cloud Function: migrateGroupsInviteCodeToInvites
 *
 * Migracao one-shot: copia codigos legados de
 * `groups/{id}.invite_code` (sticky, Android) para a
 * coleção `invites/` (rica, com TTL e tracking) usada
 * pelo web. Apos esta migracao, ambos os clients
 * (Android + web) usam o mesmo sistema canonico.
 *
 * Idempotente:
 *   - Pula grupos cujo code ja foi migrado (campo
 *     `migratedFromGroupId` em invites/).
 *   - Pula grupos sem invite_code.
 *
 * SPEC: feat-2026-05-08-consolidate-shareable-invites.md
 */

import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
import {HttpsError} from "firebase-functions/v2/https";
import {FieldValue, FieldPath, Timestamp} from "firebase-admin/firestore";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {ERROR_MSGS} from "../error-messages";
import {db} from "../_db";

interface MigrationResult {
  scanned: number;
  migrated: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

const LOCK_DOC = "invites_migration";
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hora

export const migrateGroupsInviteCodeToInvites =
  secureCallable<unknown, MigrationResult>(
    {
      appCheck: !process.env.FUNCTIONS_EMULATOR,
      requireAuth: true,
      requiredRole: "ADMIN",
      rateLimit: {
        maxRequests: 3,
        windowMs: 60 * 1000,
        keyPrefix: "migrate_invites",
      },
      enableAuditLog: true,
      auditLogContext: async (request) => ({
        function: "migrateGroupsInviteCodeToInvites",
        callerUid: request.auth?.uid,
      }),
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
      }
      const startedAt = Date.now();
      const callerUid = request.auth.uid;

      // Rate limit via system lock (1h)
      const lockRef = db()
        .collection("system_locks")
        .doc(LOCK_DOC);
      const lockDoc = await lockRef.get();
      if (lockDoc.exists) {
        const lastRun =
          lockDoc.data()?.last_run_at?.toDate?.();
        if (
          lastRun &&
          Date.now() - lastRun.getTime() < RATE_LIMIT_MS
        ) {
          const minutesRemaining = Math.ceil(
            (RATE_LIMIT_MS -
              (Date.now() - lastRun.getTime())) /
              60000
          );
          // FIX #2196: callable deve lançar HttpsError, não Error genérico.
          throw new HttpsError(
            "resource-exhausted",
            "Migration already ran recently. Try again " +
              `in ${minutesRemaining} minutes.`
          );
        }
      }

      await lockRef.set({
        last_run_at: FieldValue.serverTimestamp(),
        started_by: callerUid,
        status: "running",
      });

      logger.info(
        "[INVITES_MIGRATION] Starting migration by " +
          `${callerUid}`
      );

      const result: MigrationResult = {
        scanned: 0,
        migrated: 0,
        skipped: 0,
        errors: 0,
        durationMs: 0,
      };

      try {
        // Iterar grupos em chunks de 200
        let lastDoc:
          admin.firestore.QueryDocumentSnapshot | null =
          null;
        let hasMore = true;

        while (hasMore) {
          // NOTA: scan completo + filtro in-loop em vez
          // de `where("invite_code", "!=", "")`. Firestore
          // `!=` exclui docs sem o campo, mas a semantica
          // ainda exige indice composto. Scan + filter eh
          // mais simples e robusto pra ~hundreds de grupos.
          let q = db()
            .collection("groups")
            .orderBy(FieldPath.documentId())
            .limit(200);

          if (lastDoc) {
            q = q.startAfter(lastDoc);
          }

          const snap = await q.get();
          if (snap.empty) {
            hasMore = false;
            break;
          }

          for (const groupDoc of snap.docs) {
            result.scanned += 1;
            const groupId = groupDoc.id;
            const data = groupDoc.data();
            const code: string | undefined =
              data.invite_code;
            const groupName: string =
              data.name ?? "Grupo";

            if (!code || code.length === 0) {
              result.skipped += 1;
              continue;
            }

            try {
              // Idempotency check: ja foi migrado?
              const existing = await db()
                .collection("invites")
                .where(
                  "migratedFromGroupId",
                  "==",
                  groupId
                )
                .limit(1)
                .get();

              if (!existing.empty) {
                result.skipped += 1;
                continue;
              }

              // Collision check: code ja existe em invites/?
              // (dois grupos podem ter o mesmo invite_code legado)
              const codeCollision = await db()
                .collection("invites")
                .where("code", "==", code.toUpperCase())
                .limit(1)
                .get();

              if (!codeCollision.empty) {
                logger.warn(
                  "[INVITES_MIGRATION] Code collision: " +
                  `"${code}" do grupo ${groupId} ` +
                  "ja existe em " +
                  `invites/${codeCollision.docs[0].id} ` +
                  `(grupo ${codeCollision.docs[0].data().group_id}). ` +
                  "Pulando para evitar duplicata."
                );
                result.skipped += 1;
                continue;
              }

              // Cria doc em invites/ com TTL longo
              // (legacy codes sao sticky -> 365 dias)
              const expiresAt = Timestamp
                .fromMillis(
                  Date.now() + 365 * 24 * 60 * 60 * 1000
                );

              await db()
                .collection("invites")
                .add({
                  code: code.toUpperCase(),
                  group_id: groupId,
                  group_name: groupName,
                  inviter_id: data.owner_id ?? callerUid,
                  inviter_name:
                    data.owner_name ?? "Sistema",
                  created_at:
                    FieldValue.serverTimestamp(),
                  expires_at: expiresAt,
                  used: false,
                  migratedFromGroupId: groupId,
                  migratedAt:
                    FieldValue.serverTimestamp(),
                });

              result.migrated += 1;
            } catch (e) {
              logger.error(
                "[INVITES_MIGRATION] Error migrating " +
                  `group ${groupId}`,
                e
              );
              result.errors += 1;
            }
          }

          lastDoc = snap.docs[snap.docs.length - 1];
          if (snap.docs.length < 200) {
            hasMore = false;
          }
        }

        result.durationMs = Date.now() - startedAt;

        await lockRef.set(
          {
            last_run_at: FieldValue.serverTimestamp(),
            completed_at: FieldValue.serverTimestamp(),
            status: "completed",
            result,
          },
          {merge: true}
        );

        logger.info(
          "[INVITES_MIGRATION] Done",
          result
        );

        return result;
      } catch (e) {
        await lockRef.set(
          {
            status: "failed",
            error: (e as Error).message,
          },
          {merge: true}
        );
        throw e;
      }
    }
  );
