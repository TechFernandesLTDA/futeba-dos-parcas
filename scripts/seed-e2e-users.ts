/**
 * Seed de usuários E2E no emulador Firebase Auth.
 *
 * Cria 3 usuários de teste (PLAYER, FIELD_OWNER, ADMIN) com Custom Claims
 * via Admin SDK. Idempotente — pode ser reexecutado sem efeitos colaterais.
 *
 * ATENÇÃO: Este script só deve rodar contra o emulador local.
 * A variável FIREBASE_AUTH_EMULATOR_HOST é obrigatória para evitar
 * acidente de escrita em produção.
 *
 * Uso:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx tsx scripts/seed-e2e-users.ts
 *   (ou via npm run seed:e2e no diretório web/)
 */

import * as admin from 'firebase-admin';

// ==========================================
// TIPOS
// ==========================================

type UserRole = 'PLAYER' | 'FIELD_OWNER' | 'ADMIN';

interface TestUser {
  uid: string;
  email: string;
  password: string;
  displayName: string;
  nickname: string;
  preferredPosition: 'GOLEIRO' | 'ZAGUEIRO' | 'LATERAL' | 'VOLANTE' | 'MEIA' | 'ATACANTE';
  role: UserRole;
  /**
   * Custom claim `verified` (default true). O caso do PLAYER não verificado
   * existe para validar a guarda VerifiedRoute/ProtectedRoute → /onboarding.
   */
  verified?: boolean;
}

// ==========================================
// USUÁRIOS DE TESTE
// Credenciais fixas para facilitar
// automação e referência nos fixtures.
// ==========================================

const TEST_USERS: TestUser[] = [
  {
    uid: 'e2e-test-player',
    email: process.env.VITE_TEST_PLAYER_EMAIL || 'test.player@futeba.test',
    password: process.env.VITE_TEST_PLAYER_PASSWORD || 'Test123!@#',
    displayName: 'Jogador Teste E2E',
    nickname: 'Player E2E',
    preferredPosition: 'MEIA',
    role: 'PLAYER',
  },
  {
    uid: 'e2e-test-field-owner',
    email: process.env.VITE_TEST_FIELD_OWNER_EMAIL || 'test.fieldowner@futeba.test',
    password: process.env.VITE_TEST_FIELD_OWNER_PASSWORD || 'Test123!@#',
    displayName: 'Dono de Campo Teste E2E',
    nickname: 'Owner E2E',
    preferredPosition: 'VOLANTE',
    role: 'FIELD_OWNER',
  },
  {
    uid: 'e2e-test-admin',
    email: process.env.VITE_TEST_ADMIN_EMAIL || 'test.admin@futeba.test',
    password: process.env.VITE_TEST_ADMIN_PASSWORD || 'Test123!@#',
    displayName: 'Admin Teste E2E',
    nickname: 'Admin E2E',
    preferredPosition: 'ZAGUEIRO',
    role: 'ADMIN',
  },
  {
    uid: 'e2e-test-player-unverified',
    email: process.env.VITE_TEST_UNVERIFIED_EMAIL || 'test.unverified@futeba.test',
    password: process.env.VITE_TEST_UNVERIFIED_PASSWORD || 'Test123!@#',
    displayName: 'Jogador Não Verificado E2E',
    nickname: 'Unverified E2E',
    preferredPosition: 'ATACANTE',
    role: 'PLAYER',
    verified: false,
  },
];

// ==========================================
// INICIALIZAÇÃO ADMIN SDK
// ==========================================

function initAdmin(): void {
  // Guarda obrigatória: nunca escrever em produção por engano
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error(
      '[seed-e2e-users] FIREBASE_AUTH_EMULATOR_HOST não está definido.\n' +
      'Defina a variável antes de rodar o seed para garantir que os\n' +
      'usuários sejam criados no emulador, não em produção.\n' +
      'Exemplo: FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run seed:e2e'
    );
  }

  // Verificar se o Admin SDK já foi inicializado (evitar double-init
  // quando importado como módulo no globalSetup do Playwright)
  if (admin.apps.length === 0) {
    // SEM credencial: com FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST
    // definidos o Admin SDK usa os emuladores sem autenticação — é exatamente
    // assim que o test-harness-ci passa no runner. Qualquer credential mock
    // (getAccessToken etc.) força o caminho de credenciais do google-auth-
    // library e quebra a inicialização do Firestore (firestore/invalid-credential).
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'futebadosparcas',
    });
  }
}

// ==========================================
// SEED DE USUÁRIO INDIVIDUAL
// ==========================================

