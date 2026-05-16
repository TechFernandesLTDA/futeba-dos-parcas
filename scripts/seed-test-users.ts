/**
 * Seed de 4 usuários de teste para validação completa de navegação.
 *
 * Cria:
 *   - 1 ADMIN (test.admin@futeba.test)
 *   - 1 FIELD_OWNER (test.fieldowner@futeba.test)
 *   - 1 PLAYER dono de grupo (test.player.owner@futeba.test)
 *   - 1 PLAYER membro de grupo (test.player.member@futeba.test)
 *   - 1 grupo "Galáticos FC" com owner + member
 *
 * Todos os usuários têm verified=true para pular onboarding.
 *
 * Uso:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx tsx scripts/seed-test-users.ts
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
  role: UserRole;
  phoneNumber: string;
}

interface TestUserCreationResult {
  uid: string;
  role: UserRole;
}

const DB_PASSWORD = 'Test123!@#';

// Cada usuário precisa de um phone único no Firebase Auth
const TEST_USERS: TestUser[] = [
  {
    uid: 'test-admin',
    email: 'test.admin@futeba.test',
    password: DB_PASSWORD,
    displayName: 'Admin Teste',
    nickname: 'Adminzão',
    role: 'ADMIN',
    phoneNumber: '+5511999999001',
  },
  {
    uid: 'test-field-owner',
    email: 'test.fieldowner@futeba.test',
    password: DB_PASSWORD,
    displayName: 'Dono da Quadra',
    nickname: 'Quadrinha',
    role: 'FIELD_OWNER',
    phoneNumber: '+5511999999002',
  },
  {
    uid: 'test-player-owner',
    email: 'test.player.owner@futeba.test',
    password: DB_PASSWORD,
    displayName: 'Zé do Grupo',
    nickname: 'Zézão',
    role: 'PLAYER',
    phoneNumber: '+5511999999003',
  },
  {
    uid: 'test-player-member',
    email: 'test.player.member@futeba.test',
    password: DB_PASSWORD,
    displayName: 'João Membro',
    nickname: 'Jotinha',
    role: 'PLAYER',
    phoneNumber: '+5511999999004',
  },
];

// ==========================================
// INICIALIZAÇÃO ADMIN SDK
// ==========================================

function initAdmin(): void {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      '[seed-test-users] FIREBASE_AUTH_EMULATOR_HOST não está definido.\n' +
      'Defina: FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099'
    );
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'futebadosparcas',
    });
  }
}

// ==========================================
// SEED DE USUÁRIO INDIVIDUAL
// ==========================================

async function upsertTestUser(user: TestUser): Promise<TestUserCreationResult> {
  const authAdmin = admin.auth();
  const db = admin.firestore();

  let userRecord: admin.auth.UserRecord;

  try {
    userRecord = await authAdmin.createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      emailVerified: true,
    });
    console.log(`[seed] ✅ Criado ${user.role}: ${user.email} (uid: ${userRecord.uid})`);
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string };
    if (
      firebaseErr.code === 'auth/email-already-exists' ||
      firebaseErr.code === 'auth/uid-already-exists'
    ) {
      userRecord = await authAdmin.getUser(user.uid).catch(async () => {
        const existing = await authAdmin.getUserByEmail(user.email);
        return existing;
      });
      console.log(`[seed] ⚠️  ${user.role} já existe: ${user.email} (uid: ${userRecord.uid})`);
    } else {
      throw err;
    }
  }

  // Custom Claims: role + verified
  await authAdmin.setCustomUserClaims(userRecord.uid, {
    role: user.role,
    verified: true,
  });
  console.log(`[seed]   📋 Custom Claims: role=${user.role}, verified=true`);

  // Firestore users/{uid} — documento público
  await db.collection('users').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: user.email,
      name: user.displayName,
      nickname: user.nickname,
      role: user.role,
      level: 5,
      experiencePoints: 1000,
      strikerRating: 7.0,
      midRating: 7.0,
      defenderRating: 7.0,
      gkRating: 5.0,
      preferredPosition: 'MEIA',
      preferredFieldTypes: ['SOCIETY', 'FUTSAL'],
      favoriteTeam: 'Flamengo',
      totalGames: 10,
      totalGoals: 5,
      totalAssists: 3,
      totalWins: 4,
      totalDraws: 3,
      totalLosses: 3,
      totalSaves: 0,
      mvpCount: 1,
      yellowCards: 1,
      redCards: 0,
      isSearchable: true,
      isVerified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      currentStreak: 2,
      bestStreak: 4,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`[seed]   📄 Documento users/${userRecord.uid} criado`);

  // users_private/{uid} — PII
  await db.collection('users_private').doc(userRecord.uid).set(
    {
      email: user.email,
      phone: user.phoneNumber,
      phoneVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      cpfVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`[seed]   🔒 Documento users_private/${userRecord.uid} criado`);

  return { uid: userRecord.uid, role: user.role };
}

// ==========================================
// CRIAÇÃO DE GRUPO + MEMBROS
// ==========================================

async function createTestGroup(ownerUid: string, memberUid: string): Promise<string> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  const groupDoc = await db.collection('groups').add({
    name: 'Galáticos FC',
    description: 'Grupo de teste para validação de navegação',
    type: 'PUBLIC',
    isPublic: true,
    ownerId: ownerUid,
    ownerName: 'Zé do Grupo',
    members: [
      {
        userId: ownerUid,
        userName: 'Zé do Grupo',
        role: 'OWNER',
        joinedAt: now,
        totalGames: 10,
        level: 5,
      },
      {
        userId: memberUid,
        userName: 'João Membro',
        role: 'MEMBER',
        joinedAt: now,
        totalGames: 5,
        level: 3,
      },
    ],
    memberCount: 2,
    defaultFieldType: 'SOCIETY',
    defaultMaxPlayers: 10,
    defaultPrice: 20,
    totalGamesPlayed: 5,
    inviteCode: 'GALATICOS',
    totalBalance: 150,
    createdAt: serverNow,
    updatedAt: serverNow,
  });

  console.log(`[seed] 🏠 Grupo "Galáticos FC" criado (id: ${groupDoc.id})`);

  // Subcoleção de membros do grupo para cada usuário
  await db
    .collection('users')
    .doc(ownerUid)
    .collection('groups')
    .doc(groupDoc.id)
    .set({
      groupId: groupDoc.id,
      groupName: 'Galáticos FC',
      role: 'OWNER',
      joinedAt: now,
    });
  console.log(`[seed]   👤 Owner adicionado ao grupo`);

  await db
    .collection('users')
    .doc(memberUid)
    .collection('groups')
    .doc(groupDoc.id)
    .set({
      groupId: groupDoc.id,
      groupName: 'Galáticos FC',
      role: 'MEMBER',
      joinedAt: now,
    });
  console.log(`[seed]   👤 Member adicionado ao grupo`);

  return groupDoc.id;
}

// ==========================================
// FUNÇÃO PRINCIPAL
// ==========================================

async function seedAll(): Promise<void> {
  initAdmin();
  console.log('[seed-test-users] 🚀 Iniciando seed de 4 usuários + 1 grupo...\n');

  const results: TestUserCreationResult[] = [];
  for (const user of TEST_USERS) {
    const result = await upsertTestUser(user);
    results.push(result);
  }

  console.log('');
  const ownerUid = results[2].uid; // test-player-owner
  const memberUid = results[3].uid; // test-player-member
  await createTestGroup(ownerUid, memberUid);

  console.log('\n[seed-test-users] ✅ Seed concluído!\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  USUÁRIOS CRIADOS (senha: Test123!@#)');
  console.log('═══════════════════════════════════════════════════════');
  for (const user of TEST_USERS) {
    console.log(`  ${user.role.padEnd(13)} | ${user.email} | ${user.displayName}`);
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log('  GRUPO: Galáticos FC (código: GALATICOS)');
  console.log('  Owner: test.player.owner@futeba.test (Zé do Grupo)');
  console.log('  Member: test.player.member@futeba.test (João Membro)');
  console.log('═══════════════════════════════════════════════════════');
}

seedAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-test-users] ❌ Erro fatal:', err);
    process.exit(1);
  });
