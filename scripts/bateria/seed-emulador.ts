/**
 * Bateria de testes — seed reproduzível no Firebase Emulator Suite.
 *
 * Cria 20 jogadores, 3 donos de quadra, 1 administrador, 3 quadras, 3 grupos e
 * 6 jogos (SCHEDULED, CONFIRMED, LIVE, FINISHED com MVP e XP, FINISHED com XP
 * retido para revisão e um público).
 *
 * Sempre que existe um escritor real, o dado sai dele:
 *   - `users/{uid}`            → trigger de Auth `onUserCreate`
 *   - claim `profileComplete`  → trigger `onUserProfileWritten`
 *   - claim `verified`         → callable `setUserVerified`
 *   - papel FIELD_OWNER        → callable `setUserRole` (chamada pelo ADMIN)
 *   - dono da quadra           → callable `assignLocationOwner`
 *   - `member_count` do grupo  → trigger `onMemberWritten`
 *   - confirmações de presença → callable `confirmGamePresence`
 *   - check-in por QR          → `generateCheckinToken` e `checkInToGame`
 *   - início, gols e fim       → `startGameLifecycle`, `submitLiveGameEvent`, `finishGameLifecycle`
 *   - XP e estatísticas        → trigger `onGameStatusUpdate`
 *   - votos e MVP              → `submitMvpVotes` e `concludeMvpVoting`
 *
 * O Admin SDK grava direto só o que no app sai do cliente (grupo, quadra,
 * jogo, times) ou de serviço externo (CPF verificado), no mesmo formato.
 *
 * De propósito, alguns documentos de `users/{uid}/groups` e
 * `groups/{id}/members` levam o campo `id` no corpo (formato legado).
 *
 * Uso (com os emuladores no ar e as variáveis definidas):
 *   NODE_PATH=functions/node_modules web/node_modules/.bin/tsx scripts/bateria/seed-emulador.ts --limpar
 *
 * Spec: specs/feat-2026-11-15-bateria-de-testes.md
 */

import * as admin from 'firebase-admin';
import {
  ADMIN,
  CONTAS,
  ContaTeste,
  DONOS,
  MARCA_TESTE,
  SENHA_EMULADOR,
  conta,
} from './contas';
import {
  CONVITE_GRUPO_BETA,
  GRUPOS,
  GrupoTeste,
  JOGOS,
  JogoTeste,
  QUADRAS,
  timesDoJogo,
  idsDoAlvo,
} from './cenario';
import {
  chamar,
  entrar,
  esperar,
  esquecerTokens,
  iniciarAdmin,
  limparEmulador,
  pausa,
} from './emulador';

const id = idsDoAlvo('emulador');
const agora = admin.firestore.FieldValue.serverTimestamp;

function registrar(mensagem: string): void {
  // eslint-disable-next-line no-console
  console.log(`[bateria:seed] ${mensagem}`);
}

const tokenDe = (c: ContaTeste, renovar = false): Promise<string> =>
  entrar(c.emulador.email, SENHA_EMULADOR, renovar);

// ───────────────────────── contas ─────────────────────────

async function criarContas(): Promise<void> {
  const auth = admin.auth();
  const db = admin.firestore();

  for (const c of CONTAS) {
    await auth.createUser({
      uid: c.emulador.uid,
      email: c.emulador.email,
      password: SENHA_EMULADOR,
      displayName: c.nome,
      phoneNumber: c.emulador.telefone,
      emailVerified: true,
    });
  }
  registrar(`${CONTAS.length} contas criadas no Auth`);

  // O perfil nasce do trigger real `onUserCreate`; o seed só espera.
  for (const c of CONTAS) {
    await esperar(`users/${c.emulador.uid} criado por onUserCreate`, async () => {
      const snap = await db.doc(`users/${c.emulador.uid}`).get();
      return snap.exists && snap.get('created_at') ? true : null;
    });
  }
  registrar('perfis criados pelo trigger onUserCreate');

  // Complementa o perfil como o app faria e marca o CPF como verificado (no
  // app isso sai da callable verifyCpf, que depende de serviço externo).
  for (const c of CONTAS) {
    await db.doc(`users/${c.emulador.uid}`).set(
      {
        name: c.nome,
        nickname: c.apelido,
        preferred_position: c.posicao === 'GOALKEEPER' ? 'GOLEIRO' : 'MEIA',
        preferred_field_types: ['SOCIETY'],
        is_searchable: true,
        cpf_verified: true,
        phone_verified: true,
        cpfVerifiedAt: agora(),
        updated_at: agora(),
        ...MARCA_TESTE,
      },
      { merge: true },
    );
    await db.doc(`users_private/${c.emulador.uid}`).set(
      { cpfVerifiedAt: agora(), ...MARCA_TESTE },
      { merge: true },
    );
  }

  for (const c of CONTAS) {
    await esperar(`claim profileComplete de ${c.chave}`, async () => {
      const registro = await auth.getUser(c.emulador.uid);
      return registro.customClaims?.profileComplete === true ? true : null;
    });
  }
  registrar('claim profileComplete aplicada pelo trigger onUserProfileWritten');

  // Cada conta conclui a própria verificação pela callable real.
  for (const c of CONTAS) {
    await chamar('setUserVerified', await tokenDe(c, true), { uid: c.emulador.uid });
  }
  registrar('claim verified aplicada pela callable setUserVerified');
}

