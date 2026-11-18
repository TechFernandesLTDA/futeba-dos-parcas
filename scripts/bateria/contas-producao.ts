/**
 * Bateria de testes — contas e dados de teste no Firebase de PRODUÇÃO.
 *
 * Autorizado pelo Renan em 15/11/2026 ("tudo está em teste ainda"). Cria, e
 * apaga, só o que está na lista de scripts/bateria/contas.ts e cenario.ts:
 *   - 24 contas (`techfernandesltda+futeba-teste-NN@gmail.com`, uid
 *     `teste-futeba-NN`): 20 jogadores, 3 donos de quadra, 1 administrador;
 *   - 2 grupos privados, 3 quadras em rascunho e 2 jogos agendados.
 * Todo documento leva `isTestData: true` e `seed_id`.
 *
 * O que este script NÃO faz, de propósito:
 *   - não finaliza jogo em produção (XP e ranking de teste entrariam na liga);
 *   - não cria grupo público nem publica quadra (não aparecem para usuários);
 *   - não toca em conta ou documento que não seja `teste-futeba-*` com
 *     `isTestData: true`; a conta de revisor do Google Play fica intocada;
 *   - não guarda senha no git nem imprime senha. As senhas são geradas aqui e
 *     ficam em ~/.config/futeba/contas-teste.env (0600, pasta 0700).
 *
 * Idempotente: rodar `criar` de novo só completa o que falta.
 *
 * Uso (na raiz do repositório, com o login gcloud do Mac):
 *   NODE_PATH=functions/node_modules web/node_modules/.bin/tsx \
 *     scripts/bateria/contas-producao.ts conferir
 *   ... contas-producao.ts criar            # mostra o plano, não grava
 *   ... contas-producao.ts criar --aplicar
 *   ... contas-producao.ts apagar --aplicar
 *
 * Spec: specs/feat-2026-11-15-bateria-de-testes.md
 */

import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import * as admin from 'firebase-admin';
import { CONTAS, ContaTeste, MARCA_TESTE, PREFIXO_PRODUCAO, conta } from './contas';
import { GRUPOS, GrupoTeste, QUADRAS, idsDoAlvo } from './cenario';

const PROJETO_PRODUCAO = 'futebadosparcas';
const ARQUIVO_SENHAS = join(homedir(), '.config', 'futeba', 'contas-teste.env');
const EMAIL_DE_TESTE = /^techfernandesltda\+futeba-teste-\d{2}@gmail\.com$/;
const UID_DE_TESTE = new RegExp(`^${PREFIXO_PRODUCAO}-\\d{2}$`);
const CONTAS_INTOCAVEIS = ['techfernandesltda+futeba-revisor@gmail.com'];

/** Em produção os dois grupos são gravados como privados (`is_public: false`). */
const GRUPOS_PRODUCAO: GrupoTeste[] = GRUPOS.filter((g) => ['grupo-alfa', 'grupo-beta'].includes(g.chave));
const JOGOS_PRODUCAO = [
  { chave: 'jogo-agendado', grupo: GRUPOS_PRODUCAO[0]?.chave ?? '', quadra: 'quadra-01', emDias: 3 },
  { chave: 'jogo-agendado-2', grupo: GRUPOS_PRODUCAO[1]?.chave ?? '', quadra: 'quadra-02', emDias: 5 },
].filter((j) => j.grupo);

const id = idsDoAlvo('producao');
const agora = admin.firestore.FieldValue.serverTimestamp;
const pausa = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const registrar = (mensagem: string): void => console.log(`[bateria:producao] ${mensagem}`);

function conferirLista(): void {
  for (const c of CONTAS) {
    if (!EMAIL_DE_TESTE.test(c.producao.email) || !UID_DE_TESTE.test(c.producao.uid)) {
      throw new Error(`conta fora do padrão de teste: ${c.chave}`);
    }
    if (CONTAS_INTOCAVEIS.includes(c.producao.email)) {
      throw new Error(`a lista contém uma conta intocável: ${c.chave}`);
    }
    if (!c.nome.startsWith('Teste ')) throw new Error(`nome sem "Teste": ${c.chave}`);
  }
}

