const admin = require('firebase-admin');

// No need for service account if we use default credentials from environment
// However, in this environment, it's better to use the active project from CLI
admin.initializeApp({
  projectId: 'futebadosparcas'
});

const db = admin.firestore();

async function cleanup() {
  console.log('--- Iniciando limpeza de convites pendentes ---');
  
  // 1. Limpar group_invites
  const groupInvitesSnapshot = await db.collection('group_invites')
    .where('status', '==', 'PENDING')
    .get();
    
  console.log(`Encontrados ${groupInvitesSnapshot.size} convites de grupo pendentes.`);
  
  const batch = db.batch();
  groupInvitesSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  // 2. Limpar game_summons
  const gameSummonsSnapshot = await db.collection('game_summons')
    .where('status', '==', 'PENDING')
    .get();
    
  console.log(`Encontrados ${gameSummonsSnapshot.size} convocações de jogo pendentes.`);
  
  gameSummonsSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  // 3. Limpar notificações relacionadas
  const notificationsSnapshot = await db.collection('notifications')
    .where('type', 'in', ['GROUP_INVITE', 'GAME_SUMMON'])
    .get();

  console.log(`Encontradas ${notificationsSnapshot.size} notificações de convite/convocação.`);
  
  notificationsSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  if (groupInvitesSnapshot.size > 0 || gameSummonsSnapshot.size > 0 || notificationsSnapshot.size > 0) {
    await batch.commit();
    console.log('✅ Limpeza concluída com sucesso!');
  } else {
    console.log('Nenhum item pendente encontrado para limpar.');
  }
}

cleanup().catch(err => {
  console.error('Erro na limpeza:', err);
  process.exit(1);
});
