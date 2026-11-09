/**
 * Aplica as claims de conta de revisão da Play (`verified` e
 * `profileComplete` verdadeiros, demais claims preservadas) a cada UID de
 * `system_config/play_review_accounts` (`{uids: string[]}`).
 *
 * Uso (login gcloud do Renan, Application Default Credentials):
 *   npm run build
 *   node lib/scripts/apply-review-account-claims.js [--execute]
 *
 * Dry-run é o padrão. Idempotente. Não revoga refresh tokens.
 * Nenhum UID, e-mail ou telefone é impresso (repositório público; logs
 * podem ser colados em PR).
 *
 * Spec: specs/feat-2026-11-09-conta-revisao-play.md
 */
import * as admin from "firebase-admin";
import {
  ApplyReviewClaimsOutcome,
  applyReviewAccountClaims,
  loadReviewAccountUids,
} from "../auth/review-accounts";

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

  console.log(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    projectId,
    listed: listed.size,
    ...counts,
  }));
}

run().catch((error) => {
  console.error("Falha ao aplicar claims de revisão:",
    (error as Error)?.message ?? error);
  process.exitCode = 1;
});
