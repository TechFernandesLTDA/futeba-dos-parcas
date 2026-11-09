/**
 * Contas de revisão de loja (Google Play).
 *
 * O revisor da Play não consegue fazer SMS nem informar CPF, então não passa
 * pelo fluxo que concede `verified` e `profileComplete`. Para os UIDs listados
 * no documento de configuração abaixo, o servidor trata essas duas claims como
 * verdadeiras. Nada muda para quem não está na lista.
 *
 * O documento fica em `system_config/`, coleção sem `match` em
 * firestore.rules: cai no deny-all final, então nenhum cliente (nem ADMIN)
 * lê ou grava. Só o Admin SDK acessa. Repositório público: UID, e-mail ou
 * senha do revisor NUNCA entram no código, nos testes ou nos docs.
 *
 * Spec: specs/feat-2026-11-09-conta-revisao-play.md
 */
import * as admin from "firebase-admin";
import {isRecord} from "../validation/guards";

/** Caminho do documento com a lista de contas de revisão. */
export const REVIEW_ACCOUNTS_DOC = "system_config/play_review_accounts";

type Claims = Record<string, unknown>;

/**
 * Extrai os UIDs de revisão do documento de configuração.
 * Formato esperado: `{uids: string[]}`. Qualquer outra coisa vira lista vazia;
 * entradas que não são string não vazia são ignoradas.
 *
 * @param {unknown} data Conteúdo cru do documento (ou undefined).
 * @return {Set<string>} UIDs listados.
 */
export function parseReviewAccountUids(data: unknown): Set<string> {
  if (!isRecord(data) || !Array.isArray(data.uids)) return new Set();
  return new Set(
    data.uids.filter(
      (uid): uid is string => typeof uid === "string" && uid.trim().length > 0
    ).map((uid) => uid.trim())
  );
}

/**
 * Lê a lista de UIDs de revisão. Documento ausente = lista vazia.
 * Erro de leitura sobe para o chamador: num trigger com retry, engolir o erro
 * rebaixaria a claim do revisor em silêncio.
 *
 * @return {Promise<Set<string>>} UIDs listados.
 */
export async function loadReviewAccountUids(): Promise<Set<string>> {
  const snap = await admin.firestore().doc(REVIEW_ACCOUNTS_DOC).get();
  return parseReviewAccountUids(snap.exists ? snap.data() : undefined);
}

/**
 * Diz se o UID está na lista de contas de revisão.
 *
 * @param {string} uid ID do usuário.
 * @return {Promise<boolean>} true se listado.
 */
export async function isReviewAccount(uid: string): Promise<boolean> {
  return (await loadReviewAccountUids()).has(uid);
}

/**
 * Claim que marca a origem: `verified`/`profileComplete` vieram da designação
 * de conta de revisão, não do fluxo real de SMS + CPF. Permite revogar quando
 * o UID sai da lista.
 */
export const REVIEW_ACCOUNT_CLAIM = "reviewAccount";

/**
 * Claims efetivas de uma conta de revisão: as atuais (role etc.) com
 * `verified` e `profileComplete` verdadeiros e a marca de origem.
 *
 * @param {Claims} current Claims atuais do usuário.
 * @return {Claims} Claims a gravar.
 */
export function buildReviewAccountClaims(current: Claims): Claims {
  return {
    ...current,
    verified: true,
    profileComplete: true,
    [REVIEW_ACCOUNT_CLAIM]: true,
  };
}

/**
 * Diz se as claims já estão no estado de conta de revisão.
 *
 * @param {Claims} current Claims atuais do usuário.
 * @return {boolean} true se nada precisa mudar.
 */
export function hasReviewAccountClaims(current: Claims): boolean {
  return current.verified === true &&
    current.profileComplete === true &&
    current[REVIEW_ACCOUNT_CLAIM] === true;
}

/**
 * Diz se as claims carregam a marca de conta de revisão.
 *
 * @param {Claims} current Claims atuais do usuário.
 * @return {boolean} true se a designação concedeu as claims.
 */
export function hasReviewAccountMark(current: Claims): boolean {
  return current[REVIEW_ACCOUNT_CLAIM] === true;
}

/**
 * Claims de uma conta que saiu da lista de revisão: volta à regra normal.
 * - Remove a marca `reviewAccount`.
 * - `profileComplete` = regra normal (CPF verificado + telefone BR no Auth).
 * - `verified` só fica se a regra normal também fecha. O `verified` real
 *   (`setUserVerified`) exige o mesmo par telefone + CPF; sem ele, o
 *   `verified` veio só da designação e é retirado.
 * Demais claims (role etc.) preservadas.
 *
 * @param {Claims} current Claims atuais do usuário.
 * @param {boolean} realProfileComplete Resultado da regra normal.
 * @return {Claims} Claims a gravar.
 */
export function buildRemovedReviewAccountClaims(
  current: Claims,
  realProfileComplete: boolean
): Claims {
  const next: Claims = {...current, profileComplete: realProfileComplete};
  delete next[REVIEW_ACCOUNT_CLAIM];
  if (!realProfileComplete) delete next.verified;
  return next;
}

export type ApplyReviewClaimsOutcome =
  | "not-listed"
  | "user-not-found"
  | "already-current"
  | "would-apply"
  | "applied";

/**
 * Aplica as claims de conta de revisão a um UID, se ele estiver na lista.
 * Idempotente. Não revoga refresh tokens (derrubaria a sessão do revisor);
 * o app força refresh do token no gate de verificação. A remoção da lista é
 * tratada por `revokeRemovedReviewAccount` (profile-complete-claim.ts).
 *
 * @param {string} uid ID do usuário.
 * @param {Set<string>} listed UIDs listados (de loadReviewAccountUids).
 * @param {boolean} execute false = só simula (dry-run).
 * @return {Promise<ApplyReviewClaimsOutcome>} O que aconteceu.
 */
export async function applyReviewAccountClaims(
  uid: string,
  listed: Set<string>,
  execute: boolean
): Promise<ApplyReviewClaimsOutcome> {
  if (!listed.has(uid)) return "not-listed";

  const userRecord = await admin.auth().getUser(uid).catch((error) => {
    if ((error as {code?: string})?.code === "auth/user-not-found") {
      return null;
    }
    throw error;
  });
  if (!userRecord) return "user-not-found";

  const current = userRecord.customClaims ?? {};
  if (hasReviewAccountClaims(current)) return "already-current";
  if (!execute) return "would-apply";

  await admin.auth().setCustomUserClaims(
    uid,
    buildReviewAccountClaims(current)
  );
  return "applied";
}
