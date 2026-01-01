const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase
try {
    const rootKeyPath = path.join(__dirname, '../futebadosparcas-firebase-adminsdk-fbsvc-afdd15710a.json');
    const serviceKeyPath = path.join(__dirname, '../serviceAccountKey.json');

    if (fs.existsSync(rootKeyPath)) {
        const serviceAccount = require(rootKeyPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Initialized with futebadosparcas-...json');
    } else if (fs.existsSync(serviceKeyPath)) {
        const serviceAccount = require(serviceKeyPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Initialized with serviceAccountKey.json');
    } else {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: 'futebadosparcas'
        });
        console.log('Initialized with Application Default Credentials');
    }
} catch (e) {
    console.error('Initialization error:', e);
    process.exit(1);
}

const db = admin.firestore();

async function deduplicate() {
    console.log("Fetching all locations...");
    const locationsColl = db.collection('locations');
    const snapshot = await locationsColl.get();

    if (snapshot.empty) {
        console.log("No locations found.");
        return;
    }

    const allLocations = [];
    snapshot.forEach(doc => {
        allLocations.push({ id: doc.id, ...doc.data() });
    });

    console.log(`Analyzing ${allLocations.length} locations...`);

    // Normalize helper
    const normalize = (str) => {
        return (str || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    };

    const grouped = new Map();

    for (const loc of allLocations) {
        const key = normalize(loc.name);
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(loc);
    }

    let deletedCount = 0;
    const batchSize = 100; // Firestore batch limit implies careful usage, but delete ops are independent here mostly, or we use bulk writer if available. Admin SDK has nice bulk delete tools, but manual is safer for logic.

    for (const [key, group] of grouped) {
        if (group.length > 1) {
            console.log(`Found duplicates for "${group[0].name}" (Key: ${key}) - Count: ${group.length}`);

            // Sort to find the best: Has CEP > Has Phone > ID (tiebreaker)
            group.sort((a, b) => {
                const aHasCep = !!(a.cep && a.cep.length > 0);
                const bHasCep = !!(b.cep && b.cep.length > 0);
                if (aHasCep !== bHasCep) return bHasCep ? 1 : -1;

                const aHasPhone = !!(a.phone || a.whatsapp);
                const bHasPhone = !!(b.phone || b.whatsapp);
                if (aHasPhone !== bHasPhone) return bHasPhone ? 1 : -1;

                return 0; // Keep the first found (or could use ID/createdAt)
            });

            // The one to keep is index 0 after sort (descending quality logic above needs check)
            // Wait, Sort: if bHasCep is true and aHasCep is false, return 1 (b should come before a? No, sort is usually ascending. If I want BEST first...)
            // sort((a,b) => b.score - a.score) -> Descending.
            // My logic: if bHasCep true (1) and aHasCep false (0) -> 1 - 0 = 1 (positive).
            // In sort(a, b), return > 0 means b comes before a? No. 
            // a - b:
            // return < 0 : a comes first (a < b)
            // return > 0 : b comes first (a > b)

            // Let's rewrite sort clearly descending quality
            group.sort((a, b) => {
                const scoreA = (a.cep ? 10 : 0) + ((a.phone || a.whatsapp) ? 5 : 0);
                const scoreB = (b.cep ? 10 : 0) + ((b.phone || b.whatsapp) ? 5 : 0);
                return scoreB - scoreA; // Descending score
            });

            const best = group[0];
            const toDelete = group.slice(1);

            console.log(`  Keeping: ${best.name} (${best.id}) - CEP: ${best.cep || 'N/A'}`);

            for (const dead of toDelete) {
                console.log(`  Deleting: ${dead.name} (${dead.id})`);

                // Delete fields first
                const fieldsSnap = await db.collection('fields').where('locationId', '==', dead.id).get();
                if (!fieldsSnap.empty) {
                    const batch = db.batch();
                    fieldsSnap.forEach(f => batch.delete(f.ref));
                    await batch.commit();
                    console.log(`    Deleted ${fieldsSnap.size} associated fields.`);
                }

                // Delete location
                await db.collection('locations').doc(dead.id).delete();
                deletedCount++;
            }
        }
    }

    console.log(`\nDeduplication complete. Deleted ${deletedCount} locations.`);
}

deduplicate().catch(console.error);
