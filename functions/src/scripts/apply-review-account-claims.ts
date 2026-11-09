/**
 * Sincroniza as claims de conta de revisão da Play com
 * `system_config/play_review_accounts` (`{uids: string[]}`):
 * - UID listado: `verified` e `profileComplete` verdadeiros e a marca
 *   `reviewAccount`, demais claims preservadas;
 * - conta com a marca que saiu da lista (varredura do Auth): volta à regra
 *   normal (profileComplete por CPF + telefone; verified retirado se a regra
 *   normal não fecha) e tem os refresh tokens revogados.
 *
 * Uso (login gcloud do Renan, Application Default Credentials):
 *   npm run build
 *   node lib/scripts/apply-review-account-claims.js [--execute]
 *
 * Dry-run é o padrão. Idempotente. Só revoga refresh tokens de quem saiu.
 * Nenhum UID, e-mail ou telefone é impresso (repositório público; logs
 * podem ser colados em PR).
 *
 * Spec: specs/feat-2026-11-09-conta-revisao-play.md
 */
import * as admin from "firebase-admin";
import {
  ApplyReviewClaimsOutcome,
  REVIEW_ACCOUNT_CLAIM,
  applyReviewAccountClaims,
  loadReviewAccountUids,
} from "../auth/review-accounts";
import {
  RemovedReviewAccountOutcome,
  revokeRemovedReviewAccount,
} from "../auth/profile-complete-claim";

const execute = process.argv.includes("--execute");
const projectId = process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  "futebadosparcas";

if (admin.apps.length === 0) admin.initializeApp({projectId});

/** Executa dry-run ou aplicação idempotente das claims. */
async function run(): Promise<void> {
  const listed = await loadReviewAccountUids();
  const counts: Record<ApplyReviewClaimsOutcome, number> = {
    "not-listed": 0,
    "user-not-found": 0,
    "already-current": 0,
    "would-apply": 0,
    "applied": 0,
  };

  let index = 0;
  for (const uid of listed) {
    index++;
    const outcome = await applyReviewAccountClaims(uid, listed, execute);
    counts[outcome]++;
    console.log(`conta ${index}/${listed.size}: ${outcome}`);
  }

  // Quem saiu da lista: varre o Auth atrás da marca reviewAccount.
  const removed: Record<RemovedReviewAccountOutcome, number> = {
    "still-listed": 0,
    "not-marked": 0,
    "user-not-found": 0,
    "would-revoke": 0,
    "revoked": 0,
  };
  let pageToken: string | undefined;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    for (const user of page.users) {
      if (user.customClaims?.[REVIEW_ACCOUNT_CLAIM] !== true) continue;
      if (listed.has(user.uid)) continue;
      const outcome = await revokeRemovedReviewAccount(
        user.uid, listed, execute
      );
      removed[outcome]++;
      console.log(`conta removida da lista: ${outcome}`);
    }
    pageToken = page.pageToken;
  } while (pageToken);

  console.log(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    projectId,
    listed: listed.size,
    ...counts,
    removedWouldRevoke: removed["would-revoke"],
    removedRevoked: removed["revoked"],
  }));
}

run().catch((error) => {
  console.error("Falha ao aplicar claims de revisão:",
    (error as Error)?.message ?? error);
  process.exitCode = 1;
});
