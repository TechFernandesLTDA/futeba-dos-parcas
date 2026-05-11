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
    { id: 'atletico-mg',     name: 'Atletico-MG',     short_name: 'CAM', category: 'Serie A', state: 'MG', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Atletico_Mineiro_logo.svg' },
    { id: 'athletico-pr',    name: 'Athletico-PR',    short_name: 'CAP', category: 'Serie A', state: 'PR', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Athletico_Paranaense_logo.svg' },
    { id: 'bahia',           name: 'Bahia',           short_name: 'BAH', category: 'Serie A', state: 'BA', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Esporte_Clube_Bahia_logo.svg' },
    { id: 'botafogo',        name: 'Botafogo',        short_name: 'BOT', category: 'Serie A', state: 'RJ', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg' },
    { id: 'ceara',           name: 'Ceara',           short_name: 'CEA', category: 'Serie A', state: 'CE', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Ceara_Sporting_Club_logo.svg' },
    { id: 'corinthians',     name: 'Corinthians',     short_name: 'COR', category: 'Serie A', state: 'SP', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Escudo_do_Sport_Club_Corinthians_Paulista.svg' },
    { id: 'cruzeiro',        name: 'Cruzeiro',        short_name: 'CRU', category: 'Serie A', state: 'MG', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Cruzeiro_Esporte_Clube_logo.svg' },
    { id: 'flamengo',        name: 'Flamengo',        short_name: 'FLA', category: 'Serie A', state: 'RJ', badge_url: 'https://upload.wikimedia.org/wikipedia/en/2/2e/Clube_de_Regatas_do_Flamengo_logo.svg' },
    { id: 'fluminense',      name: 'Fluminense',      short_name: 'FLU', category: 'Serie A', state: 'RJ', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Fluminense_FC_logo.svg' },
    { id: 'fortaleza',       name: 'Fortaleza',       short_name: 'FOR', category: 'Serie A', state: 'CE', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Fortaleza_Esporte_Clube_logo.svg' },
    { id: 'gremio',          name: 'Gremio',          short_name: 'GRE', category: 'Serie A', state: 'RS', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Gremio_logo.svg' },
    { id: 'internacional',   name: 'Internacional',   short_name: 'INT', category: 'Serie A', state: 'RS', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/SC_Internacional_logo.svg' },
    { id: 'juventude',       name: 'Juventude',       short_name: 'JUV', category: 'Serie A', state: 'RS', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/9/9e/EC_Juventude_logo.svg' },
    { id: 'mirassol',        name: 'Mirassol',        short_name: 'MIR', category: 'Serie A', state: 'SP', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Mirassol_FC_logo.png' },
    { id: 'palmeiras',       name: 'Palmeiras',       short_name: 'PAL', category: 'Serie A', state: 'SP', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Palmeiras_logo.svg' },
    { id: 'santos',          name: 'Santos',          short_name: 'SAN', category: 'Serie A', state: 'SP', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/3/34/Santos_FC_logo.svg' },
    { id: 'sao-paulo',       name: 'Sao Paulo',       short_name: 'SPO', category: 'Serie A', state: 'SP', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Sao_Paulo_Futebol_Clube.png' },
    { id: 'sport',           name: 'Sport',           short_name: 'SPT', category: 'Serie A', state: 'PE', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Sport_Club_do_Recife_logo.svg' },
    { id: 'vasco',           name: 'Vasco',           short_name: 'VAS', category: 'Serie A', state: 'RJ', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/0/03/CR_Vasco_da_Gama_logo.svg' },
    { id: 'vitoria',         name: 'Vitoria',         short_name: 'VIT', category: 'Serie A', state: 'BA', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/6/67/EC_Vitoria_logo.svg' },
    // Serie B
    { id: 'america-mg',      name: 'America-MG',      short_name: 'AME', category: 'Serie B', state: 'MG', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/2/20/America_Futebol_Clube_MG_logo.svg' },
    { id: 'avai',            name: 'Avai',            short_name: 'AVA', category: 'Serie B', state: 'SC', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/2/2d/Avai_FC_logo.svg' },
    { id: 'coritiba',        name: 'Coritiba',        short_name: 'CTB', category: 'Serie B', state: 'PR', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Coritiba_FC_logo.svg' },
    { id: 'criciuma',        name: 'Criciuma',        short_name: 'CRI', category: 'Serie B', state: 'SC', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Criciuma_EC_logo.svg' },
    { id: 'cuiaba',          name: 'Cuiaba',          short_name: 'CUI', category: 'Serie B', state: 'MT', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Cuiaba_EC_logo.svg' },
    { id: 'goias',           name: 'Goias',           short_name: 'GOI', category: 'Serie B', state: 'GO', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Goias_EC_logo.svg' },
    { id: 'chapecoense',     name: 'Chapecoense',     short_name: 'CHA', category: 'Serie B', state: 'SC', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Chapecoense_logo.svg' },
    { id: 'nautico',         name: 'Nautico',         short_name: 'NAU', category: 'Serie B', state: 'PE', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Clube_Nautico_Capibaribe_logo.svg' },
    { id: 'operario-pr',     name: 'Operario-PR',     short_name: 'OPE', category: 'Serie B', state: 'PR', badge_url: 'https://upload.wikimedia.org/wikipedia/commons/8/80/Operario_Ferroviario_EC_logo.svg' },
    // Outros
    { id: 'nao-torcedor',    name: 'Nao torce para time nenhum', short_name: '-',  category: 'Outros', state: null, badge_url: null },
    { id: 'outro',           name: 'Outro time',       short_name: '?',  category: 'Outros', state: null, badge_url: null },
];

async function seed() {
    const coll = db.collection('favorite_teams');
    let count = 0;

    for (const team of teams) {
        const { id, ...data } = team;
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        );

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
    const withBadge = teams.filter(t => t.badge_url).length;
    console.log(`${withBadge}/${teams.length} times tem escudo (badge_url).`);
    console.log('Fontes: Wikipedia Commons (SVG/PNG).');
}

seed().catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
});