async function definirPapeis(): Promise<void> {
  const auth = admin.auth();
  const db = admin.firestore();

  // O primeiro ADMIN não tem quem o promova: é a única claim gravada direto.
  const claimsAdmin = (await auth.getUser(ADMIN.emulador.uid)).customClaims ?? {};
  await auth.setCustomUserClaims(ADMIN.emulador.uid, { ...claimsAdmin, role: 'ADMIN' });
  await db.doc(`users/${ADMIN.emulador.uid}`).set({ role: 'ADMIN', updated_at: agora() }, { merge: true });

  const tokenAdmin = await tokenDe(ADMIN, true);
  for (const dono of DONOS) {
    await chamar('setUserRole', tokenAdmin, { uid: dono.emulador.uid, role: 'FIELD_OWNER' });
  }

  for (const c of CONTAS) {
    await esperar(`claim role=${c.papel} de ${c.chave}`, async () => {
      const claims = (await auth.getUser(c.emulador.uid)).customClaims ?? {};
      return claims.role === c.papel && claims.profileComplete === true && claims.verified === true
        ? true
        : null;
    });
  }
  esquecerTokens();
  registrar('papéis prontos: 20 PLAYER, 3 FIELD_OWNER (setUserRole), 1 ADMIN');
}

// ───────────────────────── quadras ─────────────────────────

async function criarQuadras(): Promise<void> {
  const db = admin.firestore();
  const tokenAdmin = await tokenDe(ADMIN);

  for (const quadra of QUADRAS) {
    const dono = conta(quadra.dono);
    const locationId = id(quadra.chave);
    // Mesmo formato do LocationFormScreen (web). Nasce em nome do ADMIN e o
    // dono real é atribuído pela callable assignLocationOwner.
    await db.doc(`locations/${locationId}`).set({
      name: quadra.nome,
      address: quadra.endereco,
      city: quadra.cidade,
      state: 'PR',
      country: 'BR',
      lat: quadra.lat,
      lng: quadra.lng,
      latitude: quadra.lat,
      longitude: quadra.lng,
      owner_id: ADMIN.emulador.uid,
      managers: [dono.emulador.uid],
      is_verified: true,
      is_active: true,
      rating: 0,
      rating_count: 0,
      publication_status: 'PUBLISHED',
      commercial_status: 'TRIAL',
      subscription_status: 'TRIAL',
      field_count: 1,
      created_at: agora(),
      updated_at: agora(),
      ...MARCA_TESTE,
    });
    await db.doc(`locations/${locationId}/fields/${locationId}-campo`).set({
      name: quadra.campo.nome,
      location_id: locationId,
      type: quadra.campo.tipo,
      is_active: true,
      hourly_price: quadra.campo.precoHora,
      price_per_hour: quadra.campo.precoHora,
      players_per_team: 5,
      is_covered: false,
      amenities: [],
      photos: [],
      photo_url: null,
      managers: [dono.emulador.uid],
      created_at: agora(),
      updated_at: agora(),
      ...MARCA_TESTE,
    });
    await chamar('assignLocationOwner', tokenAdmin, {
      locationId,
      newOwnerId: dono.emulador.uid,
      reason: 'Seed da bateria de testes',
    });
  }
  registrar(`${QUADRAS.length} quadras criadas e atribuídas aos donos (assignLocationOwner)`);
}