function iniciar(): void {
  for (const variavel of [
    'FIREBASE_AUTH_EMULATOR_HOST',
    'FIRESTORE_EMULATOR_HOST',
    'FIREBASE_STORAGE_EMULATOR_HOST',
    'FUNCTIONS_EMULATOR_HOST',
  ]) {
    if (process.env[variavel]) {
      throw new Error(`${variavel} está definida: este script é só de produção. Abra outro terminal.`);
    }
  }
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJETO_PRODUCAO,
  });
}

// ── Senhas: só no arquivo local, nunca na saída ────────────────────────────

const chaveSenha = (c: ContaTeste): string => `FUTEBA_TESTE_${String(c.n).padStart(2, '0')}_SENHA`;
const chaveEmail = (c: ContaTeste): string => `FUTEBA_TESTE_${String(c.n).padStart(2, '0')}_EMAIL`;

function lerSenhas(): Map<string, string> {
  const senhas = new Map<string, string>();
  if (!existsSync(ARQUIVO_SENHAS)) return senhas;
  for (const linha of readFileSync(ARQUIVO_SENHAS, 'utf8').split('\n')) {
    const corte = linha.indexOf('=');
    if (corte > 0 && !linha.startsWith('#')) senhas.set(linha.slice(0, corte), linha.slice(corte + 1));
  }
  return senhas;
}

function gravarSenhas(senhas: Map<string, string>): void {
  const pasta = dirname(ARQUIVO_SENHAS);
  mkdirSync(pasta, { recursive: true, mode: 0o700 });
  chmodSync(pasta, 0o700);
  const linhas = [
    '# Contas de teste do Futeba dos Parças em produção (bateria de testes).',
    '# Gerado por scripts/bateria/contas-producao.ts. Não versionar. Não copiar.',
  ];
  for (const c of CONTAS) {
    linhas.push(`${chaveEmail(c)}=${c.producao.email}`);
    const senha = senhas.get(chaveSenha(c));
    if (senha) linhas.push(`${chaveSenha(c)}=${senha}`);
  }
  const provisorio = `${ARQUIVO_SENHAS}.tmp`;
  writeFileSync(provisorio, `${linhas.join('\n')}\n`, { mode: 0o600 });
  chmodSync(provisorio, 0o600);
  renameSync(provisorio, ARQUIVO_SENHAS);
}

const novaSenha = (): string => `Tf-${randomBytes(18).toString('base64url')}-9a`;

// ── Leitura ────────────────────────────────────────────────────────────────

async function usuarioDoAuth(c: ContaTeste): Promise<admin.auth.UserRecord | null> {
  const auth = admin.auth();
  const porUid = await auth.getUser(c.producao.uid).catch(() => null);
  const porEmail = await auth.getUserByEmail(c.producao.email).catch(() => null);
  if (porEmail && porEmail.uid !== c.producao.uid) {
    throw new Error(`${c.chave}: o e-mail de teste já pertence a outro uid. Nada foi alterado nessa conta.`);
  }
  if (porUid && porUid.email !== c.producao.email) {
    throw new Error(`${c.chave}: o uid de teste está com outro e-mail. Nada foi alterado nessa conta.`);
  }
  return porUid;
}

