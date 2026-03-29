const admin = require('firebase-admin');
const fs = require('fs');

// Configuração inicial
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

// DADOS DE CARGA (30 Locais)
const locationsData = [
    {
        name: "JB Esportes & Eventos",
        address: "Rua João Bettega, 3173 – Portão – Curitiba/PR",
        phone: "(41) 99290-2962",
        description: "Complexo esportivo. Futsal e Society. Vestiários completos, estacionamento, bar/lanchonete, iluminação profissional. Um dos maiores e mais tradicionais da cidade.",
        fields: { futsal: 4, society: 4 }
    },
    {
        name: "Brasil Soccer",
        address: "Rua João Bettega, 1250 – Portão – Curitiba/PR",
        phone: "(41) 98403-9747",
        description: "Centro de futebol society. Restaurante, churrasqueiras, estacionamento amplo, vestiários. Muito usado para eventos e pós-jogo.",
        fields: { society: 5 }
    },
    {
        name: "Top Sports Centro Esportivo",
        address: "Rua João Bettega, 2709 – Portão – Curitiba/PR",
        phone: "(41) 3346-1117",
        description: "Centro esportivo. Vestiários, iluminação, espaço de convivência. Local clássico na João Bettega.",
        fields: { society: 6 }
    },
    {
        name: "Club Ball – Locação de Quadras",
        address: "Bairro Rebouças – Curitiba/PR",
        phone: "WhatsApp local",
        description: "Quadras esportivas. Society e Futsal. Básica, iluminação e vestiários simples.",
        fields: { society: 2, futsal: 1 } // "2 a 3 quadras"
    },
    {
        name: "Meia Alta Society",
        address: "Rua Nossa Senhora da Cabeça, 1845 – CIC – Curitiba/PR",
        phone: "(41) 98522-9744",
        description: "Futebol society. Iluminação, área externa. Jogos noturnos e mensalistas.",
        fields: { society: 3 }
    },
    {
        name: "Premium Esportes e Eventos",
        address: "Rua Renato Polatti, 2535 – Campo Comprido – Curitiba/PR",
        phone: "(41) 98754-8314",
        description: "Centro esportivo. Vestiários, estacionamento, iluminação.",
        fields: { society: 4 }
    },
    {
        name: "Arena Campo Comprido",
        address: "Bairro Campo Comprido – Curitiba/PR",
        phone: "WhatsApp",
        description: "Arena esportiva. Básica, iluminação.",
        fields: { society: 3 }
    },
    {
        name: "Fut Show CIC",
        address: "CIC – Curitiba/PR",
        phone: "WhatsApp",
        description: "Quadras esportivas. Vestiários simples.",
        fields: { futsal: 1, society: 1 }
    },
    {
        name: "Arena Amigos da Bola",
        address: "Rua Estados Unidos, 2851 – Boa Vista – Curitiba/PR",
        phone: "(41) 99272-6241",
        description: "Arena de lazer. Bar, churrasqueiras, vestiários, estacionamento.",
        fields: { society: 2 }
    },
    {
        name: "Eco Soccer",
        address: "Rua Nilo Peçanha, 2575 – Pilarzinho – Curitiba/PR",
        phone: "(41) 99671-8900",
        description: "Futebol society. Iluminação, vestiários.",
        fields: { society: 3 }
    },
    {
        name: "Arena do Bosque",
        address: "Santa Cândida – Curitiba/PR",
        phone: "WhatsApp",
        description: "Quadras esportivas. Básica.",
        fields: { society: 2 }
    },
    {
        name: "Gol de Placa Society",
        address: "Boa Vista – Curitiba/PR",
        phone: "WhatsApp",
        description: "Futebol society. Iluminação.",
        fields: { society: 2 }
    },
    {
        name: "Copacabana Sports",
        address: "Rua Antônio Simm, 809 – Capão da Imbuia – Curitiba/PR",
        phone: "(41) 98825-4162",
        description: "Centro esportivo. Vestiários, iluminação, espaço de convivência.",
        fields: { society: 3 }
    },
    {
        name: "Duga Sports",
        address: "Rua Dr. Joaquim Ignácio Silveira da Motta, 1211 – Uberaba – Curitiba/PR",
        phone: "(41) 3359-9577",
        description: "Arena esportiva. Bar, churrasqueira, estacionamento.",
        fields: { society: 2 }
    },
    {
        name: "Goleadores Futebol Society",
        address: "Av. Senador Salgado Filho, 1690 – Uberaba – Curitiba/PR",
        phone: "(41) 98422-6729",
        description: "Futebol society. Iluminação, área ampla.",
        fields: { society: 7 }
    },
    {
        name: "Arena Jardim das Américas",
        address: "Jardim das Américas – Curitiba/PR",
        phone: "WhatsApp",
        description: "Quadras esportivas. Básica.",
        fields: { society: 2 }
    },
    {
        name: "BR Sports",
        address: "BR-116, 15499 – Xaxim – Curitiba/PR",
        phone: "(41) 3275-1566",
        description: "Futebol society. Iluminação.",
        fields: { society: 2 }
    },
    {
        name: "Arena Xaxim",
        address: "Xaxim – Curitiba/PR",
        phone: "WhatsApp",
        description: "Arena esportiva.",
        fields: { society: 3 }
    },
    {
        name: "Baldan Sports Futsal",
        address: "Sítio Cercado – Curitiba/PR",
        phone: "WhatsApp",
        description: "Quadras de futsal. Piso tradicional, iluminação.",
        fields: { futsal: 2 }
    },
    {
        name: "Arena Boqueirão",
        address: "Boqueirão – Curitiba/PR",
        phone: "WhatsApp",
        description: "Futebol society.",
        fields: { society: 2 }
    },
    {
        name: "Quadra do Batel",
        address: "Batel – Curitiba/PR",
        phone: "WhatsApp",
        description: "Quadra urbana. Futsal.",
        fields: { futsal: 1 }
    },
    {
        name: "Arena Seminário",
        address: "Seminário – Curitiba/PR",
        phone: "",
        description: "Quadras esportivas.",
        fields: { society: 2 }
    },
    {
        name: "Arena 7 Society",
        address: "Bairro Alto – Curitiba/PR",
        phone: "",
        description: "Futebol society.",
        fields: { society: 2 }
    },
    {
        name: "Arena Alto da XV",
        address: "Alto da XV – Curitiba/PR",
        phone: "",
        description: "Quadras esportivas.",
        fields: { society: 2 }
    },
    {
        name: "Fut Park Curitiba",
        address: "Tarumã – Curitiba/PR",
        phone: "",
        description: "Parque esportivo. Society.",
        fields: { society: 2 }
    },
    {
        name: "Arena Tarumã",
        address: "Tarumã – Curitiba/PR",
        phone: "",
        description: "Arena esportiva. Society.",
        fields: { society: 2 }
    },
    {
        name: "Society Orleans",
        address: "Orleans – Curitiba/PR",
        phone: "",
        description: "Futebol society.",
        fields: { society: 2 }
    },
    {
        name: "Arena Santa Quitéria",
        address: "Santa Quitéria – Curitiba/PR",
        phone: "",
        description: "Quadras esportivas.",
        fields: { society: 2 }
    },
    {
        name: "Fut & Chopp Arena",
        address: "Hauer – Curitiba/PR",
        phone: "",
        description: "Arena recreativa. Foco em confraternização.",
        fields: { society: 2 }
    },
    {
        name: "Arena do Povo",
        address: "Tatuquara – Curitiba/PR",
        phone: "",
        description: "Futebol society.",
        fields: { society: 1 }
    }
];

