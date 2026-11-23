/**
 * Simulação de uso — 13 semanas de grupos de pelada, acelerada.
 *
 * Uso (emuladores da bateria no ar: `scripts/bateria/rodar.sh subir`):
 *   NODE_PATH=functions/node_modules:web/node_modules \
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:18085 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:19099 \
 *   GCLOUD_PROJECT=demo-futebadosparcas web/node_modules/.bin/tsx \
 *   scripts/bateria/simulacao/simular.ts --semanas 13 --saida <arquivo.jsonl>
 *
 * Tempo: as regras comparam `created_at` com `request.time` e as callables usam
 * o relógio real (confirmação só em jogo futuro, check-in a partir de 30 min
 * antes, votação até 24 h depois do fim). Por isso cada "semana" roda agora, em
 * sequência: o jogo nasce no futuro, recebe confirmações, o Admin SDK traz o
 * horário para perto de agora e o fluxo segue pelas callables reais. Datas de
 * calendário (temporada mensal, sequência entre dias, lembretes) NÃO são
 * cobertas aqui; o relatório lista isso.
 *
 * Gravações diretas usam o formato do web (levantado de web/src, ver
 * formatos-do-web.md nesta pasta) e passam pelas firestore.rules como a pessoa.
 */

import { writeFileSync } from 'node:fs';
import * as admin from 'firebase-admin';
import {
  addDoc, collection, doc, getDoc, runTransaction, serverTimestamp, setDoc,
  Timestamp, updateDoc, writeBatch,
} from 'firebase/firestore';
import { exigirEmulador, iniciarAdmin, pausa, esperar } from '../emulador';
import { JOGADORES } from '../contas';
import { QUADRAS, idsDoAlvo } from '../cenario';
import {
  abrirRegistro, agir, chamarComo, chance, contadores, definirSemana, embaralhar, inteiro, pessoa,
  registrarAchado, registrarEvento, semear, sortear, type Pessoa,
} from './nucleo';
import { conferirInvariantes } from './invariantes';

const idSeed = idsDoAlvo('emulador');

// ───────────────────────── argumentos ─────────────────────────

const arg = (nome: string, padrao: string): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};
const SEMANAS = Number(arg('semanas', '13'));
const SAIDA = arg('saida', `scripts/bateria/simulacao/saida/sim-${Date.now()}.jsonl`);
const SO_GRUPOS = arg('grupos', '').split(',').filter(Boolean);
semear(Number(arg('semente', '20261123')));

// ───────────────────────── elenco ─────────────────────────

type Persona = 'assiduo' | 'casual' | 'furao' | 'novato' | 'sumido' | 'organizador';

/** Comportamento por persona: probabilidades por semana. */
const PERFIL: Record<Persona, { confirma: number; cancela: number; vota: number; conversa: number; checkin: number }> = {
  organizador: { confirma: 1, cancela: 0, vota: 0.95, conversa: 0.6, checkin: 0.95 },
  assiduo: { confirma: 0.9, cancela: 0.05, vota: 0.85, conversa: 0.3, checkin: 0.95 },
  casual: { confirma: 0.5, cancela: 0.12, vota: 0.5, conversa: 0.15, checkin: 0.85 },
  furao: { confirma: 0.75, cancela: 0.4, vota: 0.3, conversa: 0.2, checkin: 0.6 },
  novato: { confirma: 0.7, cancela: 0.1, vota: 0.6, conversa: 0.25, checkin: 0.8 },
  sumido: { confirma: 0.6, cancela: 0.2, vota: 0.4, conversa: 0.1, checkin: 0.8 },
};

const PERSONAS: Record<string, Persona> = {
  jogador01: 'assiduo', jogador02: 'organizador', jogador03: 'assiduo', jogador04: 'casual',
  jogador05: 'furao', jogador06: 'assiduo', jogador07: 'organizador', jogador08: 'casual',
  jogador09: 'assiduo', jogador10: 'furao', jogador11: 'novato', jogador12: 'organizador',
  jogador13: 'casual', jogador14: 'sumido', jogador15: 'assiduo', jogador16: 'organizador',
  jogador17: 'novato', jogador18: 'casual', jogador19: 'furao', jogador20: 'sumido',
};

interface GrupoSim {
  chave: string;
  nome: string;
  dono: string;
  publico: boolean;
  visibilidade: 'GROUP_ONLY' | 'PUBLIC_OPEN' | 'PUBLIC_CLOSED';
  quadra: (typeof QUADRAS)[number];
  maxJogadores: number;
  /** Como cada membro entra: convite nominal, código ou pedido. Semana em que entra. */
  entradas: { chave: string; via: 'convite' | 'codigo' | 'pedido'; semana: number }[];
  /** Semanas em que tem jogo. */
  joga: (semana: number) => boolean;
  /** Membros que saem do grupo e em que semana. */
  saidas: { chave: string; semana: number }[];
  /** Quem vira ADMIN e quando. */
  promocoes: { chave: string; semana: number }[];
  preco: number;
  aluguel: number;
}

const ent = (chaves: string[], via: 'convite' | 'codigo' | 'pedido', semana: number) => chaves.map((chave) => ({ chave, via, semana }));