async function conferir(): Promise<void> {
  const db = admin.firestore();
  const senhas = lerSenhas();
  let noAuth = 0;
  let comPapel = 0;
  let comPerfil = 0;
  let comSenha = 0;
  for (const c of CONTAS) {
    const usuario = await usuarioDoAuth(c);
    if (usuario) noAuth += 1;
    if (usuario?.customClaims?.role === c.papel) comPapel += 1;
    if ((await db.doc(`users/${c.producao.uid}`).get()).get('isTestData') === true) comPerfil += 1;
    if (senhas.has(chaveSenha(c))) comSenha += 1;
  }
  registrar(`contas no Auth: ${noAuth}/${CONTAS.length}; com o papel certo: ${comPapel}; perfis marcados: ${comPerfil}`);
  registrar(`senhas no arquivo local: ${comSenha}/${CONTAS.length} (${existsSync(ARQUIVO_SENHAS) ? 'arquivo existe' : 'arquivo ausente'})`);
  for (const [colecao, chaves] of [
    ['groups', GRUPOS_PRODUCAO.map((g) => g.chave)],
    ['locations', QUADRAS.map((q) => q.chave)],
    ['games', JOGOS_PRODUCAO.map((j) => j.chave)],
  ] as const) {
    let existentes = 0;
    for (const chave of chaves) {
      if ((await db.doc(`${colecao}/${id(chave)}`).get()).get('isTestData') === true) existentes += 1;
    }
    registrar(`${colecao}: ${existentes}/${chaves.length}`);
  }
}

// ── Criação ────────────────────────────────────────────────────────────────

async function criarContas(): Promise<void> {
  const auth = admin.auth();
  const db = admin.firestore();
  const senhas = lerSenhas();
  let criadas = 0;

  for (const c of CONTAS) {
    const existente = await usuarioDoAuth(c);
    if (!existente) {
      const senha = senhas.get(chaveSenha(c)) ?? novaSenha();
      senhas.set(chaveSenha(c), senha);
      gravarSenhas(senhas);
      await auth.createUser({
        uid: c.producao.uid,
        email: c.producao.email,
        password: senha,
        displayName: c.nome,
        emailVerified: true,
      });
      criadas += 1;
    } else if (!senhas.has(chaveSenha(c))) {
      // Conta de teste sem senha conhecida neste Mac: gera outra.
      const senha = novaSenha();
      senhas.set(chaveSenha(c), senha);
      gravarSenhas(senhas);
      await auth.updateUser(c.producao.uid, { password: senha });
    }
  }
  gravarSenhas(senhas);
  registrar(`contas no Auth: ${criadas} criadas, ${CONTAS.length - criadas} já existiam`);

  // O perfil nasce do gatilho real onUserCreate; aqui só se completa.
  for (const c of CONTAS) {
    const ref = db.doc(`users/${c.producao.uid}`);
    for (let tentativa = 0; tentativa < 40 && !(await ref.get()).exists; tentativa += 1) await pausa(500);
    await ref.set(
      {
        name: c.nome,
        nickname: c.apelido,
        email: c.producao.email,
        role: c.papel,
        preferred_position: c.posicao === 'GOALKEEPER' ? 'GOLEIRO' : 'MEIA',
        preferred_field_types: ['SOCIETY'],
        is_searchable: false,
        updated_at: agora(),
        ...MARCA_TESTE,
      },
      { merge: true },
    );
  }

  // Claims por último, e conferidas: o gatilho de criação também grava claims.
  for (let rodada = 0; rodada < 3; rodada += 1) {
    let acertos = 0;
    for (const c of CONTAS) {
      const atuais = (await auth.getUser(c.producao.uid)).customClaims ?? {};
      if (atuais.role === c.papel && atuais.verified === true && atuais.profileComplete === true) {
        acertos += 1;
        continue;
      }
      await auth.setCustomUserClaims(c.producao.uid, {
        ...atuais,
        role: c.papel,
        verified: true,
        profileComplete: true,
      });
    }
    if (acertos === CONTAS.length) break;
    await pausa(4000);
  }
  registrar('perfis e claims (papel, verified, profileComplete) aplicados');
}

async function criarQuadras(): Promise<void> {
  const db = admin.firestore();
  for (const quadra of QUADRAS) {
    const dono = conta(quadra.dono).producao.uid;
    const locationId = id(quadra.chave);
    await db.doc(`locations/${locationId}`).set(
      {
        name: quadra.nome,
        address: quadra.endereco,
        city: quadra.cidade,
        state: 'PR',
        country: 'BR',
        lat: quadra.lat,
        lng: quadra.lng,
        latitude: quadra.lat,
        longitude: quadra.lng,
        owner_id: dono,
        managers: [dono],
        is_verified: false,
        is_active: true,
        rating: 0,
        rating_count: 0,
        // Rascunho: não entra no catálogo público.
        publication_status: 'DRAFT',
        commercial_status: 'TRIAL',
        subscription_status: 'TRIAL',
        field_count: 1,
        updated_at: agora(),
        ...MARCA_TESTE,
      },
      { merge: true },
    );
    await db.doc(`locations/${locationId}/fields/${locationId}-campo`).set(
      {
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
        managers: [dono],
        updated_at: agora(),
        ...MARCA_TESTE,
      },
      { merge: true },
    );
  }
  registrar(`${QUADRAS.length} quadras em rascunho`);
}