// ───────────────────────── grupos ─────────────────────────

function papelNoGrupo(grupo: GrupoTeste, chave: string): 'OWNER' | 'ADMIN' | 'MEMBER' {
  if (chave === grupo.dono) return 'OWNER';
  return grupo.admins.includes(chave) ? 'ADMIN' : 'MEMBER';
}

async function criarGrupos(): Promise<void> {
  const db = admin.firestore();

  for (const grupo of GRUPOS) {
    const groupId = id(grupo.chave);
    const dono = conta(grupo.dono);

    // Mesmo formato do useCreateGroup (web): member_count nasce 0 e é o
    // trigger onMemberWritten que conta os membros ativos.
    await db.doc(`groups/${groupId}`).set({
      name: grupo.nome,
      description: grupo.descricao,
      is_public: grupo.publico,
      type: 'FRIENDS',
      owner_id: dono.emulador.uid,
      owner_name: dono.nome,
      admin_ids: [dono.emulador.uid, ...grupo.admins.map((a) => conta(a).emulador.uid)],
      member_count: 0,
      members: [dono.emulador.uid],
      status: 'ACTIVE',
      created_at: agora(),
      updated_at: agora(),
      ...MARCA_TESTE,
    });

    for (const chave of grupo.membros) {
      const membro = conta(chave);
      const papel = papelNoGrupo(grupo, chave);
      const legado = grupo.membrosLegados.includes(chave);

      await db.doc(`groups/${groupId}/members/${membro.emulador.uid}`).set({
        // LEGADO: `id` no corpo do documento (o modelo usa @DocumentId).
        ...(legado ? { id: membro.emulador.uid } : {}),
        user_id: membro.emulador.uid,
        user_name: membro.nome,
        user_photo: null,
        role: papel,
        status: 'ACTIVE',
        joined_at: agora(),
        ...MARCA_TESTE,
      });
      await db.doc(`users/${membro.emulador.uid}/groups/${groupId}`).set({
        // LEGADO: `id` no corpo do documento (o modelo usa @DocumentId).
        ...(legado ? { id: groupId } : {}),
        group_id: groupId,
        group_name: grupo.nome,
        group_photo: null,
        role: papel,
        member_count: grupo.membros.length,
        joined_at: agora(),
        ...MARCA_TESTE,
      });
    }
  }

  for (const grupo of GRUPOS) {
    await esperar(`member_count de ${grupo.chave} = ${grupo.membros.length}`, async () => {
      const snap = await db.doc(`groups/${id(grupo.chave)}`).get();
      return snap.get('member_count') === grupo.membros.length ? true : null;
    });
  }

  const beta = GRUPOS.find((g) => g.chave === 'grupo-beta')!;
  const validade = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.doc(`invites/${CONVITE_GRUPO_BETA}`).set({
    code: CONVITE_GRUPO_BETA,
    group_id: id(beta.chave),
    group_name: beta.nome,
    inviter_id: conta(beta.dono).emulador.uid,
    inviter_name: conta(beta.dono).nome,
    created_at: agora(),
    expires_at: admin.firestore.Timestamp.fromDate(validade),
    used: false,
    ...MARCA_TESTE,
  });

  registrar(`${GRUPOS.length} grupos criados; member_count contado pelo trigger onMemberWritten`);
}

// ───────────────────────── jogos ─────────────────────────

function dataEHora(instante: Date): { date: string; time: string } {
  const doisDigitos = (n: number): string => String(n).padStart(2, '0');
  return {
    date: `${instante.getFullYear()}-${doisDigitos(instante.getMonth() + 1)}-${doisDigitos(instante.getDate())}`,
    time: `${doisDigitos(instante.getHours())}:${doisDigitos(instante.getMinutes())}`,
  };
}