const GRUPOS_SIM: GrupoSim[] = [
  {
    chave: 'quinta', nome: 'Pelada de Quinta', dono: 'jogador02', publico: false, visibilidade: 'GROUP_ONLY',
    quadra: QUADRAS[0], maxJogadores: 14,
    entradas: [
      ...ent(['jogador01', 'jogador03', 'jogador04', 'jogador05', 'jogador06'], 'convite', 1),
      ...ent(['jogador08', 'jogador09', 'jogador10', 'jogador13', 'jogador14'], 'codigo', 1),
      ...ent(['jogador15', 'jogador18'], 'codigo', 2),
      ...ent(['jogador11'], 'pedido', 4),
      ...ent(['jogador17'], 'convite', 7),
    ],
    joga: () => true,
    saidas: [{ chave: 'jogador14', semana: 8 }],
    promocoes: [{ chave: 'jogador03', semana: 3 }],
    preco: 20, aluguel: 220,
  },
  {
    chave: 'sabado', nome: 'Racha do Sábado', dono: 'jogador07', publico: true, visibilidade: 'PUBLIC_OPEN',
    quadra: QUADRAS[1], maxJogadores: 12,
    entradas: [
      ...ent(['jogador06', 'jogador09', 'jogador10', 'jogador19'], 'convite', 1),
      ...ent(['jogador04', 'jogador12', 'jogador20'], 'codigo', 2),
      ...ent(['jogador01', 'jogador11'], 'pedido', 3),
    ],
    joga: (s) => s !== 6, // feriado
    saidas: [{ chave: 'jogador20', semana: 9 }],
    promocoes: [{ chave: 'jogador09', semana: 5 }],
    preco: 25, aluguel: 250,
  },
  {
    chave: 'firma', nome: 'Futsal da Firma', dono: 'jogador12', publico: false, visibilidade: 'GROUP_ONLY',
    quadra: QUADRAS[2], maxJogadores: 10,
    entradas: [
      ...ent(['jogador13', 'jogador15', 'jogador16', 'jogador17', 'jogador18', 'jogador01'], 'convite', 1),
      ...ent(['jogador05', 'jogador08'], 'codigo', 3),
    ],
    joga: (s) => s % 2 === 1, // quinzenal
    saidas: [],
    promocoes: [],
    preco: 15, aluguel: 150,
  },
  {
    chave: 'antigas', nome: 'Fut das Antigas', dono: 'jogador16', publico: false, visibilidade: 'GROUP_ONLY',
    quadra: QUADRAS[0], maxJogadores: 12,
    entradas: [
      ...ent(['jogador03', 'jogador14', 'jogador19', 'jogador20', 'jogador06'], 'convite', 1),
      ...ent(['jogador05'], 'codigo', 2),
    ],
    joga: (s) => s <= 6, // o grupo esvazia no segundo mês
    saidas: [{ chave: 'jogador19', semana: 5 }, { chave: 'jogador20', semana: 6 }],
    promocoes: [],
    preco: 20, aluguel: 200,
  },
];

// ───────────────────────── estado ─────────────────────────

interface EstadoGrupo {
  cfg: GrupoSim;
  id?: string;
  membros: Set<string>;
  codigo?: string;
  jogos: string[];
  enquetes: string[];
  caixaReconciliado?: boolean;
}

const estado = new Map<string, EstadoGrupo>();
const todosOsJogos: string[] = [];
let slot = 0;

const db = (): admin.firestore.Firestore => admin.firestore();
const agoraTs = serverTimestamp;

function dataEHora(instante: Date): { date: string; time: string } {
  const d2 = (n: number): string => String(n).padStart(2, '0');
  return {
    date: `${instante.getFullYear()}-${d2(instante.getMonth() + 1)}-${d2(instante.getDate())}`,
    time: `${d2(instante.getHours())}:${d2(instante.getMinutes())}`,
  };
}

const p = (chave: string): Promise<Pessoa> => pessoa(chave, PERSONAS[chave] ?? 'padrao');

// ───────────────────────── grupos ─────────────────────────

async function criarGrupo(eg: EstadoGrupo): Promise<void> {
  const dono = await p(eg.cfg.dono);
  // Mesmo lote do useGroups.ts:368-438.
  const gid = doc(collection(dono.db, 'groups')).id;
  const ok = await agir(dono, 'grupo:criar', 'ok', async () => {
    const lote = writeBatch(dono.db);
    lote.set(doc(dono.db, 'groups', gid), {
      name: eg.cfg.nome, description: `Simulação: ${eg.cfg.nome}`, photo_url: null,
      type: eg.cfg.publico ? 'PUBLIC' : 'PRIVATE', is_public: eg.cfg.publico,
      owner_id: dono.uid, owner_name: dono.nome, member_count: 0, members: [dono.uid],
      total_games_played: 0, status: 'ACTIVE', created_at: agoraTs(), updated_at: agoraTs(),
    });
    lote.set(doc(dono.db, 'groups', gid, 'members', dono.uid), {
      user_id: dono.uid, user_name: dono.nome, user_photo_url: null, role: 'OWNER', status: 'ACTIVE',
      joined_at: agoraTs(), total_games: 0, level: 0,
    });
    lote.set(doc(dono.db, 'users', dono.uid, 'groups', gid), {
      group_id: gid, group_name: eg.cfg.nome, group_photo: null, role: 'OWNER', member_count: 1, joined_at: agoraTs(),
    });
    await lote.commit();
    return true;
  }, { alvo: gid });
  if (!ok) return;
  eg.id = gid;
  eg.membros.add(eg.cfg.dono);
  await agir(dono, 'grupo:gerar_codigo', 'ok', async () => {
    const r = await chamarComo<{ code: string }>(dono, 'generateGroupInviteCode', { groupId: gid, groupName: eg.cfg.nome });
    eg.codigo = r.code;
  }, { alvo: gid });
}

async function esperarMembro(gid: string, uid: string, acao: string, ator: string): Promise<boolean> {
  const inicio = Date.now();
  try {
    await esperar(`${uid} vira membro de ${gid}`, async () => {
      const m = await db().doc(`groups/${gid}/members/${uid}`).get();
      return m.exists && (m.get('status') ?? 'ACTIVE') === 'ACTIVE' ? true : null;
    }, 20_000, 500);
    return true;
  } catch {
    registrarEvento({
      ator, acao: `${acao}:membro_criado`, alvo: gid, esperado: 'ok', obtido: 'timeout',
      msg: `membro não apareceu em 20 s (o web espera 8 s)`, ms: Date.now() - inicio, achado: true,
    });
    return false;
  }
}

