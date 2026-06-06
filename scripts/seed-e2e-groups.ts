/**
 * Seed de grupos E2E no emulador Firestore.
 *
 * Cria grupos de teste com membros e convites pendentes para
 * validação E2E dos fluxos: discover, preview público, invite-join.
 *
 * Depende de seed-e2e-users.ts ter sido executado primeiro.
 * Idempotente — pode ser reexecutado.
 *
 * Uso:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 \
 *   npx tsx scripts/seed-e2e-groups.ts
 */

import * as admin from 'firebase-admin';

// ==========================================
// CONSTANTES
// ==========================================

const TEST_UIDS = {
  player: 'e2e-test-player',
  fieldOwner: 'e2e-test-field-owner',
  admin: 'e2e-test-admin',
};

interface GroupSeed {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  adminUid: string;
  memberUids: string[];
  pendingInvites: Array<{ uid: string; invitedBy: string }>;
  deleted?: boolean;
}

const TEST_GROUPS: GroupSeed[] = [
  {
    id: 'e2e-group-galaticos',
    name: 'Galáticos FC',
    description: 'Grupo público para testes E2E de discover e preview.',
    isPublic: true,
    adminUid: TEST_UIDS.fieldOwner,
    memberUids: [TEST_UIDS.fieldOwner, TEST_UIDS.player],
    pendingInvites: [],
  },
  {
    id: 'e2e-group-secreto',
    name: 'Clube Secreto',
    description: 'Grupo privado para testes E2E de invite-join.',
    isPublic: false,
    adminUid: TEST_UIDS.admin,
    memberUids: [TEST_UIDS.admin, TEST_UIDS.fieldOwner],
    pendingInvites: [],
  },
  {
    id: 'e2e-group-vazio',
    name: 'Time Vazio',
    description: 'Grupo público sem membros extra — preview de grupo vazio.',
    isPublic: true,
    adminUid: TEST_UIDS.admin,
    memberUids: [TEST_UIDS.admin],
    pendingInvites: [],
  },
  {
    id: 'e2e-group-banidos',
    name: 'FC Banidos',
    description: 'Grupo público soft-deleted — NÃO deve aparecer no discover.',
    isPublic: true,
    adminUid: TEST_UIDS.admin,
    memberUids: [],
    pendingInvites: [],
    deleted: true,
  },
];

// ==========================================
// INICIALIZAÇÃO
// ==========================================

function initAdmin(): void {
  const authEmu = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!authEmu) {
    throw new Error(
      '[seed-e2e-groups] FIREBASE_AUTH_EMULATOR_HOST não definido.'
    );
  }
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'futebadosparcas',
    });
  }
}

// ==========================================
// HELPERS
// ==========================================

async function upsertDoc(
  collection: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  await admin
    .firestore()
    .collection(collection)
    .doc(docId)
    .set(data, { merge: true });
}

async function upsertSubDoc(
  parentPath: string,
  subCollection: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  await admin
    .firestore()
    .doc(parentPath)
    .collection(subCollection)
    .doc(docId)
    .set(data, { merge: true });
}

// ==========================================
// SEED DE GRUPO INDIVIDUAL
// ==========================================

async function upsertGroup(group: GroupSeed): Promise<void> {
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const groupData: Record<string, unknown> = {
    name: group.name,
    description: group.description,
    is_public: group.isPublic,
    owner_id: group.adminUid,
    admin_ids: [group.adminUid],
    member_count: group.memberUids.length,
    created_at: now,
    updated_at: now,
    status: 'ACTIVE',
  };

  if (group.deleted) {
    groupData.status = 'SUSPENDED';
    groupData.deleted_at = now;
  }

  await upsertDoc('groups', group.id, groupData);

  console.log(`[seed-groups] Grupo ${group.id} ("${group.name}") criado` +
    (group.deleted ? ' [SOFT-DELETED]' : ''));

  for (const uid of group.memberUids) {
    const role = uid === group.adminUid ? 'OWNER' : (uid === TEST_UIDS.fieldOwner && group.id === 'e2e-group-secreto' ? 'ADMIN' : 'MEMBER');
    await upsertSubDoc(`groups/${group.id}`, 'members', uid, {
      user_id: uid,
      user_name: getTestUserName(uid),
      role,
      status: 'ACTIVE',
      joined_at: now,
    });
  }
  console.log(
    `[seed-groups]   ${group.memberUids.length} membros: ${group.memberUids.join(', ')}`
  );

  // Convites pendentes na coleção canônica `invites/`
  for (const invite of group.pendingInvites) {
    const inviteCode = `E2E-${group.id}-${invite.uid}`.replace(/[^A-Z0-9]/g, '').substring(0, 6);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    await upsertDoc('invites', inviteCode, {
      code: inviteCode,
      group_id: group.id,
      group_name: group.name,
      inviter_id: invite.invitedBy,
      inviter_name: getTestUserName(invite.invitedBy),
      created_at: now,
      expires_at: admin.firestore.Timestamp.fromDate(futureDate),
      used: false,
    });
    console.log(
      `[seed-groups]   Convite canônico invites/${inviteCode}: ${invite.uid} → ${group.id}`
    );
  }
}

function getTestUserName(uid: string): string {
  switch (uid) {
    case TEST_UIDS.player:
      return 'Jogador Teste';
    case TEST_UIDS.fieldOwner:
      return 'Dono do Campo';
    case TEST_UIDS.admin:
      return 'Admin Teste';
    default:
      return 'Usuário Teste';
  }
}

// ==========================================
// SEED DE CONVITE EXPIRADO (PARA TESTE NEGATIVO)
// ==========================================

async function seedExpiredInvite(): Promise<void> {
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 7);

  await upsertDoc('invites', 'E2EEXP', {
    code: 'E2EEXP',
    group_id: 'e2e-group-secreto',
    group_name: 'Clube Secreto',
    inviter_id: TEST_UIDS.fieldOwner,
    inviter_name: getTestUserName(TEST_UIDS.fieldOwner),
    created_at: now,
    expires_at: admin.firestore.Timestamp.fromDate(pastDate),
    used: false,
  });

  console.log('[seed-groups] Convite expirado invites/E2EEXP criado');
}

// ==========================================
// FUNÇÃO PRINCIPAL
// ==========================================

export async function seedE2EGroups(): Promise<void> {
  initAdmin();

  console.log('[seed-e2e-groups] Iniciando seed de grupos E2E...');

  for (const group of TEST_GROUPS) {
    await upsertGroup(group);
  }

  await seedExpiredInvite();

  console.log(
    `[seed-e2e-groups] Concluído. ${TEST_GROUPS.length} grupos prontos.`
  );
}

// ==========================================
// EXECUÇÃO VIA CLI
// ==========================================

const isMain =
  process.argv[1] !== undefined &&
  process.argv[1].endsWith('seed-e2e-groups.ts');

if (isMain) {
  seedE2EGroups()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed-e2e-groups] Erro fatal:', err);
      process.exit(1);
    });
}
