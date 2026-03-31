const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccountPath = './futebadosparcas-firebase-adminsdk-fbsvc-b5fb25775d.json';
if (!fs.existsSync(serviceAccountPath)) {
    console.error("Arquivo de credenciais não encontrado.");
    process.exit(1);
}
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDuplicates() {
    console.log("=== INICIANDO VERIFICAÇÃO DE DUPLICIDADES ===");

    // 1. Verificar Locais Duplicados
    console.log("\n🔍 Verificando Locais Duplicados (por nome)...");
    const locationsSnapshot = await db.collection('locations').get();
    const nameMap = new Map();
    let duplicateLocationsCount = 0;

    locationsSnapshot.forEach(doc => {
        const data = doc.data();
        const name = data.name ? data.name.trim() : "SEM NOME";

        if (nameMap.has(name)) {
            nameMap.get(name).push(doc.id);
        } else {
            nameMap.set(name, [doc.id]);
        }
    });

    let foundLocDupes = false;
    nameMap.forEach((ids, name) => {
        if (ids.length > 1) {
            foundLocDupes = true;
            duplicateLocationsCount++;
            console.log(`⚠️  DUPLICIDADE LOCAL: '${name}' possui ${ids.length} registros:`);
            console.log(`    IDs: ${ids.join(', ')}`);
        }
    });

    if (!foundLocDupes) {
        console.log("✅ Nenhum local duplicado encontrado.");
    }

    // 2. Verificar Quadras Duplicadas (por nome dentro do mesmo local)
    console.log("\n🔍 Verificando Quadras Duplicadas (mesmo nome no mesmo local)...");
    const fieldsSnapshot = await db.collection('fields').get();
    const fieldsByLocation = new Map(); // Map<LocationId, Map<FieldName, [FieldId]>>
    let duplicateFieldsCount = 0;

    fieldsSnapshot.forEach(doc => {
        const data = doc.data();
        const locId = data.location_id;
        const name = data.name;

        if (!locId) return; // Ignora órfãos para análise de duplicidade válida

        if (!fieldsByLocation.has(locId)) {
            fieldsByLocation.set(locId, new Map());
        }

        const locFields = fieldsByLocation.get(locId);
        if (locFields.has(name)) {
            locFields.get(name).push(doc.id);
        } else {
            locFields.set(name, [doc.id]);
        }
    });

    let foundFieldDupes = false;

    // Iterar para achar duplicidades
    for (const [locId, fieldsMap] of fieldsByLocation) {
        let locName = "Desconhecido";
        // Tentar pegar nome do local do mapa anterior se possível
        // (Otimização: não fazer get extra)

        for (const [fieldName, ids] of fieldsMap) {
            if (ids.length > 1) {
                if (!foundFieldDupes) console.log("⚠️  DUPLICIDADES ENCONTRADAS:");
                foundFieldDupes = true;
                duplicateFieldsCount++;
                console.log(`   Local ID ${locId} -> Quadra '${fieldName}' tem ${ids.length} registros.`);
                console.log(`      IDs: ${ids.join(', ')}`);
            }
        }
    }

    if (!foundFieldDupes) {
        console.log("✅ Nenhuma quadra duplicada válida encontrada.");
    }

    console.log("\n=== RESUMO ===");
    console.log(`Locais Duplicados: ${duplicateLocationsCount}`);
    console.log(`Quadras Duplicadas: ${duplicateFieldsCount}`);
}

checkDuplicates();