async function entrarNoGrupo(eg: EstadoGrupo, chave: string, via: 'convite' | 'codigo' | 'pedido'): Promise<void> {
  if (!eg.id) return;
  const gid = eg.id;
  const dono = await p(eg.cfg.dono);
  const pessoaNova = await p(chave);

  if (via === 'convite') {
    // InvitePlayersScreen.tsx:228
    const convite = await agir(dono, 'grupo:convidar', 'ok', () => addDoc(collection(dono.db, 'group_invites'), {
      group_id: gid, group_name: eg.cfg.nome, group_photo: null,
      invited_by_id: dono.uid, invited_by_name: dono.nome,
      invited_user_id: pessoaNova.uid, invited_user_name: pessoaNova.nome, invited_user_photo: null,
      status: 'PENDING', expires_at: Timestamp.fromDate(new Date(Date.now() + 24 * 3600 * 1000)),
      created_at: agoraTs(), updated_at: agoraTs(),
    }), { alvo: gid });
    if (!convite) return;
    // Alguns demoram para aceitar; um recusa e aceita no próximo convite (não modelado).
    await pausa(inteiro(200, 1500));
    const aceitou = await agir(pessoaNova, 'grupo:aceitar_convite', 'ok', () => updateDoc(doc(pessoaNova.db, 'group_invites', convite.id), { status: 'ACCEPTED', updated_at: agoraTs() }), { alvo: convite.id });
    if (aceitou === undefined) return;
    if (await esperarMembro(gid, pessoaNova.uid, 'grupo:aceitar_convite', chave)) eg.membros.add(chave);
    return;
  }

  if (via === 'codigo') {
    if (!eg.codigo) return;
    // O dono compartilha o MESMO código no grupo de WhatsApp. Se o código já
    // foi usado, a pessoa pede outro e tenta de novo (registrado como achado).
    const resgatar = (code: string, acao: string, esperado: string) => agir(pessoaNova, acao, esperado, () => runTransaction(pessoaNova.db, async (tx) => {
      const ref = doc(pessoaNova.db, 'invites', code);
      const inv = await tx.get(ref);
      if (!inv.exists()) throw Object.assign(new Error('convite inexistente'), { code: 'not-found' });
      await tx.get(doc(pessoaNova.db, 'groups', gid, 'members', pessoaNova.uid));
      await tx.get(doc(pessoaNova.db, 'groups', gid, 'blocked_players', pessoaNova.uid));
      tx.update(ref, { used: true, used_by: pessoaNova.uid, used_at: agoraTs() });
    }), { alvo: code });
    let ok = await resgatar(eg.codigo.toUpperCase(), 'grupo:entrar_por_codigo_compartilhado', 'ok');
    if (ok === undefined) {
      const novo = await agir(dono, 'grupo:gerar_codigo', 'ok', () => chamarComo<{ code: string }>(dono, 'generateGroupInviteCode', { groupId: gid, groupName: eg.cfg.nome }), { alvo: gid });
      if (!novo?.code) return;
      eg.codigo = novo.code;
      ok = await resgatar(novo.code.toUpperCase(), 'grupo:entrar_por_codigo_novo', 'ok');
    }
    if (ok === undefined) return;
    if (await esperarMembro(gid, pessoaNova.uid, 'grupo:entrar_por_codigo', chave)) eg.membros.add(chave);
    return;
  }

  // Pedido de entrada (useJoinRequests.ts:103) aprovado pelo dono (:230).
  const pedido = await agir(pessoaNova, 'grupo:pedir_entrada', 'ok', () => setDoc(doc(pessoaNova.db, 'groups', gid, 'join_requests', pessoaNova.uid), {
    user_id: pessoaNova.uid, user_name: pessoaNova.nome, user_photo: null, status: 'PENDING', requested_at: agoraTs(),
  }), { alvo: gid });
  if (pedido === undefined) return;
  await pausa(inteiro(300, 1200));
  const aprovou = await agir(dono, 'grupo:aprovar_pedido', 'ok', () => runTransaction(dono.db, async (tx) => {
    const ref = doc(dono.db, 'groups', gid, 'join_requests', pessoaNova.uid);
    await tx.get(ref);
    tx.update(ref, { status: 'APPROVED', responded_at: agoraTs(), responded_by: dono.uid });
  }), { alvo: gid });
  if (aprovou === undefined) return;
  if (await esperarMembro(gid, pessoaNova.uid, 'grupo:aprovar_pedido', chave)) eg.membros.add(chave);
}

async function sairDoGrupo(eg: EstadoGrupo, chave: string): Promise<void> {
  if (!eg.id || !eg.membros.has(chave)) return;
  const gid = eg.id;
  const quem = await p(chave);
  // removeGroupMembershipArtifacts(gid, uid, 'INACTIVE') — useGroups.ts:41-73.
  const ok = await agir(quem, 'grupo:sair', 'ok', async () => {
    const lote = writeBatch(quem.db);
    lote.update(doc(quem.db, 'groups', gid, 'members', quem.uid), { status: 'INACTIVE', updated_at: agoraTs() });
    lote.delete(doc(quem.db, 'users', quem.uid, 'groups', gid));
    // O web cancela as confirmações nos jogos do grupo (só as que existem).
    for (const gameId of eg.jogos) {
      const conf = await getDoc(doc(quem.db, 'confirmations', `${gameId}_${quem.uid}`)).catch(() => null);
      const jogo = await db().doc(`games/${gameId}`).get();
      if (conf?.exists() && ['SCHEDULED', 'CONFIRMED'].includes(jogo.get('status'))) {
        lote.update(doc(quem.db, 'confirmations', `${gameId}_${quem.uid}`), { status: 'CANCELLED', updated_at: agoraTs() });
      }
    }
    await lote.commit();
    return true;
  }, { alvo: gid });
  if (ok) eg.membros.delete(chave);
}

async function promover(eg: EstadoGrupo, chave: string): Promise<void> {
  if (!eg.id || !eg.membros.has(chave)) return;
  const dono = await p(eg.cfg.dono);
  const alvo = await p(chave);
  await agir(dono, 'grupo:promover_admin', 'ok', async () => {
    const lote = writeBatch(dono.db);
    lote.update(doc(dono.db, 'groups', eg.id!, 'members', alvo.uid), { role: 'ADMIN' });
    lote.update(doc(dono.db, 'users', alvo.uid, 'groups', eg.id!), { role: 'ADMIN' });
    await lote.commit();
  }, { alvo: eg.id });
}

// ───────────────────────── jogo da semana ─────────────────────────

