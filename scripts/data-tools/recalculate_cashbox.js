const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const GROUP_ID = '3lf59lAW7URlOBcLN9bn';

async function recalculateSummary() {
    console.log(`Recalculating summary for group ${GROUP_ID}...`);

    try {
        const allEntriesFn = await db.collection('groups').doc(GROUP_ID).collection('cashbox')
            .where('status', '==', 'ACTIVE')
            .get();

        console.log(`Found ${allEntriesFn.size} active entries.`);

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

            let d = new Date(0);
            if (data.created_at && typeof data.created_at.toDate === 'function') {
                d = data.created_at.toDate();
            } else if (data.reference_date && typeof data.reference_date.toDate === 'function') {
                d = data.reference_date.toDate();
            }

            if (d > lastDate) lastDate = d;
        });

        const balance = recalcIncome - recalcExpense;

        const summaryRef = db.collection('groups').doc(GROUP_ID).collection('cashbox_summary').doc('current');

        await summaryRef.set({
            balance: balance,
            total_income: recalcIncome,
            total_expense: recalcExpense,
            last_entry_at: admin.firestore.Timestamp.fromDate(lastDate),
            entry_count: allEntriesFn.size
        });

        console.log('Summary updated successfully.');
        console.log(`Final Balance: ${balance}, Income: ${recalcIncome}, Expense: ${recalcExpense}`);

    } catch (error) {
        console.error('Error recalculating:', error);
    }
}

recalculateSummary().catch(console.error);
