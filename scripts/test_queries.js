/**
 * Script para testar queries críticas do Firestore
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase with service account
if (admin.apps.length === 0) {
    const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

const TEST_USER_ID = 'FOlvyYHcZWPNqTGHkbSytMUwIAz1'; // renankakinho69@gmail.com

async function testQueries() {
    console.log('='.repeat(60));
    console.log('TESTE DE QUERIES - Futeba dos Parcas');
    console.log('='.repeat(60));
    console.log('');

    const tests = [
        {
            name: 'User Badges (unlocked_at DESC)',
            query: () => db.collection('user_badges')
                .where('user_id', '==', TEST_USER_ID)
                .orderBy('unlocked_at', 'desc')
                .limit(10)
                .get()
        },
        {
            name: 'User Profile',
            query: () => db.collection('users')
                .doc(TEST_USER_ID)
                .get()
        },
        {
            name: 'User Statistics',
            query: () => db.collection('statistics')
                .where('player_id', '==', TEST_USER_ID)
                .limit(10)
                .get()
        },
        {
            name: 'Active Seasons',
            query: () => db.collection('seasons')
                .where('is_active', '==', true)
                .limit(5)
                .get()
        },
        {
            name: 'Season Participation (League)',
            query: async () => {
                const seasons = await db.collection('seasons')
                    .where('is_active', '==', true)
                    .limit(1)
                    .get();
                if (seasons.empty) return { empty: true, docs: [] };
                const seasonId = seasons.docs[0].id;
                return db.collection('season_participation')
                    .where('season_id', '==', seasonId)
                    .orderBy('league_rating', 'desc')
                    .limit(10)
                    .get();
            }
        },
        {
            name: 'User Notifications',
            query: () => db.collection('notifications')
                .where('user_id', '==', TEST_USER_ID)
                .orderBy('created_at', 'desc')
                .limit(10)
                .get()
        },
        {
            name: 'XP Logs',
            query: () => db.collection('xp_logs')
                .where('user_id', '==', TEST_USER_ID)
                .orderBy('created_at', 'desc')
                .limit(10)
                .get()
        },
        {
            name: 'Active Locations',
            query: () => db.collection('locations')
                .where('is_active', '==', true)
                .limit(20)
                .get()
        },
        {
            name: 'Upcoming Games (Public)',
            query: () => db.collection('games')
                .where('visibility', '==', 'PUBLIC')
                .where('status', '==', 'SCHEDULED')
                .orderBy('dateTime', 'asc')
                .limit(10)
                .get()
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            const result = await test.query();
            const count = result.docs ? result.docs.length : (result.exists ? 1 : 0);
            console.log(`✅ ${test.name}: ${count} documento(s)`);
            passed++;
        } catch (error) {
            console.log(`❌ ${test.name}: ${error.message}`);
            failed++;
        }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log(`RESULTADO: ${passed} passou, ${failed} falhou`);
    console.log('='.repeat(60));
}

testQueries()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Erro fatal:', err);
        process.exit(1);
    });
