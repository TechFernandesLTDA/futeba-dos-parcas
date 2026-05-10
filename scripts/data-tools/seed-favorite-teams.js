const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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

const teams = [
    // Serie A 2026
    { id: 'atletico-mg',     name: 'Atletico-MG',     short_name: 'CAM', category: 'Serie A', state: 'MG', badge_url: null },
    { id: 'athletico-pr',    name: 'Athletico-PR',    short_name: 'CAP', category: 'Serie A', state: 'PR', badge_url: null },
    { id: 'bahia',           name: 'Bahia',           short_name: 'BAH', category: 'Serie A', state: 'BA', badge_url: null },
    { id: 'botafogo',        name: 'Botafogo',        short_name: 'BOT', category: 'Serie A', state: 'RJ', badge_url: null },
    { id: 'ceara',           name: 'Ceara',           short_name: 'CEA', category: 'Serie A', state: 'CE', badge_url: null },
    { id: 'corinthians',     name: 'Corinthians',     short_name: 'COR', category: 'Serie A', state: 'SP', badge_url: null },
    { id: 'cruzeiro',        name: 'Cruzeiro',        short_name: 'CRU', category: 'Serie A', state: 'MG', badge_url: null },
    { id: 'flamengo',        name: 'Flamengo',        short_name: 'FLA', category: 'Serie A', state: 'RJ', badge_url: null },
    { id: 'fluminense',      name: 'Fluminense',      short_name: 'FLU', category: 'Serie A', state: 'RJ', badge_url: null },
    { id: 'fortaleza',       name: 'Fortaleza',       short_name: 'FOR', category: 'Serie A', state: 'CE', badge_url: null },
    { id: 'gremio',          name: 'Gremio',           short_name: 'GRE', category: 'Serie A', state: 'RS', badge_url: null },
    { id: 'internacional',   name: 'Internacional',   short_name: 'INT', category: 'Serie A', state: 'RS', badge_url: null },
    { id: 'juventude',       name: 'Juventude',       short_name: 'JUV', category: 'Serie A', state: 'RS', badge_url: null },
    { id: 'mirassol',        name: 'Mirassol',        short_name: 'MIR', category: 'Serie A', state: 'SP', badge_url: null },
    { id: 'palmeiras',       name: 'Palmeiras',       short_name: 'PAL', category: 'Serie A', state: 'SP', badge_url: null },
    { id: 'santos',          name: 'Santos',          short_name: 'SAN', category: 'Serie A', state: 'SP', badge_url: null },
    { id: 'sao-paulo',       name: 'Sao Paulo',       short_name: 'SPO', category: 'Serie A', state: 'SP', badge_url: null },
    { id: 'sport',           name: 'Sport',           short_name: 'SPT', category: 'Serie A', state: 'PE', badge_url: null },
    { id: 'vasco',           name: 'Vasco',           short_name: 'VAS', category: 'Serie A', state: 'RJ', badge_url: null },
    { id: 'vitoria',         name: 'Vitoria',         short_name: 'VIT', category: 'Serie A', state: 'BA', badge_url: null },
    // Serie B
    { id: 'america-mg',      name: 'America-MG',      short_name: 'AME', category: 'Serie B', state: 'MG', badge_url: null },
    { id: 'avai',            name: 'Avai',            short_name: 'AVA', category: 'Serie B', state: 'SC', badge_url: null },
    { id: 'coritiba',        name: 'Coritiba',        short_name: 'CTB', category: 'Serie B', state: 'PR', badge_url: null },
    { id: 'criciuma',        name: 'Criciuma',        short_name: 'CRI', category: 'Serie B', state: 'SC', badge_url: null },
    { id: 'cuiaba',          name: 'Cuiaba',          short_name: 'CUI', category: 'Serie B', state: 'MT', badge_url: null },
    { id: 'goias',           name: 'Goias',           short_name: 'GOI', category: 'Serie B', state: 'GO', badge_url: null },
    { id: 'chapecoense',     name: 'Chapecoense',     short_name: 'CHA', category: 'Serie B', state: 'SC', badge_url: null },
    { id: 'nautico',         name: 'Nautico',         short_name: 'NAU', category: 'Serie B', state: 'PE', badge_url: null },
    { id: 'operario-pr',     name: 'Operario-PR',     short_name: 'OPE', category: 'Serie B', state: 'PR', badge_url: null },
    // Outros
    { id: 'nao-torcedor',    name: 'Nao torce para time nenhum', short_name: '-',  category: 'Outros', state: null, badge_url: null },
    { id: 'outro',           name: 'Outro time',       short_name: '?',  category: 'Outros', state: null, badge_url: null },
];

async function seed() {
    const coll = db.collection('favorite_teams');
    let count = 0;

    for (const team of teams) {
        const { id, ...data } = team;
        // Remove undefined/null fields (badge_url null is intentional)
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        );

        // Set only if not exists (preserve manually uploaded badge_url)
        const docRef = coll.doc(id);
        try {
            await docRef.set(cleanData, { merge: true });
        } catch (err) {
            console.error(`Failed to seed ${id}:`, err.message);
            continue;
        }
        process.stdout.write('.');
        count++;
    }
    console.log(`\nSeed complete. Processed ${count} teams into favorite_teams collection.`);
    console.log('\nNOTA: badge_url estao como null para todos os times.');
    console.log('Faca upload dos escudos para Firebase Storage e atualize badge_url manualmente.');
}

seed().catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
});