async function updateLocations() {
    console.log("=== INICIANDO ATUALIZAÇÃO DE LOCAIS E QUADRAS ===");

    let updatedCount = 0;
    let createdCount = 0;

    for (const locData of locationsData) {
        try {
            // 1. Buscar Local por Nome
            const snapshot = await db.collection('locations')
                .where('name', '==', locData.name)
                .limit(1)
                .get();

            let locRef;
            let isNew = false;

            const city = locData.address.includes("Curitiba") ? "Curitiba" : "Curitiba";
            const state = locData.address.includes("PR") ? "PR" : "PR";

            const locationUpdateData = {
                name: locData.name,
                address: locData.address,
                phone: locData.phone,
                description: locData.description,
                city: city,
                state: state,
                is_active: true,
                is_verified: true,
                // Preservar dados existentes se não especificados
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            if (snapshot.empty) {
                // Criar novo
                console.log(`➕ Criando NOVO local: ${locData.name}`);
                locRef = db.collection('locations').doc();
                await locRef.set({
                    ...locationUpdateData,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    rating: 4.5,
                    rating_count: 5
                });
                createdCount++;
                isNew = true;
            } else {
                // Atualizar existente
                console.log(`🔄 Atualizando local: ${locData.name}`);
                locRef = snapshot.docs[0].ref;
                await locRef.update(locationUpdateData);
                updatedCount++;
            }

            // 2. Garantir Quadras (Fields)
            await ensureFields(locRef.id, locData.fields);

        } catch (error) {
            console.error(`❌ Erro processando ${locData.name}:`, error);
        }
    }

    console.log(`\n=== CONCLUÍDO ===`);
    console.log(`Locais Criados: ${createdCount}`);
    console.log(`Locais Atualizados: ${updatedCount}`);
}

async function ensureFields(locationId, requirements) {
    if (!requirements) return;

    // Buscar quadras existentes para este local
    const fieldsSnapshot = await db.collection('fields')
        .where('location_id', '==', locationId)
        .get();

    let existingFutsal = 0;
    let existingSociety = 0;

    fieldsSnapshot.forEach(doc => {
        const type = doc.data().type || "";
        if (type === "FUTSAL") existingFutsal++;
        if (type === "SOCIETY") existingSociety++;
    });

    const neededFutsal = (requirements.futsal || 0) - existingFutsal;
    const neededSociety = (requirements.society || 0) - existingSociety;

    if (neededFutsal > 0) {
        console.log(`   🛠️ Criando ${neededFutsal} quadras de Futsal...`);
        for (let i = 0; i < neededFutsal; i++) {
            await createField(locationId, "Quadra Futsal " + (existingFutsal + i + 1), "FUTSAL");
        }
    }

    if (neededSociety > 0) {
        console.log(`   🛠️ Criando ${neededSociety} quadras de Society...`);
        for (let i = 0; i < neededSociety; i++) {
            await createField(locationId, "Campo Society " + (existingSociety + i + 1), "SOCIETY");
        }
    }

    if (neededFutsal <= 0 && neededSociety <= 0) {
        console.log(`   ✅ Quadras já estão ok (${fieldsSnapshot.size} total).`);
    } else {
        console.log(`   ✅ Quadras atualizadas.`);
    }
}

async function createField(locationId, name, type) {
    const fieldRef = db.collection('fields').doc();
    const price = type === "FUTSAL" ? 120.0 : 180.0;

    await fieldRef.set({
        location_id: locationId,
        name: name,
        type: type,
        is_active: true,
        hourly_price: price,
        description: type === "FUTSAL" ? "Quadra coberta" : "Grama sintética",
        is_covered: type === "FUTSAL"
    });
}

updateLocations();