async function criarGrupos(): Promise<void> {
  const db = admin.firestore();
  for (const grupo of GRUPOS_PRODUCAO) {
    const groupId = id(grupo.chave);
    const dono = conta(grupo.dono);
    const refGrupo = db.doc(`groups/${groupId}`);
    const existe = (await refGrupo.get()).exists;
    await refGrupo.set(
      {
        name: grupo.nome,
        description: grupo.descricao,
        is_public: false,
        type: 'FRIENDS',
        owner_id: dono.producao.uid,
        owner_name: dono.nome,
        admin_ids: [dono.producao.uid, ...grupo.admins.map((a) => conta(a).producao.uid)],
        members: [dono.producao.uid],
        status: 'ACTIVE',
        updated_at: agora(),
        // O contador é do servidor (gatilho onMemberWritten): só nasce zerado.
        ...(existe ? {} : { member_count: 0, created_at: agora() }),
        ...MARCA_TESTE,
      },
      { merge: true },
    );
    for (const chave of grupo.membros) {
      const membro = conta(chave);
      const papel = chave === grupo.dono ? 'OWNER' : grupo.admins.includes(chave) ? 'ADMIN' : 'MEMBER';
      const legado = grupo.membrosLegados.includes(chave);
      const refMembro = db.doc(`groups/${groupId}/members/${membro.producao.uid}`);
      if (!(await refMembro.get()).exists) {
        await refMembro.set({
          // Campo `id` gravado de propósito: reproduz os documentos antigos.
          ...(legado ? { id: membro.producao.uid } : {}),
          user_id: membro.producao.uid,
          user_name: membro.nome,
          user_photo: null,
          role: papel,
          status: 'ACTIVE',
          joined_at: agora(),
          ...MARCA_TESTE,
        });
      }
      await db.doc(`users/${membro.producao.uid}/groups/${groupId}`).set(
        {
          ...(legado ? { id: groupId } : {}),
          group_id: groupId,
          group_name: grupo.nome,
          group_photo: null,
          role: papel,
          member_count: grupo.membros.length,
          ...MARCA_TESTE,
        },
        { merge: true },
      );
    }
  }
  registrar(`${GRUPOS_PRODUCAO.length} grupos privados com membros`);
}

async function criarJogos(): Promise<void> {
  const db = admin.firestore();
  for (const jogo of JOGOS_PRODUCAO) {
    const grupo = GRUPOS_PRODUCAO.find((g) => g.chave === jogo.grupo)!;
    const quadra = QUADRAS.find((q) => q.chave === jogo.quadra)!;
    const dono = conta(grupo.dono);
    const inicio = new Date(Date.now() + jogo.emDias * 24 * 60 * 60 * 1000);
    inicio.setHours(20, 0, 0, 0);
    const locationId = id(quadra.chave);
    const refJogo = db.doc(`games/${id(jogo.chave)}`);
    const atual = await refJogo.get();
    if (atual.exists && atual.get('status') !== 'SCHEDULED') continue;
    await refJogo.set(
      {
        date: inicio.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
        time: '20:00',
        dateTime: admin.firestore.Timestamp.fromDate(inicio),
        duration_minutes: 60,
        status: 'SCHEDULED',
        visibility: 'GROUP_ONLY',
        is_public: false,
        max_players: 12,
        max_goalkeepers: 2,
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
        group_id: id(grupo.chave),
        group_name: grupo.nome,
        owner_id: dono.producao.uid,
        owner_name: dono.nome,
        co_organizers: [],
        confirmation_deadline_hours: 0,
        voting_concluded: false,
        post_game_report_generated: false,
        auto_closed: false,
        updated_at: agora(),
        ...(atual.exists
          ? {}
          : { players_count: 0, goalkeepers_count: 0, players: [], team1_score: 0, team2_score: 0, created_at: agora() }),
        ...MARCA_TESTE,
      },
      { merge: true },
    );
  }
  registrar(`${JOGOS_PRODUCAO.length} jogos agendados (só do grupo)`);
}