/**
 * Cria ou atualiza um usuário no emulador e define seus Custom Claims.
 * Idempotente: se o usuário já existir (por UID ou email), apenas
 * atualiza os claims e o documento Firestore.
 */
async function upsertTestUser(user: TestUser): Promise<void> {
  const authAdmin = admin.auth();
  const db = admin.firestore();

  let userRecord: admin.auth.UserRecord;

  try {
    // Tenta criar o usuário com UID fixo para garantir determinismo
    userRecord = await authAdmin.createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
    });
    console.log(`[seed] Criado usuário ${user.role}: ${user.email} (uid: ${userRecord.uid})`);
  } catch (err: unknown) {
    // Usuário já existe — apenas busca o registro existente
    const firebaseErr = err as { code?: string };
    if (
      firebaseErr.code === 'auth/email-already-exists' ||
      firebaseErr.code === 'auth/uid-already-exists'
    ) {
      userRecord = await authAdmin.getUser(user.uid).catch(async () => {
        // UID pode não existir mas email sim (seed anterior usou UID diferente)
        const existing = await authAdmin.getUserByEmail(user.email);
        return existing;
      });
      console.log(`[seed] Usuário ${user.role} já existe: ${user.email} (uid: ${userRecord.uid})`);
    } else {
      throw err;
    }
  }

  // Sempre (re)define Custom Claims para garantir idempotência.
  // E2E visual/acesso precisa de usuários já prontos para passar pelos gates.
  await authAdmin.setCustomUserClaims(userRecord.uid, {
    role: user.role,
    verified: user.verified ?? true,
    profileComplete: true,
  });
  console.log(`[seed] Custom Claims definidos: uid=${userRecord.uid} role=${user.role}`);

  // Cria/atualiza documento Firestore users/{uid}
  // Necessário porque o trigger onNewUserCreated pode não disparar no emulador
  await db.collection('users').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: user.email,
      name: user.displayName,
      nickname: user.nickname,
      phone: '+5511999999999',
      phone_number: '+5511999999999',
      cpf_verified: user.verified ?? true,
      verified: user.verified ?? true,
      profile_complete: true,
      preferred_position: user.preferredPosition,
      preferred_field_types: ['SOCIETY'],
      favorite_team: 'Futeba dos Parças',
      is_searchable: true,
      role: user.role,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true } // merge=true para não sobrescrever campos extras em re-runs
  );
  console.log(`[seed] Documento Firestore users/${userRecord.uid} sincronizado`);
}

/**
 * #4190: em emulador novo o trigger `onNewUserCreated` (Functions) dispara DEPOIS
 * de createUser e sobrescreve os custom claims semeados (perde `profileComplete`),
 * o que abria o ProfileGate ("Complete seu Perfil") por cima das telas e quebrava
 * os testes de PLAYER. Aguarda os claims estabilizarem e reaplica se divergirem.
 */
async function settleClaims(): Promise<void> {
  const authAdmin = admin.auth();
  let stableRounds = 0;
  for (let attempt = 0; attempt < 12 && stableRounds < 2; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    let drifted = false;
    for (const user of TEST_USERS) {
      const record = await authAdmin.getUser(user.uid);
      const claims = record.customClaims ?? {};
      if (claims.profileComplete !== true || claims.role !== user.role) {
        drifted = true;
        await authAdmin.setCustomUserClaims(user.uid, {
          role: user.role,
          verified: user.verified ?? true,
          profileComplete: true,
        });
        console.log(`[seed] Claims de ${user.role} reaplicados (trigger sobrescreveu)`);
      }
    }
    stableRounds = drifted ? 0 : stableRounds + 1;
  }
}

// ==========================================
// FUNÇÃO PRINCIPAL EXPORTADA
// Usada pelo globalSetup do Playwright e
// também executável via CLI.
// ==========================================

export async function seedE2EUsers(): Promise<void> {
  initAdmin();

  console.log('[seed-e2e-users] Iniciando seed de usuários E2E no emulador...');

  for (const user of TEST_USERS) {
    await upsertTestUser(user);
  }

  await settleClaims();

  console.log(`[seed-e2e-users] Seed concluído com sucesso. ${TEST_USERS.length} usuários prontos para E2E.`);
}

// ==========================================
// EXECUÇÃO VIA CLI
// ==========================================

// Permite tanto `npx tsx seed-e2e-users.ts` quanto import como módulo
const isMain =
  process.argv[1] !== undefined &&
  process.argv[1].endsWith('seed-e2e-users.ts');

if (isMain) {
  seedE2EUsers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed-e2e-users] Erro fatal:', err);
      process.exit(1);
    });
}