async function criarJogo(jogo: JogoTeste): Promise<void> {
  const db = admin.firestore();
  const gameId = id(jogo.chave);
  const dono = conta(jogo.dono);
  const grupo = GRUPOS.find((g) => g.chave === jogo.grupo)!;
  const quadra = QUADRAS.find((q) => q.chave === jogo.quadra)!;
  const locationId = id(quadra.chave);
  const refJogo = db.doc(`games/${gameId}`);

  // confirmGamePresence só aceita jogo no futuro, e o detector de sobreposição
  // marca quem confirma dois jogos no mesmo horário. Cada jogo nasce numa
  // janela futura própria e o relógio é ajustado depois das confirmações.
  const indice = JOGOS.findIndex((item) => item.chave === jogo.chave);
  const inicioProvisorio = new Date(Date.now() + (6 + indice * 3) * 60 * 60 * 1000);

  // Mesmo formato do useCreateGame (web).
  await refJogo.set({
    ...dataEHora(inicioProvisorio),
    dateTime: admin.firestore.Timestamp.fromDate(inicioProvisorio),
    duration_minutes: 60,
    status: 'SCHEDULED',
    visibility: jogo.visibilidade,
    is_public: jogo.visibilidade !== 'GROUP_ONLY',
    max_players: 12,
    max_goalkeepers: 2,
    players_count: 0,
    goalkeepers_count: 0,
    players: [],
    game_type: 'Society',
    gender: 'MIXED',
    field_type: quadra.campo.tipo,
    recurrence: 'none',
    location_id: locationId,
    field_id: `${locationId}-campo`,
    location_name: quadra.nome,
    location_address: quadra.endereco,
    location_lat: quadra.lat,
    location_lng: quadra.lng,
    field_name: quadra.campo.nome,
    daily_price: 0,
    total_cost: 0,
    pix_key: '',
    pix_payment_enabled: false,
    number_of_teams: 2,
    team1_name: 'Time Azul',
    team2_name: 'Time Laranja',
    team1_score: 0,
    team2_score: 0,
    group_id: id(grupo.chave),
    group_name: grupo.nome,
    owner_id: dono.emulador.uid,
    owner_name: dono.nome,
    co_organizers: [],
    confirmation_deadline_hours: 0,
    voting_concluded: false,
    post_game_report_generated: false,
    auto_closed: false,
    created_at: agora(),
    updated_at: agora(),
    ...MARCA_TESTE,
  });

  for (const chave of jogo.confirmados) {
    const c = conta(chave);
    await chamar('confirmGamePresence', await tokenDe(c), {
      gameId,
      position: c.posicao,
      isCasualPlayer: false,
    });
  }

  // O trigger onConfirmationCreated (detector de sobreposição) roda depois da
  // callable. Espera a fila do emulador esvaziar antes de mexer no relógio,
  // senão ele compararia o horário final com o dos outros jogos.
  await pausa(4_000);
  await ajustarRelogio(jogo);
  if (jogo.estado === 'SCHEDULED') return;

  // Lista fechada e times sorteados: no app é o organizador que grava.
  const timeA = `${gameId}-time-azul`;
  const timeB = `${gameId}-time-laranja`;
  const escalacao = timesDoJogo(jogo);
  const idsTimeA = escalacao.timeA.map((chave) => conta(chave).emulador.uid);
  const idsTimeB = escalacao.timeB.map((chave) => conta(chave).emulador.uid);
  for (const [teamId, nome, cor, jogadores] of [
    [timeA, 'Time Azul', '#1976d2', idsTimeA],
    [timeB, 'Time Laranja', '#f57c00', idsTimeB],
  ] as const) {
    await db.doc(`teams/${teamId}`).set({
      game_id: gameId,
      name: nome,
      color: cor,
      player_ids: jogadores,
      score: 0,
      created_at: agora(),
      updated_at: agora(),
      ...MARCA_TESTE,
    });
    for (const uid of jogadores) {
      await db.doc(`confirmations/${gameId}_${uid}`).set({ team_id: teamId }, { merge: true });
    }
  }
  await refJogo.update({ status: 'CONFIRMED', updated_at: agora() });
  if (jogo.estado === 'CONFIRMED') return;

  const tokenDono = await tokenDe(dono);

  // Check-in por QR: o dono gera o token e cada jogador faz check-in na quadra.
  if (!jogo.semCheckin) {
    const { token: qrToken } = await chamar<{ token: string }>('generateCheckinToken', tokenDono, { gameId });
    for (const chave of jogo.confirmados) {
      await chamar('checkInToGame', await tokenDe(conta(chave)), {
        gameId,
        lat: quadra.lat,
        lng: quadra.lng,
        accuracy: 10,
        qrToken,
      });
    }
  }

  await chamar('startGameLifecycle', tokenDono, { gameId });

  let minuto = 5;
  for (const gol of jogo.gols ?? []) {
    const autor = conta(gol.autor);
    const assistente = gol.assistente ? conta(gol.assistente) : null;
    await chamar('submitLiveGameEvent', tokenDono, {
      gameId,
      requestId: `${gameId}-gol-${minuto}`,
      eventType: 'GOAL',
      playerId: autor.emulador.uid,
      playerName: autor.nome,
      teamId: escalacao.timeA.includes(gol.autor) ? timeA : timeB,
      minute: minuto,
      assistedById: assistente?.emulador.uid ?? null,
      assistedByName: assistente?.nome ?? null,
    });
    minuto += 9;
  }
  if (jogo.estado === 'LIVE') return;

  await chamar('finishGameLifecycle', tokenDono, { gameId });

  if (jogo.semCheckin) {
    // Sem check-in o validador retém o XP para revisão do administrador.
    await esperar(`XP do ${jogo.chave} retido para revisão`, async () => {
      const snap = await refJogo.get();
      return snap.get('xp_reward_status') === 'HELD_FOR_REVIEW' ? true : null;
    }, 90_000);
    return;
  }

  // XP e estatísticas saem do trigger onGameStatusUpdate.
  await esperar(`XP do ${jogo.chave} processado por onGameStatusUpdate`, async () => {
    const logs = await db.collection('xp_logs').where('game_id', '==', gameId).get();
    return logs.size >= jogo.confirmados.length ? true : null;
  }, 90_000);

  if (jogo.mvp) {
    const mvp = conta(jogo.mvp);
    const segundoMaisVotado = conta(jogo.confirmados.find((chave) => chave !== jogo.mvp)!);
    for (const chave of jogo.confirmados) {
      const eleitor = conta(chave);
      const votado = chave === jogo.mvp ? segundoMaisVotado : mvp;
      await chamar('submitMvpVotes', await tokenDe(eleitor), {
        gameId,
        votes: [{ votedPlayerId: votado.emulador.uid, category: 'MVP' }],
      });
    }
    await chamar('concludeMvpVoting', tokenDono, { gameId });
    await esperar(`MVP do ${jogo.chave} gravado`, async () => {
      const snap = await refJogo.get();
      return snap.get('mvp_id') === mvp.emulador.uid ? true : null;
    }, 60_000);
  }
}

