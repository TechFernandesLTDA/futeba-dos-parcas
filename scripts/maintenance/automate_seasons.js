const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('../backend/futebadosparcas-firebase-adminsdk-fbsvc-b5fb25775d.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function automateSeasons() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // 1. Monthly Season
    const monthName = now.toLocaleString('pt-BR', { month: 'long' });
    const monthId = `monthly_${currentYear}_${currentMonth.toString().padStart(2, '0')}`;
    const monthStart = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
    const monthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    const monthDoc = await db.collection('seasons').doc(monthId).get();
    if (!monthDoc.exists) {
        console.log(`Criando temporada mensal: ${monthName} ${currentYear}`);
        await db.collection('seasons').doc(monthId).set({
            name: `Liga Mensal - ${monthName} / ${currentYear}`,
            start_date: monthStart,
            end_date: monthEnd,
            is_active: true,
            type: 'MONTHLY',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } else {
        console.log(`Temporada mensal ${monthId} já existe.`);
        await monthDoc.ref.update({ is_active: true });
    }

    // 2. Annual Season
    const yearId = `annual_${currentYear}`;
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const yearDoc = await db.collection('seasons').doc(yearId).get();
    if (!yearDoc.exists) {
        console.log(`Criando temporada anual: ${currentYear}`);
        await db.collection('seasons').doc(yearId).set({
            name: `Liga Anual - ${currentYear}`,
            start_date: yearStart,
            end_date: yearEnd,
            is_active: true,
            type: 'ANNUAL',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } else {
        console.log(`Temporada anual ${yearId} já existe.`);
        await yearDoc.ref.update({ is_active: true });
    }

    // 3. Deactivate old seasons
    const activeMonthlies = await db.collection('seasons')
        .where('type', '==', 'MONTHLY')
        .where('is_active', '==', true)
        .get();

    for (const doc of activeMonthlies.docs) {
        if (doc.id !== monthId) {
            console.log(`Desativando temporada antiga: ${doc.id}`);
            await doc.ref.update({ is_active: false });
        }
    }

    console.log('Processo de automação de temporadas concluído!');
    process.exit(0);
}

automateSeasons().catch(err => {
    console.error('Erro na automação:', err);
    process.exit(1);
});
