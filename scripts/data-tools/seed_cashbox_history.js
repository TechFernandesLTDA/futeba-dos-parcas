const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const GROUP_ID = '3lf59lAW7URlOBcLN9bn';
const MEMBER_ID = 'FOlvyYHcZWPNqTGHkbSytMUwIAz1';
const MEMBER_NAME = 'Renan Locatiz Fernandes';

async function seedHistory() {
    console.log(`Seeding history for group ${GROUP_ID}...`);

    const now = new Date();
    const batch = db.batch();
    let operationCount = 0;

    let totalIncome = 0;
    let totalExpense = 0;
    let entryCount = 0;

    // Clear existing (optional, but let's just add to it to avoid complex deletions)
    // Actually the user said "insira um historico", implies adding.

    for (let i = 90; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        // Add some randomness to time
        date.setHours(10 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));

        const isIncome = Math.random() > 0.4; // 60% income, 40% expense
        const entryType = isIncome ? 'INCOME' : 'EXPENSE';

        let category = 'GENERAL';
        let amount = 0;
        let description = '';

        if (isIncome) {
            const rand = Math.random();
            if (rand > 0.6) {
                category = 'MONTHLY_FEE';
                amount = 30 + Math.floor(Math.random() * 20); // 30-50
                description = `Mensalidade Ref. ${date.toLocaleDateString()}`;
            } else if (rand > 0.3) {
                category = 'EXTRA_CONTRIBUTION';
                amount = 10 + Math.floor(Math.random() * 40); // 10-50
                description = 'Vaquinha Churrasco';
            } else {
                category = 'GAME_PAYMENT';
                amount = 15;
                description = 'Pagamento Jogo Avulso';
            }
            totalIncome += amount;
        } else {
            const rand = Math.random();
            if (rand > 0.5) {
                category = 'FIELD_RENTAL';
                amount = 120 + Math.floor(Math.random() * 50); // 120-170
                description = 'Aluguel Quadra';
            } else {
                category = 'EQUIPMENT';
                amount = 50 + Math.floor(Math.random() * 100);
                description = 'Compra de Bola/Coletes';
            }
            totalExpense += amount;
        }

        const entryRef = db.collection('groups').doc(GROUP_ID).collection('cashbox').doc();

        // Create timestamp from JS Date
        const timestamp = admin.firestore.Timestamp.fromDate(date);

        const entry = {
            type: entryType,
            category: category,
            amount: amount,
            description: description,
            player_id: isIncome ? MEMBER_ID : null, // Expenses usually null or specific vendor
            player_name: isIncome ? MEMBER_NAME : null,
            created_by: MEMBER_ID,
            created_at: timestamp, // Important: simulate creation time
            reference_date: timestamp,
            status: 'ACTIVE',
            receipt_url: null
        };

        batch.set(entryRef, entry);
        operationCount++;
        entryCount++;

        if (operationCount >= 400) {
            await batch.commit();
            console.log(`Committed batch of ${operationCount} entries.`);
            // Reset batch is complex because we can't easily reset the variable reference without return
            // Ideally we should manage batches better, but 90 entries < 500, so one batch is fine.
        }
    }

    // Commit remaining
    await batch.commit();
    console.log(`Added ${entryCount} entries.`);

    // Update Summary
    console.log('Updating summary...');

    // Need to get current summary first to ADD to it, or RECALCULATE from scratch?
    // Since we added entries, we should probably run a full recalculation to be safe/correct.
    // But manually:

    const summaryRef = db.collection('groups').doc(GROUP_ID).collection('cashbox_summary').doc('current');

    // Let's just grab all active entries to be 100% sure of sync
    const allEntriesFn = await db.collection('groups').doc(GROUP_ID).collection('cashbox')
        .where('status', '==', 'ACTIVE')
        .get();

    let recalcIncome = 0;
    let recalcExpense = 0;
    let lastDate = new Date(0);

    allEntriesFn.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === 'INCOME') {
            recalcIncome += (data.amount || 0);
        } else {
            recalcExpense += (data.amount || 0);
        }
        const d = data.created_at.toDate();
        if (d > lastDate) lastDate = d;
    });

    const balance = recalcIncome - recalcExpense;

    await summaryRef.set({
        balance: balance,
        total_income: recalcIncome,
        total_expense: recalcExpense,
        last_entry_at: admin.firestore.Timestamp.fromDate(lastDate),
        entry_count: allEntriesFn.size
    });

    console.log('Summary updated.');
    console.log(`Final Balance: ${balance}, Income: ${recalcIncome}, Expense: ${recalcExpense}`);
}

seedHistory().catch(console.error);