// ── Remoção ────────────────────────────────────────────────────────────────

async function apagarSeForDeTeste(caminho: string): Promise<boolean> {
  const db = admin.firestore();
  const ref = db.doc(caminho);
  const snap = await ref.get();
  if (!snap.exists) return false;
  if (snap.get('isTestData') !== true) {
    registrar(`MANTIDO (sem isTestData): ${caminho}`);
    return false;
  }
  await db.recursiveDelete(ref);
  return true;
}

async function apagar(): Promise<void> {
  const db = admin.firestore();
  const auth = admin.auth();
  let documentos = 0;

  for (const jogo of JOGOS_PRODUCAO) {
    const gameId = id(jogo.chave);
    const confirmacoes = await db.collection('confirmations').where('game_id', '==', gameId).get();
    for (const doc of confirmacoes.docs) {
      if (UID_DE_TESTE.test(String(doc.get('user_id')))) {
        await doc.ref.delete();
        documentos += 1;
      }
    }
    if (await apagarSeForDeTeste(`games/${gameId}`)) documentos += 1;
  }
  for (const grupo of GRUPOS_PRODUCAO) {
    if (await apagarSeForDeTeste(`groups/${id(grupo.chave)}`)) documentos += 1;
  }
  for (const quadra of QUADRAS) {
    if (await apagarSeForDeTeste(`locations/${id(quadra.chave)}`)) documentos += 1;
  }
  let contas = 0;
  for (const c of CONTAS) {
    const usuario = await usuarioDoAuth(c);
    if (await apagarSeForDeTeste(`users/${c.producao.uid}`)) documentos += 1;
    if (await apagarSeForDeTeste(`users_private/${c.producao.uid}`)) documentos += 1;
    if (usuario) {
      await auth.deleteUser(c.producao.uid);
      contas += 1;
    }
  }
  registrar(`apagado: ${contas} contas do Auth e ${documentos} documentos de teste`);
  registrar(`o arquivo de senhas (${ARQUIVO_SENHAS.replace(homedir(), '~')}) não é apagado por este script`);
}

// ── Entrada ────────────────────────────────────────────────────────────────

async function principal(): Promise<void> {
  const [comando] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const aplicar = process.argv.includes('--aplicar');
  conferirLista();

  if (!['conferir', 'criar', 'apagar'].includes(comando ?? '')) {
    console.log('uso: contas-producao.ts conferir | criar [--aplicar] | apagar [--aplicar]');
    process.exitCode = 2;
    return;
  }
  if (comando !== 'conferir' && !aplicar) {
    registrar(`plano de "${comando}" em ${PROJETO_PRODUCAO} (nada gravado; use --aplicar):`);
    registrar(`  ${CONTAS.length} contas ${CONTAS[0].producao.email} … ${CONTAS[CONTAS.length - 1].producao.email}`);
    registrar(`  ${GRUPOS_PRODUCAO.length} grupos privados, ${QUADRAS.length} quadras em rascunho, ${JOGOS_PRODUCAO.length} jogos agendados`);
    return;
  }

  iniciar();
  if (comando === 'conferir') {
    await conferir();
  } else if (comando === 'criar') {
    await criarContas();
    await criarQuadras();
    await criarGrupos();
    await criarJogos();
    await conferir();
  } else {
    await apagar();
  }
}

principal()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((erro: unknown) => {
    // Só a mensagem: o objeto de erro do Admin SDK pode carregar dados da requisição.
    console.error(`[bateria:producao] ERRO: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exit(1);
  });
