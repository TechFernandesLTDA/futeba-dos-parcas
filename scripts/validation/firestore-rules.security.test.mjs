import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv;
const projectId = 'futebadosparcas';

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8085,
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function authedFirestore(uid, role = 'PLAYER') {
  return testEnv.authenticatedContext(uid, { role }).firestore();
}

async function seedFirestore(seed) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seed(context.firestore());
  });
}

async function seedPrivateGroup(db, groupId = 'private-group') {
  await setDoc(doc(db, 'groups', groupId), {
    owner_id: 'owner-uid',
    is_public: false,
    name: 'Grupo Privado',
    description: '',
    status: 'ACTIVE',
  });
  await setDoc(doc(db, 'groups', groupId, 'members', 'owner-uid'), {
    user_id: 'owner-uid',
    role: 'OWNER',
    status: 'ACTIVE',
  });
}

describe('Firestore security rules', () => {
  test('permite membro ativo ler lista de membros do grupo', async () => {
    await seedFirestore(async (db) => {
      await seedPrivateGroup(db);
      await setDoc(doc(db, 'groups', 'private-group', 'members', 'active-member'), {
        user_id: 'active-member',
        role: 'MEMBER',
        status: 'ACTIVE',
      });
    });

    const memberDb = authedFirestore('active-member');

    await assertSucceeds(getDoc(doc(memberDb, 'groups', 'private-group', 'members', 'owner-uid')));
  });

  test('bloqueia leitura da lista de membros para usuario fora do grupo', async () => {
    await seedFirestore((db) => seedPrivateGroup(db));

    const attackerDb = authedFirestore('attacker-uid');

    await assertFails(getDoc(doc(attackerDb, 'groups', 'private-group', 'members', 'owner-uid')));
  });

  test('bloqueia self-join direto em grupo privado', async () => {
    await seedFirestore((db) => seedPrivateGroup(db));

    const attackerDb = authedFirestore('attacker-uid');

    await assertFails(setDoc(doc(attackerDb, 'groups', 'private-group', 'members', 'attacker-uid'), {
      user_id: 'attacker-uid',
      role: 'MEMBER',
      status: 'ACTIVE',
    }));
  });

  test('permite self-join direto apenas em grupo publico ativo', async () => {
    await seedFirestore(async (db) => {
      await setDoc(doc(db, 'groups', 'public-group'), {
        owner_id: 'owner-uid',
        is_public: true,
        name: 'Grupo Publico',
        description: '',
        status: 'ACTIVE',
      });
    });

    const playerDb = authedFirestore('player-uid');

    await assertSucceeds(setDoc(doc(playerDb, 'groups', 'public-group', 'members', 'player-uid'), {
      user_id: 'player-uid',
      role: 'MEMBER',
      status: 'ACTIVE',
    }));
  });

  test('bloqueia admin removido de criar lancamento no caixinha', async () => {
    await seedFirestore(async (db) => {
      await seedPrivateGroup(db);
      await setDoc(doc(db, 'groups', 'private-group', 'members', 'removed-admin'), {
        user_id: 'removed-admin',
        role: 'ADMIN',
        status: 'REMOVED',
      });
    });

    const removedAdminDb = authedFirestore('removed-admin');

    await assertFails(setDoc(doc(removedAdminDb, 'groups', 'private-group', 'cashbox', 'entry-1'), {
      amount: 100,
      type: 'INCOME',
    }));
  });

  test('bloqueia criacao de live_game com owner_id forjado', async () => {
    await seedFirestore(async (db) => {
      await setDoc(doc(db, 'games', 'victim-game'), {
        owner_id: 'victim-owner',
        status: 'SCHEDULED',
      });
    });

    const attackerDb = authedFirestore('attacker-uid');

    await assertFails(setDoc(doc(attackerDb, 'live_games', 'victim-game'), {
      owner_id: 'attacker-uid',
      status: 'LIVE',
    }));
  });

  test('permite owner real criar live_game com owner_id correto', async () => {
    await seedFirestore(async (db) => {
      await setDoc(doc(db, 'games', 'owner-game'), {
        owner_id: 'owner-uid',
        status: 'SCHEDULED',
      });
    });

    const ownerDb = authedFirestore('owner-uid');

    await assertSucceeds(setDoc(doc(ownerDb, 'live_games', 'owner-game'), {
      owner_id: 'owner-uid',
      status: 'LIVE',
    }));
  });

  test('bloqueia criacao de live_score com owner_id forjado', async () => {
    await seedFirestore(async (db) => {
      await setDoc(doc(db, 'games', 'victim-game'), {
        owner_id: 'victim-owner',
        status: 'SCHEDULED',
      });
    });

    const attackerDb = authedFirestore('attacker-uid');

    await assertFails(setDoc(doc(attackerDb, 'live_scores', 'victim-game'), {
      owner_id: 'attacker-uid',
      team1_score: 0,
      team2_score: 0,
    }));
  });

  test('permite owner real criar live_score com owner_id correto', async () => {
    await seedFirestore(async (db) => {
      await setDoc(doc(db, 'games', 'owner-game'), {
        owner_id: 'owner-uid',
        status: 'SCHEDULED',
      });
    });

    const ownerDb = authedFirestore('owner-uid');

    await assertSucceeds(setDoc(doc(ownerDb, 'live_scores', 'owner-game'), {
      owner_id: 'owner-uid',
      team1_score: 0,
      team2_score: 0,
    }));
  });
});

assert.ok(true);