async function criarJogo(eg: EstadoGrupo, s: number): Promise<string | undefined> {
  const dono = await p(eg.cfg.dono);
  const quadra = eg.cfg.quadra;
  const locationId = idSeed(quadra.chave);
  // Cada jogo nasce numa janela futura própria (detector de sobreposição).
  const inicio = new Date(Date.now() + (48 + slot++ * 3) * 3600 * 1000);
  inicio.setMinutes(0, 0, 0);
  const visibilidade = eg.cfg.visibilidade;
  // useGames.ts:662-746 com o payload do CreateGameScreen (sem dateTime).
  const ref = await agir(dono, 'jogo:criar', 'ok', () => addDoc(collection(dono.db, 'games'), {
    name: `Society - ${quadra.nome}`, ...dataEHora(inicio),
    end_time: dataEHora(new Date(inicio.getTime() + 3600 * 1000)).time,
    location_id: locationId, location_name: quadra.nome, location_address: quadra.endereco,
    field_id: `${locationId}-campo`, field_name: quadra.campo.nome, field_type: quadra.campo.tipo,
    game_type: 'Society', max_players: Number(arg('max', '0')) || eg.cfg.maxJogadores, max_goalkeepers: 2, number_of_teams: 2,
    total_cost: eg.cfg.aluguel, daily_price: eg.cfg.preco, price_manual_override: false,
    pix_payment_enabled: false, pix_key: '', pix_key_type: '', pix_beneficiary_name: '', rules: '',
    group_id: eg.id, group_name: eg.cfg.nome, visibility: visibilidade,
    recurrence_enabled: false, stream_url: '', auto_invite_members: false, gender: 'MIXED', created_by: dono.uid,
    is_public: visibilidade === 'PUBLIC_OPEN' || visibilidade === 'PUBLIC_CLOSED',
    owner_id: dono.uid, owner_name: dono.nome, status: 'SCHEDULED', players_count: 0, goalkeepers_count: 0,
    players: [], team1_score: 0, team2_score: 0, voting_concluded: false, post_game_report_generated: false,
    auto_closed: false, co_organizers: [], created_at: agoraTs(), updated_at: agoraTs(),
  }), { alvo: eg.id, dados: { semana: s, membros: eg.membros.size } });
  if (!ref) return undefined;
  eg.jogos.push(ref.id);
  todosOsJogos.push(ref.id);

  // O web não grava dateTime; confere se algum trigger preenche.
  await pausa(2500);
  const criado = await db().doc(`games/${ref.id}`).get();
  if (!criado.get('dateTime')) {
    registrarAchado('jogo:sem_dateTime', `jogo ${ref.id} criado pelo formato do web ficou sem dateTime (só date/time em texto) após 2,5 s`, { gameId: ref.id });
    await db().doc(`games/${ref.id}`).update({ dateTime: admin.firestore.Timestamp.fromDate(inicio) });
  }
  return ref.id;
}

async function confirmar(gameId: string, chave: string, publico: boolean, membro: boolean): Promise<'ok' | 'cheio' | 'falhou'> {
  const quem = await p(chave);
  const posicao = quem.conta.posicao;
  const jogo = await db().doc(`games/${gameId}`).get();
  const confirmados = (jogo.get('players_count') as number) ?? 0;
  const max = (jogo.get('max_players') as number) ?? 12;
  const gks = (jogo.get('goalkeepers_count') as number) ?? 0;
  const cheio = confirmados >= max || (posicao === 'GOALKEEPER' && gks >= ((jogo.get('max_goalkeepers') as number) ?? 2));
  const funcao = !membro && publico ? 'joinPublicGame' : 'confirmGamePresence';
  const esperado = !membro && !publico ? 'permission-denied' : cheio ? 'resource-exhausted' : 'ok';
  const r = await agir(quem, `presenca:${funcao}`, esperado, () => chamarComo(quem, funcao, { gameId, position: posicao, isCasualPlayer: false }), {
    alvo: gameId, dados: { confirmados, max, posicao },
  });
  if (r !== undefined) return 'ok';
  return cheio ? 'cheio' : 'falhou';
}

async function cancelarPresenca(gameId: string, chave: string): Promise<void> {
  const quem = await p(chave);
  // useGames.ts:626-643
  await agir(quem, 'presenca:cancelar', 'ok', async () => {
    const ref = doc(quem.db, 'confirmations', `${gameId}_${quem.uid}`);
    const conf = await getDoc(ref);
    if (!conf.exists()) throw Object.assign(new Error('confirmação inexistente'), { code: 'not-found' });
    const lote = writeBatch(quem.db);
    lote.update(ref, { status: 'CANCELLED', updated_at: agoraTs() });
    await lote.commit();
  }, { alvo: gameId });
}

