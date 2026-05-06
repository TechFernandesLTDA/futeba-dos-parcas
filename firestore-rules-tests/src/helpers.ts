/**
 * Helpers compartilhados para os testes de Firestore Security Rules.
 *
 * Padrão de uso:
 * 1. `initTestEnv()` — cria o ambiente com as regras reais
 * 2. `adminDb()` — acesso sem regras (seed de fixtures)
 * 3. `asAdmin()` / `asPlayer()` / `asFieldOwner()` / `asUser()` — contextos autenticados
 * 4. `asAnon()` — contexto não-autenticado
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Caminho para as rules no repo raiz
const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, "../../firestore.rules");

// ID do projeto (deve bater com .firebaserc)
export const PROJECT_ID = "futebadosparcas";

// Porta do emulador (deve bater com firebase.json)
export const EMULATOR_PORT = 8085;

// UIDs fixos usados nos testes
export const UID_ADMIN = "uid-admin-001";
export const UID_FIELD_OWNER = "uid-field-owner-001";
export const UID_PLAYER_A = "uid-player-a-001";
export const UID_PLAYER_B = "uid-player-b-001";
export const UID_PLAYER_C = "uid-player-c-001";

/**
 * Inicializa o ambiente de testes com as regras reais do projeto.
 * Deve ser chamado em `beforeAll` de cada suite.
 */
export async function initTestEnv(): Promise<RulesTestEnvironment> {
  const rules = readFileSync(RULES_PATH, "utf8");
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: "127.0.0.1",
      port: EMULATOR_PORT,
    },
  });
}

/**
 * Retorna um contexto autenticado como ADMIN (com Custom Claim role='ADMIN').
 * verified=true para não ser bloqueado pela grace period.
 */
export function asAdmin(testEnv: RulesTestEnvironment) {
  return testEnv
    .authenticatedContext(UID_ADMIN, {
      role: "ADMIN",
      verified: true,
    })
    .firestore();
}

/**
 * Retorna um contexto autenticado como FIELD_OWNER (Custom Claim role='FIELD_OWNER').
 */
export function asFieldOwner(testEnv: RulesTestEnvironment) {
  return testEnv
    .authenticatedContext(UID_FIELD_OWNER, {
      role: "FIELD_OWNER",
      verified: true,
    })
    .firestore();
}

/**
 * Retorna um contexto autenticado como PLAYER com UID_PLAYER_A.
 * verified=true para evitar bloqueios da grace period nos testes.
 */
export function asPlayerA(testEnv: RulesTestEnvironment) {
  return testEnv
    .authenticatedContext(UID_PLAYER_A, {
      role: "PLAYER",
      verified: true,
    })
    .firestore();
}

/**
 * Retorna um contexto autenticado como PLAYER com UID_PLAYER_B (segundo jogador).
 */
export function asPlayerB(testEnv: RulesTestEnvironment) {
  return testEnv
    .authenticatedContext(UID_PLAYER_B, {
      role: "PLAYER",
      verified: true,
    })
    .firestore();
}

/**
 * Retorna um contexto autenticado como PLAYER com UID_PLAYER_C (terceiro jogador).
 */
export function asPlayerC(testEnv: RulesTestEnvironment) {
  return testEnv
    .authenticatedContext(UID_PLAYER_C, {
      role: "PLAYER",
      verified: true,
    })
    .firestore();
}

/**
 * Retorna um contexto de usuário autenticado com UID e claims arbitrários.
 */
export function asUser(
  testEnv: RulesTestEnvironment,
  uid: string,
  claims: Record<string, unknown> = { role: "PLAYER", verified: true }
) {
  return testEnv.authenticatedContext(uid, claims).firestore();
}

/**
 * Retorna um contexto não-autenticado (anônimo).
 */
export function asAnon(testEnv: RulesTestEnvironment) {
  return testEnv.unauthenticatedContext().firestore();
}

/**
 * Retorna o Firestore sem aplicar regras (bypass total).
 * Usado para seeding de fixtures nos testes.
 */
export function adminDb(testEnv: RulesTestEnvironment) {
  return testEnv.withSecurityRulesDisabled((ctx) => ctx.firestore());
}

/**
 * Helper para seed via bypass de rules.
 * Garante que fixtures estejam prontas antes dos testes de permissão.
 */
export async function seedDoc(
  testEnv: RulesTestEnvironment,
  path: string,
  data: Record<string, unknown>
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(path).set(data);
  });
}

/**
 * Helper para seed de múltiplos documentos.
 */
export async function seedDocs(
  testEnv: RulesTestEnvironment,
  docs: Array<{ path: string; data: Record<string, unknown> }>
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const batch = db.batch();
    for (const { path, data } of docs) {
      batch.set(db.doc(path), data);
    }
    await batch.commit();
  });
}
