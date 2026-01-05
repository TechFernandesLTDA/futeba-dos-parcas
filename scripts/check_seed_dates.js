/**
 * Verifica as datas dos jogos de seed
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkSeedDates() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('DATAS DOS JOGOS DE SEED');
  console.log('════════════════════════════════════════════════════════\n');

  const seedGames = await db.collection('games')
    .where('name', '==', 'Pelada dos Parças')
    .get();

  const dates = [];

  seedGames.forEach(doc => {
    const game = doc.data();
    dates.push({
      id: doc.id,
      date: game.date,
      dateTime: game.dateTime
    });
  });

  // Ordenar por data
  dates.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });

  console.log(`Total de jogos de seed: ${dates.length}\n`);

  console.log('Primeiros 5 jogos:');
  for (let i = 0; i < Math.min(5, dates.length); i++) {
    console.log(`  ${dates[i].id}: ${dates[i].date}`);
  }

  console.log('\nÚltimos 5 jogos:');
  for (let i = Math.max(0, dates.length - 5); i < dates.length; i++) {
    console.log(`  ${dates[i].id}: ${dates[i].date}`);
  }

  // Contar por mês
  console.log('\n════════════════════════════════════════════════════════');
  console.log('DISTRIBUIÇÃO POR MÊS');
  console.log('════════════════════════════════════════════════════════\n');

  const byMonth = {};
  dates.forEach(d => {
    const month = d.date.substring(0, 7); // YYYY-MM
    byMonth[month] = (byMonth[month] || 0) + 1;
  });

  const monthsOrdered = Object.keys(byMonth).sort();
  monthsOrdered.forEach(month => {
    console.log(`  ${month}: ${byMonth[month]} jogos`);
  });

  console.log('');

  // Verificar janeiro 2026
  const jan2026Games = dates.filter(d => d.date.startsWith('2026-01'));
  console.log('════════════════════════════════════════════════════════');
  console.log('JOGOS EM JANEIRO 2026');
  console.log('════════════════════════════════════════════════════════\n');

  if (jan2026Games.length === 0) {
    console.log('  ❌ NENHUM JOGO EM JANEIRO 2026!');
    console.log('  Isso explica por que a Liga de Janeiro está vazia.\n');
  } else {
    console.log(`  ✅ ${jan2026Games.length} jogo(s) em Janeiro 2026:\n`);
    jan2026Games.forEach(g => {
      console.log(`    ${g.id}: ${g.date}`);
    });
    console.log('');
  }

  process.exit(0);
}

checkSeedDates();
