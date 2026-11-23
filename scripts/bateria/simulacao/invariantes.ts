/**
 * Simulação de uso — invariantes conferidos com o Admin SDK (só leitura).
 *
 * Cada violação vira um achado no JSONL. Os números conferidos aqui são os que
 * a pessoa vê na tela (contagem de membros, vagas, XP, estatísticas, MVP).
 */

import * as admin from 'firebase-admin';
import { registrarAchado } from './nucleo';

type Doc = admin.firestore.QueryDocumentSnapshot;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export interface ResumoInvariantes {
  verificados: number;
  violacoes: number;
}

export async function conferirInvariantes(rotulo: string, ids: { grupos: string[]; jogos: string[] }): Promise<ResumoInvariantes> {
  const db = admin.firestore();
  let verificados = 0;
  let violacoes = 0;
  const violar = (acao: string, msg: string, dados?: unknown): void => {
    violacoes++;
    registrarAchado(`invariante:${acao}`, `[${rotulo}] ${msg}`, dados);
  };

  // ── grupos: member_count, espelho users/{uid}/groups ──
  for (const groupId of ids.grupos) {
    const g = await db.doc(`groups/${groupId}`).get();
    if (!g.exists) continue;
    const membros = await db.collection(`groups/${groupId}/members`).get();
    const ativos = membros.docs.filter((m) => (m.get('status') ?? 'ACTIVE') === 'ACTIVE');
    verificados++;
    if (num(g.get('member_count')) !== ativos.length) {
      violar('member_count', `grupo ${groupId}: member_count=${g.get('member_count')} mas ${ativos.length} membros ativos`, {
        groupId, member_count: g.get('member_count'), ativos: ativos.length,
      });
    }
    for (const m of ativos) {
      verificados++;
      const espelho = await db.doc(`users/${m.id}/groups/${groupId}`).get();
      if (!espelho.exists) {
        violar('espelho_grupo', `membro ativo ${m.id} do grupo ${groupId} sem users/{uid}/groups`, { groupId, uid: m.id });
      } else if (espelho.get('role') !== m.get('role')) {
        violar('espelho_papel', `papel divergente para ${m.id} em ${groupId}: membro=${m.get('role')} espelho=${espelho.get('role')}`, {
          groupId, uid: m.id, membro: m.get('role'), espelho: espelho.get('role'),
        });
      }
    }
    const inativos = membros.docs.filter((m) => (m.get('status') ?? 'ACTIVE') !== 'ACTIVE');
    for (const m of inativos) {
      verificados++;
      const espelho = await db.doc(`users/${m.id}/groups/${groupId}`).get();
      if (espelho.exists && (espelho.get('status') ?? 'ACTIVE') === 'ACTIVE') {
        violar('espelho_saida', `ex-membro ${m.id} (status ${m.get('status')}) ainda vê o grupo ${groupId} como ativo`, { groupId, uid: m.id });
      }
    }
  }

  // ── jogos: players_count, goleiros, lista, MVP ──
  for (const gameId of ids.jogos) {
    const jogo = await db.doc(`games/${gameId}`).get();
    if (!jogo.exists) continue;
    const confs = await db.collection('confirmations').where('game_id', '==', gameId).get();
    const confirmados = confs.docs.filter((c) => c.get('status') === 'CONFIRMED');
    const goleiros = confirmados.filter((c) => c.get('position') === 'GOALKEEPER');
    verificados += 3;
    if (num(jogo.get('players_count')) !== confirmados.length) {
      violar('players_count', `jogo ${gameId} (${jogo.get('status')}): players_count=${jogo.get('players_count')} mas ${confirmados.length} confirmações CONFIRMED`, {
        gameId, players_count: jogo.get('players_count'), confirmados: confirmados.length,
      });
    }
    if (num(jogo.get('goalkeepers_count')) !== goleiros.length) {
      violar('goalkeepers_count', `jogo ${gameId}: goalkeepers_count=${jogo.get('goalkeepers_count')} mas ${goleiros.length} goleiros confirmados`, {
        gameId, goalkeepers_count: jogo.get('goalkeepers_count'), goleiros: goleiros.length,
      });
    }
    const lista = (jogo.get('players') as string[] | undefined) ?? [];
    const ids = new Set(confirmados.map((c) => c.get('user_id') as string));
    if (lista.length !== ids.size || lista.some((u) => !ids.has(u))) {
      violar('players_array', `jogo ${gameId}: players[] (${lista.length}) diverge das confirmações (${ids.size})`, {
        gameId, sobrando: lista.filter((u) => !ids.has(u)), faltando: [...ids].filter((u) => !lista.includes(u)),
      });
    }
    const max = num(jogo.get('max_players'));
    if (max > 0 && confirmados.length > max) {
      violar('lotacao', `jogo ${gameId}: ${confirmados.length} confirmados acima de max_players=${max}`, { gameId });
    }
    // Lista de espera com vaga sobrando e jogo ainda aberto.
    if (jogo.get('status') === 'SCHEDULED' && max > 0 && confirmados.length < max) {
      const espera = await db.collection(`games/${gameId}/waitlist`).get();
      const aguardando = espera.docs.filter((w) => (w.get('status') ?? 'WAITING') === 'WAITING');
      verificados++;
      if (aguardando.length > 0) {
        violar('fila_parada', `jogo ${gameId}: ${max - confirmados.length} vaga(s) livre(s) e ${aguardando.length} na lista de espera`, { gameId });
      }
    }
    if (jogo.get('status') === 'FINISHED') {
      verificados += 2;
      const logs = await db.collection('xp_logs').where('game_id', '==', gameId).get();
      const retido = jogo.get('xp_reward_status') === 'HELD_FOR_REVIEW';
      if (!retido && logs.size < confirmados.length) {
        violar('xp_jogo', `jogo ${gameId} FINISHED: ${logs.size} xp_logs para ${confirmados.length} confirmados (xp_reward_status=${jogo.get('xp_reward_status')})`, {
          gameId, xp_logs: logs.size, confirmados: confirmados.length, xp_reward_status: jogo.get('xp_reward_status'),
        });
      }
      if (jogo.get('voting_concluded') === true && !jogo.get('mvp_id')) {
        violar('mvp_sem_id', `jogo ${gameId}: votação concluída sem mvp_id`, { gameId });
      }
    }
  }

  // ── XP: users.experience_points × soma de xp_logs; cadeia xp_before/xp_after ──
  const logs = await db.collection('xp_logs').get();
  const porUsuario = new Map<string, Doc[]>();
  for (const l of logs.docs) {
    const uid = l.get('user_id') as string;
    if (!uid) continue;
    porUsuario.set(uid, [...(porUsuario.get(uid) ?? []), l]);
  }
  for (const [uid, lista] of porUsuario) {
    const user = await db.doc(`users/${uid}`).get();
    if (!user.exists) continue;
    verificados++;
    const soma = lista.reduce((acc, l) => acc + num(l.get('xp_earned')), 0);
    const xp = num(user.get('experience_points'));
    if (xp !== soma) {
      violar('xp_total', `usuário ${uid}: experience_points=${xp} mas soma de xp_logs=${soma} (${lista.length} logs)`, { uid, xp, soma, logs: lista.length });
    }
    const negativos = lista.filter((l) => num(l.get('xp_after')) < 0);
    if (negativos.length) violar('xp_negativo', `usuário ${uid}: xp_after negativo em ${negativos.length} log(s)`, { uid });
  }

  // ── estatísticas: jogos e gols × confirmações de jogos finalizados ──
  const finalizados = new Set<string>();
  for (const gameId of ids.jogos) {
    const j = await db.doc(`games/${gameId}`).get();
    if (j.get('status') === 'FINISHED' && j.get('xp_reward_status') !== 'HELD_FOR_REVIEW') finalizados.add(gameId);
  }
  if (finalizados.size) {
    const jogosPorUid = new Map<string, { jogos: number; gols: number }>();
    for (const gameId of finalizados) {
      const confs = await db.collection('confirmations').where('game_id', '==', gameId).where('status', '==', 'CONFIRMED').get();
      for (const c of confs.docs) {
        const uid = c.get('user_id') as string;
        const atual = jogosPorUid.get(uid) ?? { jogos: 0, gols: 0 };
        atual.jogos++;
        atual.gols += num(c.get('goals'));
        jogosPorUid.set(uid, atual);
      }
    }
    for (const [uid, esperado] of jogosPorUid) {
      const st = await db.doc(`statistics/${uid}`).get();
      verificados++;
      if (!st.exists) {
        violar('estatisticas_ausentes', `usuário ${uid} jogou ${esperado.jogos} jogo(s) finalizado(s) e não tem statistics/{uid}`, { uid });
        continue;
      }
      // statistics/{uid} usa camelCase (player-xp-transaction.ts:568).
      const jogos = num(st.get('totalGames'));
      // Só a parte da simulação: o seed já deixou jogos antes; estatística menor que o simulado é erro.
      if (jogos < esperado.jogos) {
        violar('estatisticas_jogos', `usuário ${uid}: total_games=${jogos} menor que ${esperado.jogos} jogos finalizados na simulação`, { uid, jogos, esperado: esperado.jogos });
      }
    }
  }

  return { verificados, violacoes };
}
