const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'futebadosparcas'
});

const db = admin.firestore();

async function test() {
    console.log("Testing connection...");
    try {
        const snap = await db.collection('locations').limit(1).get();
        console.log(`Connection successful. Found ${snap.size} docs.`);
        snap.forEach(d => console.log(d.id, d.data().name));
    } catch (e) {
        console.error("Connection failed:", e);
    }
}

test();
