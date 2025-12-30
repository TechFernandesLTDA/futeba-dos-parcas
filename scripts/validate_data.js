const admin = require('firebase-admin');
const fs = require('fs');

// Verifica se o arquivo de credencial existe
const serviceAccountPath = './futebadosparcas-firebase-adminsdk-fbsvc-b5fb25775d.json';

if (!fs.existsSync(serviceAccountPath)) {
    console.error("Arquivo de credenciais não encontrado: " + serviceAccountPath);
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkData() {
    console.log("=== INICIANDO VALIDAÇÃO DE DADOS ===");
    const targetLocation = 'JB Esportes & Eventos';

    // 1. Buscar a Location
    const locationsSnapshot = await db.collection('locations')
        .where('name', '==', targetLocation)
        .get();

    if (locationsSnapshot.empty) {
        console.log(`❌ ERRO: Local '${targetLocation}' NÃO encontrado no banco!`);
        return;
    }

    const location = locationsSnapshot.docs[0];
    const locationData = location.data();
    console.log(`✅ Local encontrado: ${locationData.name}`);
    console.log(`   ID: ${location.id}`);

    // 2. Buscar Fields
    const fieldsSnapshot = await db.collection('fields')
        .where('location_id', '==', location.id)
        .get();

    console.log(`\n📊 Total de quadras encontradas (Raw Query): ${fieldsSnapshot.size}`);

    if (fieldsSnapshot.size === 0) {
        console.log("❌ ERRO: Nenhuma quadra vinculada a este ID na COLEÇÃO RAIZ 'fields'.");

        // Tentar subcoleção
        console.log("🔍 Verificando SUBCOLEÇÃO 'locations/" + location.id + "/fields'...");
        const subCollectionSnapshot = await db.collection('locations').doc(location.id).collection('fields').get();

        console.log(`📊 Total na subcoleção: ${subCollectionSnapshot.size}`);

        if (subCollectionSnapshot.size === 0) {
            console.log("❌ ERRO: Nenhuma quadra encontrada.");
        }

    } else {
        console.log("✅ Quadras existem na raiz! Listando:");
        fieldsSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`   ${index + 1}. [${doc.id}] ${data.name}`);
        });
    }

    // 3. Amostragem Global
    console.log("\n🔍 Amostragem Global de Quadras (fields):");
    const globalSnapshot = await db.collection('fields').limit(5).get();
    if (globalSnapshot.empty) {
        console.log("❌ A coleção 'fields' está COMPLETAMENTE VAZIA.");
    } else {
        globalSnapshot.forEach(doc => {
            console.log(`   - [${doc.id}] ${doc.data().name} (LocID: ${doc.data().location_id})`);
        });
    }
}

checkData();
