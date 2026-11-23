/**
 * Sonda: sair e remover membro com o mesmo batch do web
 * (removeGroupMembershipArtifacts, web/src/hooks/useGroups.ts:41).
 * Cria um grupo e um jogo SCHEDULED pelo Admin SDK, só no emulador.
 */
import * as admin from 'firebase-admin';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { pessoa, codigoDoErro } from './nucleo';

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-futebadosparcas' });
const adb = admin.firestore();

async function lote(quem: Awaited<ReturnType<typeof pessoa>>, gid: string, uid: string, status: string, jogos: string[]) {
  const b = writeBatch(quem.db);
  b.update(doc(quem.db, 'groups', gid, 'members', uid), { status, updated_at: serverTimestamp() });
  b.delete(doc(quem.db, 'users', uid, 'groups', gid));
  for (const j of jogos) b.update(doc(quem.db, 'confirmations', `${j}_${uid}`), { status: 'CANCELLED', updated_at: serverTimestamp() });
  try { await b.commit(); return 'ok'; } catch (e) { const { codigo, msg } = codigoDoErro(e); return `${codigo}: ${msg.slice(0, 160)}`; }
}

(async () => {
  const dono = await pessoa('jogador02'); const a = await pessoa('jogador08'); const bq = await pessoa('jogador09');
  const gid = `sonda-saida-${Date.now()}`;
  const agora = admin.firestore.FieldValue.serverTimestamp();
  await adb.doc(`groups/${gid}`).set({ name: 'Sonda saída', owner_id: dono.uid, owner_name: dono.nome, is_public: false, status: 'ACTIVE', member_count: 3, created_at: agora, updated_at: agora });
  for (const [u, role] of [[dono.uid, 'OWNER'], [a.uid, 'MEMBER'], [bq.uid, 'MEMBER']] as const) {
    await adb.doc(`groups/${gid}/members/${u}`).set({ id: u, user_id: u, user_name: u, role, status: 'ACTIVE', joined_at: agora });
    await adb.doc(`users/${u}/groups/${gid}`).set({ group_id: gid, role, status: 'ACTIVE', joined_at: agora });
  }
  // Jogo futuro em que nenhum dos dois membros confirmou.
  const jogo = adb.collection('games').doc();
  await jogo.set({ group_id: gid, owner_id: dono.uid, status: 'SCHEDULED', date: '2026-12-31', time: '20:00', visibility: 'GROUP_ONLY', created_at: agora });
  console.log('1. membro sai, sem jogo futuro:          ', await lote(a, gid, a.uid, 'INACTIVE', []));
  console.log('2. membro sai, com jogo futuro sem conf: ', await lote(a, gid, a.uid, 'INACTIVE', [jogo.id]));
  console.log('3. dono remove membro, jogo sem conf:    ', await lote(dono, gid, bq.uid, 'REMOVED', [jogo.id]));
  console.log('4. dono remove membro, sem jogo:         ', await lote(dono, gid, bq.uid, 'REMOVED', []));
  process.exit(0);
})();