async function rodarJogo(eg: EstadoGrupo, s: number): Promise<void> {
  const gameId = await criarJogo(eg, s);
  if (!gameId) return;
  const dono = await p(eg.cfg.dono);
  const publico = eg.cfg.visibilidade !== 'GROUP_ONLY';

  // ── confirmações ──
  const confirmados: string[] = [];
  const espera: string[] = [];
  const candidatos = embaralhar([...eg.membros]);
  // O dono confirma primeiro.
  const ordem = [eg.cfg.dono, ...candidatos.filter((c) => c !== eg.cfg.dono)];
  for (const chave of ordem) {
    const perfil = PERFIL[PERSONAS[chave] ?? 'casual'];
    if (chave !== eg.cfg.dono && !chance(perfil.confirma)) continue;
    const r = await confirmar(gameId, chave, publico, true);
    if (r === 'ok') confirmados.push(chave);
    if (r === 'cheio') {
      const quem = await p(chave);
      const w = await agir(quem, 'espera:entrar', 'ok', () => chamarComo(quem, 'joinGameWaitlist', { gameId, position: 'LINE' }), { alvo: gameId });
      if (w !== undefined) espera.push(chave);
    }
  }
  // Gente de fora: em jogo público entra pela lista pública; em jogo do grupo deve ser barrada.
  const forasteiros = embaralhar(JOGADORES.map((j) => j.chave).filter((c) => !eg.membros.has(c))).slice(0, publico ? 3 : 1);
  for (const chave of forasteiros) {
    if (!publico && !chance(0.5)) continue;
    const r = await confirmar(gameId, chave, publico, false);
    if (r === 'ok') confirmados.push(chave);
    if (r === 'cheio' && publico) {
      const quem = await p(chave);
      const w = await agir(quem, 'espera:entrar_publico', 'ok', () => chamarComo(quem, 'joinGameWaitlist', { gameId, position: 'LINE' }), { alvo: gameId });
      if (w !== undefined) espera.push(chave);
    }
  }

  // Erro humano: confirmar duas vezes (deve ser idempotente).
  if (confirmados.length > 1 && chance(0.3)) {
    const quem = await p(sortear(confirmados));
    await agir(quem, 'presenca:confirmar_de_novo', 'ok', () => chamarComo(quem, 'confirmGamePresence', { gameId, position: quem.conta.posicao, isCasualPlayer: false }), { alvo: gameId });
  }

  // ── conversa antes do jogo ──
  for (const chave of confirmados) {
    if (!chance(PERFIL[PERSONAS[chave] ?? 'casual'].conversa)) continue;
    const quem = await p(chave);
    await agir(quem, 'social:chat_jogo', 'ok', () => addDoc(collection(quem.db, 'games', gameId, 'chat'), {
      sender_id: quem.uid, sender_name: quem.nome, sender_photo_url: null,
      text: sortear(['Bora!', 'Levo a bola', 'Chego 10 min atrasado', 'Quem vai de colete?', 'Confirmado 💪']),
      created_at: agoraTs(), deleted_by: null, deleted_at: null,
    }), { alvo: gameId });
    if (chance(0.15)) {
      // Pedido de carona vai com seats null, como o web (useGameRides.ts:144).
      const tipo = chance(0.5) ? 'OFFER' : 'REQUEST';
      await agir(quem, 'social:carona', 'ok', () => setDoc(doc(quem.db, 'game_rides', `${gameId}_${quem.uid}`), {
        game_id: gameId, group_id: eg.id, user_id: quem.uid, user_name: quem.nome, user_photo: '',
        type: tipo, origin_label: 'Centro', destination_label: eg.cfg.quadra.nome,
        seats: tipo === 'OFFER' ? 3 : null, note: '', status: 'ACTIVE', updated_at: agoraTs(), created_at: agoraTs(),
      }), { alvo: gameId });
    }
  }

  // ── desistências (lista de espera deve andar) ──
  for (const chave of [...confirmados]) {
    if (chave === eg.cfg.dono) continue;
    if (!chance(PERFIL[PERSONAS[chave] ?? 'casual'].cancela)) continue;
    await cancelarPresenca(gameId, chave);
    confirmados.splice(confirmados.indexOf(chave), 1);
  }
  await pausa(3000);
  // Quem estava na espera e foi promovido passa a contar.
  const confsAgora = await db().collection('confirmations').where('game_id', '==', gameId).where('status', '==', 'CONFIRMED').get();
  const confirmadosReais = confsAgora.docs.map((c) => c.get('user_id') as string);
  const porUid = new Map(JOGADORES.map((j) => [j.emulador.uid, j.chave]));
  const lista = confirmadosReais.map((uid) => porUid.get(uid)).filter((c): c is string => Boolean(c));
  // Lista de espera: vaga aberta por desistência deve chamar o primeiro da fila.
  if (espera.length) {
    const max = Number(arg('max', '0')) || eg.cfg.maxJogadores;
    const promovidos = espera.filter((c) => lista.includes(c));
    const vagas = max - lista.length;
    registrarEvento({
      ator: 'conferencia', acao: 'espera:promocao', alvo: gameId, esperado: 'ok',
      obtido: vagas > 0 && promovidos.length < espera.length ? 'violado' : 'ok',
      msg: `${espera.length} na fila, ${promovidos.length} promovido(s), ${Math.max(0, vagas)} vaga(s) livre(s) após desistências`,
      ms: 0, achado: vagas > 0 && promovidos.length < espera.length,
    });
  }

  // ── chuva: 1 em 15 jogos é cancelado pelo dono ──
  if (chance(1 / 15)) {
    await agir(dono, 'jogo:cancelar', 'ok', () => updateDoc(doc(dono.db, 'games', gameId), { status: 'CANCELLED', updated_at: agoraTs() }), { alvo: gameId });
    return;
  }
  if (lista.length < 4) {
    registrarEvento({ ator: eg.cfg.dono, acao: 'jogo:quorum_baixo', alvo: gameId, esperado: 'ok', obtido: 'ok', msg: `${lista.length} confirmados`, ms: 0, achado: false });
    await agir(dono, 'jogo:cancelar', 'ok', () => updateDoc(doc(dono.db, 'games', gameId), { status: 'CANCELLED', updated_at: agoraTs() }), { alvo: gameId });
    return;
  }

  // ── times pelo fluxo do web (TeamFormationScreen.tsx:383-399) ──
  const embaralhados = embaralhar(lista);
  const metade = Math.ceil(embaralhados.length / 2);
  const timeA = embaralhados.slice(0, metade);
  const timeB = embaralhados.slice(metade);
  const uidsA = await Promise.all(timeA.map(async (c) => (await p(c)).uid));
  const uidsB = await Promise.all(timeB.map(async (c) => (await p(c)).uid));
  await agir(dono, 'jogo:times_web', 'ok', () => runTransaction(dono.db, async (tx) => {
    const ref = doc(dono.db, 'games', gameId);
    const snap = await tx.get(ref);
    const versao = (snap.data()?.team_formation_version as number | undefined) ?? 0;
    tx.update(ref, {
      team1_players: uidsA, team2_players: uidsB, team1_name: 'Time A', team2_name: 'Time B',
      team_formation_version: versao + 1, updated_at: agoraTs(),
    });
  }), { alvo: gameId });
  await agir(dono, 'jogo:confirmar_lista', 'ok', () => updateDoc(doc(dono.db, 'games', gameId), { status: 'CONFIRMED', updated_at: agoraTs() }), { alvo: gameId });

  // Traz o jogo para "começa daqui a 5 min" (Admin SDK, só datas).
  await pausa(3000);
  const inicio = new Date(Date.now() + 5 * 60 * 1000);
  await db().doc(`games/${gameId}`).update({ ...dataEHora(inicio), dateTime: admin.firestore.Timestamp.fromDate(inicio) });

  // ── check-in ──
  const qr = await agir(dono, 'checkin:gerar_qr', 'ok', () => chamarComo<{ token: string }>(dono, 'generateCheckinToken', { gameId }), { alvo: gameId });
  // O web não grava location_lat/lng no jogo; sem isso o check-in recusa.
  const semCoords = !(await db().doc(`games/${gameId}`).get()).get('location_lat');
  if (semCoords) {
    registrarAchado('jogo:sem_coordenadas', `jogo ${gameId} criado no formato do web sem location_lat/location_lng: checkInToGame recusa com "Jogo sem coordenadas"`, { gameId });
    // Contorno (Admin SDK) para o resto do fluxo de XP ser exercitado.
    await db().doc(`games/${gameId}`).update({ location_lat: eg.cfg.quadra.lat, location_lng: eg.cfg.quadra.lng });
  }
  for (const chave of lista) {
    if (!qr || !chance(PERFIL[PERSONAS[chave] ?? 'casual'].checkin)) continue;
    const quem = await p(chave);
    const longe = chance(0.05);
    // A function responde permission-denied para "longe do campo" (check-in.ts:609).
    await agir(quem, 'checkin:fazer', longe ? 'permission-denied' : 'ok', () => chamarComo(quem, 'checkInToGame', {
      gameId, lat: eg.cfg.quadra.lat + (longe ? 0.05 : 0.0002), lng: eg.cfg.quadra.lng, accuracy: 12, qrToken: qr.token,
    }), { alvo: gameId, dados: { longe } });
  }

  // ── início: primeiro como o web deixa o jogo (sem teams/{id}) ──
  let iniciou = await agir(dono, 'jogo:iniciar_com_times_do_web', 'ok', () => chamarComo(dono, 'startGameLifecycle', { gameId }), { alvo: gameId });
  const teamA = `${gameId}-time-a`;
  const teamB = `${gameId}-time-b`;
  if (iniciou === undefined) {
    // Formato do app nativo: teams/{id} pelo dono (regras: canOwnerMutateGameRoster).
    for (const [teamId, nome, uids] of [[teamA, 'Time A', uidsA], [teamB, 'Time B', uidsB]] as const) {
      await agir(dono, 'jogo:times_app', 'ok', () => setDoc(doc(dono.db, 'teams', teamId), {
        game_id: gameId, name: nome, color: nome === 'Time A' ? '#1976d2' : '#f57c00', player_ids: uids, score: 0,
        created_at: agoraTs(), updated_at: agoraTs(),
      }), { alvo: gameId });
    }
    iniciou = await agir(dono, 'jogo:iniciar', 'ok', () => chamarComo(dono, 'startGameLifecycle', { gameId }), { alvo: gameId });
  }
  if (iniciou === undefined) return;

  // ── eventos ao vivo ──
  const golsA = inteiro(0, 6);
  const golsB = inteiro(0, 6);
  let minuto = 3;
  const autores = new Map<string, number>();
  for (const [time, qtd, elenco] of [[teamA, golsA, timeA], [teamB, golsB, timeB]] as const) {
    for (let i = 0; i < qtd; i++) {
      const autor = await p(sortear(elenco));
      const assist = chance(0.6) && elenco.length > 1 ? await p(sortear(elenco.filter((c) => c !== autor.chave))) : null;
      autores.set(autor.chave, (autores.get(autor.chave) ?? 0) + 1);
      await agir(dono, 'aovivo:gol', 'ok', () => chamarComo(dono, 'submitLiveGameEvent', {
        gameId, requestId: `${gameId}-gol-${time}-${i}`, eventType: 'GOAL', playerId: autor.uid, playerName: autor.nome,
        teamId: time, minute: minuto, assistedById: assist?.uid ?? null, assistedByName: assist?.nome ?? null,
      }), { alvo: gameId });
      minuto += inteiro(2, 6);
      // Organizador lança um lance por vez, não 10 por segundo.
      await pausa(6500);
    }
  }
  const goleiros = lista.filter((c) => JOGADORES.find((j) => j.chave === c)?.posicao === 'GOALKEEPER');
  for (const gk of goleiros) {
    const quem = await p(gk);
    await pausa(6500);
    await agir(dono, 'aovivo:defesa', 'ok', () => chamarComo(dono, 'submitLiveGameEvent', {
      gameId, requestId: `${gameId}-defesa-${gk}`, eventType: 'SAVE', playerId: quem.uid, playerName: quem.nome,
      teamId: timeA.includes(gk) ? teamA : teamB, minute: inteiro(5, 55), assistedById: null, assistedByName: null,
    }), { alvo: gameId });
  }
  if (chance(0.3)) {
    const quem = await p(sortear(lista));
    await agir(dono, 'aovivo:amarelo', 'ok', () => chamarComo(dono, 'submitLiveGameEvent', {
      gameId, requestId: `${gameId}-amarelo`, eventType: 'YELLOW_CARD', playerId: quem.uid, playerName: quem.nome,
      teamId: timeA.includes(quem.chave) ? teamA : teamB, minute: inteiro(10, 50), assistedById: null, assistedByName: null,
    }), { alvo: gameId });
  }

  const fim = await agir(dono, 'jogo:finalizar', 'ok', () => chamarComo(dono, 'finishGameLifecycle', { gameId }), { alvo: gameId });
  if (fim === undefined) return;

  // ── placar e XP ──
  await pausa(4000);
  const finalizado = await db().doc(`games/${gameId}`).get();
  if (finalizado.get('team1_score') !== golsA || finalizado.get('team2_score') !== golsB) {
    registrarAchado('jogo:placar', `jogo ${gameId}: placar ${finalizado.get('team1_score')}x${finalizado.get('team2_score')}, eventos lançados ${golsA}x${golsB}`, { gameId });
  }

  // ── votação ──
  for (const chave of lista) {
    const perfil = PERFIL[PERSONAS[chave] ?? 'casual'];
    if (!chance(perfil.vota)) continue;
    const eleitor = await p(chave);
    const outros = lista.filter((c) => c !== chave);
    const craque = [...autores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const mvp = craque && craque !== chave && chance(0.7) ? craque : sortear(outros);
    const gk = goleiros.find((g) => g !== chave && g !== mvp);
    const pior = sortear(outros.filter((c) => c !== mvp && c !== gk));
    const votos: { votedPlayerId: string; category: string }[] = [{ votedPlayerId: (await p(mvp)).uid, category: 'MVP' }];
    if (pior && chance(0.6)) votos.push({ votedPlayerId: (await p(pior)).uid, category: 'WORST' });
    if (gk && chance(0.5)) votos.push({ votedPlayerId: (await p(gk)).uid, category: 'BEST_GOALKEEPER' });
    await agir(eleitor, 'votacao:votar', 'ok', () => chamarComo(eleitor, 'submitMvpVotes', { gameId, votes: votos }), { alvo: gameId, dados: { categorias: votos.map((v) => v.category) } });
    if (chance(0.05)) {
      await agir(eleitor, 'votacao:votar_em_si', 'invalid-argument', () => chamarComo(eleitor, 'submitMvpVotes', {
        gameId, votes: [{ votedPlayerId: eleitor.uid, category: 'MVP' }],
      }), { alvo: gameId });
    }
  }
  // Quem não jogou tenta votar (deve ser barrado).
  const naoJogou = [...eg.membros].find((c) => !lista.includes(c));
  if (naoJogou && chance(0.3)) {
    const quem = await p(naoJogou);
    await agir(quem, 'votacao:votar_sem_jogar', 'permission-denied', () => chamarComo(quem, 'submitMvpVotes', {
      gameId, votes: [{ votedPlayerId: uidsA[0], category: 'MVP' }],
    }), { alvo: gameId });
  }
  await agir(dono, 'votacao:encerrar', 'ok', () => chamarComo(dono, 'concludeMvpVoting', { gameId }), { alvo: gameId });

  // ── pós-jogo ──
  for (const chave of lista) {
    if (!chance(0.25)) continue;
    const quem = await p(chave);
    const alvo = await p(sortear(lista.filter((c) => c !== chave)));
    await agir(quem, 'posjogo:reputacao', 'ok', () => chamarComo(quem, 'submitPostGameReputation', {
      gameId, targetUserId: alvo.uid, punctuality: inteiro(3, 5), respect: inteiro(3, 5), commitment: inteiro(2, 5), comment: '',
    }), { alvo: gameId });
  }
  for (const chave of lista) {
    if (!chance(0.2)) continue;
    const quem = await p(chave);
    await agir(quem, 'social:comentario', 'ok', () => addDoc(collection(quem.db, 'games', gameId, 'comments'), {
      author_id: quem.uid, author_name: quem.nome, author_photo_url: null,
      text: sortear(['Jogão!', 'Semana que vem tem revanche', 'Que golaço do fim', 'Faltou goleiro hoje']),
      parent_id: null, created_at: agoraTs(), edited_at: null, deleted_by: null, deleted_at: null, reactions: {}, context: 'game',
    }), { alvo: gameId });
  }
  // Caixa: o dono lança o que recebeu e o aluguel. Como no web
  // (CashboxScreen.tsx:223), abrir a tela reconcilia o resumo antes do 1º lançamento.
  if (!eg.caixaReconciliado) {
    eg.caixaReconciliado = Boolean(await agir(dono, 'caixa:abrir_tela', 'ok', () => chamarComo(dono, 'reconcileCashboxSummary', { groupId: eg.id }), { alvo: eg.id }));
  }
  await agir(dono, 'caixa:entrada', 'ok', () => chamarComo(dono, 'createCashboxEntry', {
    groupId: eg.id, requestId: `${gameId}-entrada`, type: 'INCOME', amount: eg.cfg.preco * lista.length,
    description: `Mensalidade/diária ${dataEHora(inicio).date}`, receiptUrl: null,
  }), { alvo: eg.id });
  await agir(dono, 'caixa:saida', 'ok', () => chamarComo(dono, 'createCashboxEntry', {
    groupId: eg.id, requestId: `${gameId}-aluguel`, type: 'EXPENSE', amount: eg.cfg.aluguel,
    description: `Aluguel da quadra ${dataEHora(inicio).date}`, receiptUrl: null,
  }), { alvo: eg.id });
  // Um mural de vez em quando.
  if (chance(0.4)) {
    await agir(dono, 'social:mural', 'ok', () => addDoc(collection(dono.db, 'groups', eg.id!, 'wall_posts'), {
      group_id: eg.id, author_id: dono.uid, author_name: dono.nome, author_photo_url: null,
      text: `Resultado da semana ${s}: ${golsA} x ${golsB}`, media_url: null, media_path: null, media_type: null,
      thumbnail_path: null, highlight_ref: null, pinned: false, pinned_by: null, pinned_at: null, reactions: {},
      comments_count: 0, created_at: agoraTs(), updated_at: agoraTs(), edited_at: null, deleted_by: null, deleted_at: null,
    }), { alvo: eg.id });
  }
}

// ───────────────────────── vida social fora do jogo ─────────────────────────

async function semanaSocial(eg: EstadoGrupo, s: number): Promise<void> {
  if (!eg.id) return;
  const membros = [...eg.membros];
  // Enquete a cada 4 semanas.
  if (s % 4 === 2) {
    const autor = await p(eg.cfg.dono);
    const enquete = await agir(autor, 'social:enquete_criar', 'ok', () => addDoc(collection(autor.db, 'group_polls'), {
      group_id: eg.id, question: 'Mudamos o horário para 20h?',
      options: [{ id: 'option_1', text: 'Sim' }, { id: 'option_2', text: 'Não' }, { id: 'option_3', text: 'Tanto faz' }],
      created_by: autor.uid, created_by_name: autor.nome, status: 'ACTIVE', created_at: agoraTs(), updated_at: agoraTs(),
    }), { alvo: eg.id });
    if (enquete) {
      eg.enquetes.push(enquete.id);
      for (const chave of membros) {
        if (!chance(0.6)) continue;
        const quem = await p(chave);
        await agir(quem, 'social:enquete_votar', 'ok', () => setDoc(doc(quem.db, 'group_poll_votes', `${enquete.id}_${quem.uid}`), {
          poll_id: enquete.id, group_id: eg.id, option_id: sortear(['option_1', 'option_2', 'option_3']), user_id: quem.uid, updated_at: agoraTs(),
        }), { alvo: enquete.id });
      }
    }
  }
  // Seguir alguém, mandar mensagem.
  for (const chave of membros) {
    if (!chance(0.08)) continue;
    const quem = await p(chave);
    const alvo = await p(sortear(membros.filter((c) => c !== chave)));
    await agir(quem, 'social:seguir', 'ok', () => chamarComo(quem, 'toggleFollowUser', { targetUserId: alvo.uid, follow: true }), { alvo: alvo.uid });
    if (chance(0.5)) {
      const chat = await agir(quem, 'social:dm_abrir', 'ok', () => chamarComo<{ chatId: string }>(quem, 'createDirectChat', { targetUid: alvo.uid }), { alvo: alvo.uid });
      if (chat?.chatId) {
        await agir(quem, 'social:dm_enviar', 'ok', () => chamarComo(quem, 'submitDirectMessage', { chatId: chat.chatId, text: 'Bora jogar no sábado também?' }), { alvo: chat.chatId });
      }
    }
  }
  // Avaliar a quadra depois de algumas semanas.
  if (s === 5 || s === 11) {
    const quem = await p(sortear(membros));
    const locationId = idSeed(eg.cfg.quadra.chave);
    await agir(quem, 'social:avaliar_quadra', 'ok', () => setDoc(doc(quem.db, 'locations', locationId, 'reviews', quem.uid), {
      user_id: quem.uid, user_name: quem.nome, user_photo: null, rating: inteiro(3, 5), comment: 'Gramado ok, vestiário apertado', created_at: agoraTs(),
    }), { alvo: locationId });
  }
  // Denúncia rara de post do mural.
  if (s === 9) {
    const posts = await db().collection(`groups/${eg.id}/wall_posts`).limit(1).get();
    if (!posts.empty) {
      const quem = await p(sortear(membros.filter((c) => c !== eg.cfg.dono)));
      await agir(quem, 'social:denunciar', 'ok', () => chamarComo(quem, 'submitContentReport', {
        targetType: 'group_wall_post', groupId: eg.id, postId: posts.docs[0].id, reason: 'spam',
      }), { alvo: posts.docs[0].id });
    }
  }
}

// ───────────────────────── principal ─────────────────────────

async function semanaDoGrupo(eg: EstadoGrupo, s: number): Promise<void> {
  if (s === 1) await criarGrupo(eg);
  if (!eg.id) return;
  for (const e of eg.cfg.entradas.filter((x) => x.semana === s)) await entrarNoGrupo(eg, e.chave, e.via);
  for (const pr of eg.cfg.promocoes.filter((x) => x.semana === s)) await promover(eg, pr.chave);
  if (eg.cfg.joga(s)) {
    const dono = await p(eg.cfg.dono);
    const g = await db().doc(`groups/${eg.id}`).get();
    if ((g.get('member_count') ?? 0) < 5) {
      // O web bloqueia criar jogo com menos de 5 membros.
      registrarEvento({ ator: dono.chave, acao: 'jogo:grupo_pequeno', alvo: eg.id, esperado: 'ok', obtido: 'ok', msg: `member_count=${g.get('member_count')}`, ms: 0, achado: false });
    } else {
      await rodarJogo(eg, s);
    }
  }
  await semanaSocial(eg, s);
  for (const sd of eg.cfg.saidas.filter((x) => x.semana === s)) await sairDoGrupo(eg, sd.chave);
}

async function principal(): Promise<void> {
  exigirEmulador();
  iniciarAdmin();
  abrirRegistro(SAIDA);
  const inicio = Date.now();
  for (const cfg of GRUPOS_SIM.filter((g) => !SO_GRUPOS.length || SO_GRUPOS.includes(g.chave))) {
    estado.set(cfg.chave, { cfg, membros: new Set(), jogos: [], enquetes: [] });
  }
  for (let s = 1; s <= SEMANAS; s++) {
    definirSemana(s);
    const t0 = Date.now();
    // Grupos em paralelo; dentro do grupo, tudo em sequência.
    await Promise.all([...estado.values()].map((eg) => semanaDoGrupo(eg, s).catch((erro) => {
      registrarAchado('simulador:erro', `semana ${s}, grupo ${eg.cfg.chave}: ${String(erro?.stack ?? erro).slice(0, 600)}`);
    })));
    await pausa(3000);
    const grupos = [...estado.values()].map((e) => e.id).filter((x): x is string => Boolean(x));
    const inv = await conferirInvariantes(`semana ${s}`, { grupos, jogos: todosOsJogos });
    // eslint-disable-next-line no-console
    console.log(`[sim] semana ${s}/${SEMANAS}: ${Math.round((Date.now() - t0) / 1000)}s · ações ${contadores.acoes} · achados ${contadores.achados} · ritmo ${contadores.ritmo} · invariantes ${inv.violacoes}/${inv.verificados}`);
  }
  const ids = {
    grupos: Object.fromEntries([...estado.values()].map((e) => [e.cfg.chave, e.id])),
    jogos: todosOsJogos,
    // Último jogo de cada grupo: a passada web (web/e2e-sim) abre a tela dele.
    jogoDoGrupo: Object.fromEntries([...estado.values()].map((e) => [e.cfg.chave, e.jogos[e.jogos.length - 1]])),
  };
  registrarEvento({ ator: 'simulador', acao: 'fim', esperado: 'ok', obtido: 'ok', ms: Date.now() - inicio, achado: false, dados: ids });
  writeFileSync(SAIDA.replace(/\.jsonl$/, '') + '.ids.json', JSON.stringify(ids, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[sim] fim em ${Math.round((Date.now() - inicio) / 60000)} min · ${SAIDA}`);
}

principal().then(() => process.exit(0)).catch((erro) => {
  // eslint-disable-next-line no-console
  console.error('[sim] falhou:', erro);
  process.exit(1);
});
