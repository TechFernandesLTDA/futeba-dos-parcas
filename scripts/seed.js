const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase
try {
    // Try to find a local service account key if the user happens to have one
    const serviceKeyPath = path.join(__dirname, '../serviceAccountKey.json');
    if (fs.existsSync(serviceKeyPath)) {
        const serviceAccount = require(serviceKeyPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Initialized with serviceAccountKey.json');
    } else {
        // Fallback to Application Default Credentials
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: 'futebadosparcas' // From google-services.json
        });
        console.log('Initialized with Application Default Credentials');
    }
} catch (e) {
    console.error('Initialization error:', e);
    process.exit(1);
}

const db = admin.firestore();

// 1. Read Kotlin File
const kotlinPath = path.join(__dirname, '../app/src/main/java/com/futebadosparcas/data/seeding/LocationsSeed.kt');
const content = fs.readFileSync(kotlinPath, 'utf8');

// 2. Parse Kotlin Data
const locations = [];
const blocks = content.split('LocationMigrationData(');

for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    const extract = (key) => {
        // Regex to find: key = "value" OR key = 123 OR key = listOf("a", "b")
        // Handling multiline for amenities
        const regex = new RegExp(`${key}\\s*=\\s*(".*?"|listOf\\(.*?\\)|\\d+)`, 's');
        const match = block.match(regex);
        if (!match) return null;

        let val = match[1];

        if (val.startsWith('"')) {
            // Clean quotes
            return val.substring(1, val.length - 1);
        }

        if (val.startsWith('listOf(')) {
            const listInner = val.substring(7, val.length - 1); // remove listOf( and )
            if (!listInner.trim()) return [];
            return listInner.split(',')
                .map(s => s.trim().replace(/^"|"$/g, '')) // remove quotes and whitespace
                .filter(s => s.length > 0);
        }

        return parseInt(val);
    };

    const nameKey = extract('nameKey');
    if (!nameKey) continue;

    locations.push({
        nameKey: nameKey,
        cep: extract('cep'),
        street: extract('street'),
        number: extract('number'),
        complement: extract('complement') || "",
        neighborhood: extract('neighborhood'),
        city: extract('city'),
        state: extract('state'),
        region: extract('region') || "",
        country: extract('country') || "Brasil",
        phone: extract('phone'),
        whatsapp: extract('whatsapp'),
        instagram: extract('instagram'),
        description: extract('description'),
        amenities: extract('amenities') || [],
        openingTime: extract('openingTime'),
        closingTime: extract('closingTime'),
        modalities: extract('modalities') || [],
        numFieldsEstimation: extract('numFieldsEstimation') || 1
    });
}

console.log(`Parsed ${locations.length} locations from Kotlin seed file.`);

async function migrate() {
    let ownerId = 'SYSTEM_MIGRATION_BOT';
    try {
        const usersSnap = await db.collection('users').where('role', '==', 'ADMIN').limit(1).get();
        if (!usersSnap.empty) {
            ownerId = usersSnap.docs[0].id;
            console.log(`Using Admin Owner ID: ${ownerId}`);
        } else {
            console.log("No ADMIN user found. Using default placeholder ID.");
        }
    } catch (e) {
        console.warn("Could not fetch users (permissions?):", e.message);
    }

    const locationsColl = db.collection('locations');
    const fieldsColl = db.collection('fields');

    let count = 0;

    // Fetch all existing names to be robust
    const allLocationsSnap = await locationsColl.select('name', 'ownerId').get();
    const existingMap = new Map();
    allLocationsSnap.forEach(doc => {
        const name = doc.data().name || "";
        existingMap.set(name.toLowerCase().trim(), doc.id);
    });

    for (const loc of locations) {
        const normalizedName = loc.nameKey.trim().toLowerCase();
        let docRef;
        let isNew = false;

        if (existingMap.has(normalizedName)) {
            const id = existingMap.get(normalizedName);
            docRef = locationsColl.doc(id);
            // console.log(`Updating ${loc.nameKey} (ID: ${id})...`);
        } else {
            docRef = locationsColl.doc();
            isNew = true;
            // console.log(`Creating ${loc.nameKey} (New ID: ${docRef.id})...`);
        }

        const finalPhone = loc.whatsapp || loc.phone;
        const finalInsta = loc.instagram ? loc.instagram.replace(/.*\.com\//, '').replace(/\/$/, '').replace('@', '') : null;

        const address = `${loc.street}, ${loc.number}${loc.complement ? " - " + loc.complement : ""} - ${loc.neighborhood}, ${loc.city} - ${loc.state}`;

        const data = {
            name: loc.nameKey, // Maintain original casing from seed
            cep: loc.cep,
            street: loc.street,
            number: loc.number,
            complement: loc.complement,
            neighborhood: loc.neighborhood,
            city: loc.city,
            state: loc.state,
            region: loc.region,
            country: loc.country,
            address: address,
            phone: finalPhone || null,
            whatsapp: loc.whatsapp || null,
            instagram: finalInsta || null,
            description: loc.description || "",
            amenities: loc.amenities,
            openingTime: loc.openingTime || "08:00",
            closingTime: loc.closingTime || "23:00",
            minGameDurationMinutes: 60,
            isActive: true,
            isVerified: true
        };

        if (isNew) {
            data.ownerId = ownerId;
            data.createdAt = admin.firestore.FieldValue.serverTimestamp();
            await docRef.set(data);

            // Create Fields
            const mainType = loc.modalities.some(m => m.toLowerCase().includes('futsal')) ? 'FUTSAL' : 'SOCIETY';
            const numFields = loc.numFieldsEstimation;

            const batch = db.batch();
            for (let i = 1; i <= numFields; i++) {
                const fieldName = numFields > 1 ? `Quadra ${i}` : 'Quadra Principal';
                const fieldRef = fieldsColl.doc();
                batch.set(fieldRef, {
                    locationId: docRef.id,
                    name: fieldName,
                    type: mainType,
                    hourlyPrice: 100.0,
                    isActive: true,
                    isCovered: true,
                    managers: []
                });
            }
            await batch.commit();
        } else {
            await docRef.update(data);
        }
        process.stdout.write('.');
        count++;
    }
    console.log(`\nMigration complete. Processed ${count} locations.`);
}

migrate().catch(e => {
    console.error("Migration failed:", e);
    process.exit(1);
});
