import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

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
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: readFileSync('storage.rules', 'utf8'),
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function authedStorage(uid, role = 'PLAYER') {
  return testEnv.authenticatedContext(uid, { role }).storage(`gs://${projectId}.appspot.com`);
}

async function seedFirestore(seed) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seed(context.firestore());
  });
}

describe('Storage security rules', () => {
  test('permite admin ativo enviar comprovante do caixinha', async () => {
    await seedFirestore(async (db) => {
      await setDoc(doc(db, 'groups', 'private-group'), {
        owner_id: 'owner-uid',
        is_public: false,
        name: 'Grupo Privado',
        status: 'ACTIVE',
      });
      await setDoc(doc(db, 'groups', 'private-group', 'members', 'active-admin'), {
        user_id: 'active-admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
    });

    const firestore = testEnv.authenticatedContext('active-admin').firestore();
    await assertSucceeds(getDoc(doc(firestore, 'groups', 'private-group', 'members', 'active-admin')));

    const storage = authedStorage('active-admin');
    const receiptRef = ref(storage, 'groups/private-group/receipts/proof.jpg');

    await assertSucceeds(uploadBytes(receiptRef, new Blob(['real receipt'], { type: 'image/jpeg' }), {
      contentType: 'image/jpeg',
    }));
  });

  test('bloqueia admin removido de enviar comprovante do caixinha', async () => {
    await seedFirestore(async (db) => {
      await setDoc(doc(db, 'groups', 'private-group'), {
        owner_id: 'owner-uid',
        is_public: false,
        name: 'Grupo Privado',
        status: 'ACTIVE',
      });
      await setDoc(doc(db, 'groups', 'private-group', 'members', 'removed-admin'), {
        user_id: 'removed-admin',
        role: 'ADMIN',
        status: 'REMOVED',
      });
    });

    const storage = authedStorage('removed-admin');
    const receiptRef = ref(storage, 'groups/private-group/receipts/proof.jpg');

    await assertFails(uploadBytes(receiptRef, new Blob(['fake receipt'], { type: 'image/jpeg' }), {
      contentType: 'image/jpeg',
    }));
  });
});
