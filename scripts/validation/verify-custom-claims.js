#!/usr/bin/env node

/**
 * VERIFICATION SCRIPT: Custom Claims Verification
 *
 * Verifica se os Custom Claims foram setados corretamente para todos os usuários.
 *
 * USAGE:
 * ```bash
 * node scripts/verify-custom-claims.js
 * ```
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ ERROR: serviceAccountKey.json not found at:', serviceAccountPath);
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
});

const db = admin.firestore();
const auth = admin.auth();

async function verifyCustomClaims() {
    console.log('\n🔐 VERIFYING CUSTOM CLAIMS');
    console.log('='.repeat(70));

    try {
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs;

        console.log(`\n📋 Total Users in Firestore: ${users.length}\n`);

        let successCount = 0;
        let mismatchCount = 0;
        const mismatches = [];

        for (const doc of users) {
            const userData = doc.data();
            const uid = doc.id;
            const expectedRole = userData.role || 'PLAYER';

            try {
                const userRecord = await auth.getUser(uid);
                const customClaims = userRecord.customClaims || {};
                const actualRole = customClaims.role;

                const status = actualRole === expectedRole ? '✅' : '⚠️';
                console.log(`${status} User: ${uid}`);
                console.log(`   Firestore role: ${expectedRole}`);
                console.log(`   Custom Claims:  ${actualRole || 'NONE'}`);
                console.log(`   Email:          ${userRecord.email}`);
                console.log(`   Migrated:       ${userData.claims_migrated_at ? '✓' : '✗'}`);
                console.log();

                if (actualRole === expectedRole) {
                    successCount++;
                } else {
                    mismatchCount++;
                    mismatches.push({ uid, expected: expectedRole, actual: actualRole });
                }
            } catch (err) {
                console.error(`❌ ERROR fetching user ${uid}:`, err.message);
            }
        }

        console.log('='.repeat(70));
        console.log('📊 VERIFICATION SUMMARY');
        console.log('='.repeat(70));
        console.log(`  ✅ Correct:   ${successCount}/${users.length}`);
        console.log(`  ⚠️  Mismatch:  ${mismatchCount}/${users.length}`);

        if (mismatchCount > 0) {
            console.log('\n⚠️  MISMATCHES FOUND:');
            mismatches.forEach(m => {
                console.log(`  - ${m.uid}: expected ${m.expected}, got ${m.actual}`);
            });
        } else {
            console.log('\n✅ All users have correct Custom Claims!');
        }

        console.log('='.repeat(70) + '\n');

        return mismatchCount === 0;
    } catch (error) {
        console.error('❌ ERROR:', error);
        process.exit(1);
    }
}

async function checkMigrationLog() {
    console.log('📜 CHECKING MIGRATION LOGS');
    console.log('='.repeat(70));

    try {
        const logsSnapshot = await db
            .collection('migration_logs')
            .where('type', '==', 'CUSTOM_CLAIMS_MIGRATION')
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();

        if (logsSnapshot.empty) {
            console.log('  No migration logs found.\n');
            return;
        }

        logsSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`\nLog ${index + 1}:`);
            console.log(`  Timestamp: ${data.timestamp?.toDate()}`);
            console.log(`  Processed: ${data.stats?.processed}`);
            console.log(`  Skipped:   ${data.stats?.skipped}`);
            console.log(`  Errors:    ${data.stats?.errors}`);
            console.log(`  Duration:  ${Math.round(data.stats?.durationMs / 1000)}s`);
        });

        console.log('\n' + '='.repeat(70) + '\n');
    } catch (error) {
        console.error('❌ ERROR checking logs:', error);
    }
}

async function main() {
    try {
        await checkMigrationLog();
        const success = await verifyCustomClaims();
        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

main();