/**
 * Move o início do jogo para o horário do cenário (por exemplo, "há 62
 * minutos" no jogo finalizado). Só mexe em campos de data.
 */
async function ajustarRelogio(jogo: JogoTeste): Promise<void> {
  const inicio = new Date(Date.now() + jogo.inicioEmMinutos * 60 * 1000);
  await admin.firestore().doc(`games/${id(jogo.chave)}`).update({
    ...dataEHora(inicio),
    dateTime: admin.firestore.Timestamp.fromDate(inicio),
  });
}

async function criarJogos(): Promise<void> {
  for (const jogo of JOGOS) {
    await criarJogo(jogo);
    registrar(`jogo ${jogo.chave} pronto em ${jogo.estado}${jogo.semCheckin ? ' (XP retido)' : ''}`);
  }
}

// ───────────────────────── principal ─────────────────────────

export async function seedBateria(opcoes: { limpar: boolean }): Promise<void> {
  iniciarAdmin();
  const db = admin.firestore();
  const marcador = db.doc('bateria_meta/seed');

  if (opcoes.limpar) {
    await limparEmulador();
    esquecerTokens();
    registrar('emulador limpo (Auth e Firestore)');
  } else if ((await marcador.get()).exists) {
    registrar('seed já aplicado; use --limpar para refazer do zero');
    return;
  }

  const inicio = Date.now();
  await criarContas();
  await definirPapeis();
  await criarQuadras();
  await criarGrupos();
  await criarJogos();
  await marcador.set({ aplicado_em: agora(), contas: CONTAS.length, ...MARCA_TESTE });
  registrar(`seed concluído em ${Math.round((Date.now() - inicio) / 1000)}s`);
}

const executadoDireto = process.argv[1]?.endsWith('seed-emulador.ts') ?? false;

if (executadoDireto) {
  seedBateria({ limpar: process.argv.includes('--limpar') })
    .then(() => process.exit(0))
    .catch((erro) => {
      // eslint-disable-next-line no-console
      console.error('[bateria:seed] falhou:', erro);
      process.exit(1);
    });
}
