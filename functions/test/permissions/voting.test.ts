/**
 * Votação pós-jogo (UC7): MVP, Bola Murcha, goleiro destaque, voto duplicado,
 * voto de quem não jogou, janela de votação e encerramento pelo organizador.
 * Callables: submitMvpVote, submitMvpVotes, concludeMvpVoting.
 */

jest.mock("firebase-functions", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions/v2", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions/v2/https", () => require("./_fake-runtime").httpsModule);
jest.mock("firebase-admin/firestore", () => require("./_fake-firestore"));
jest.mock("firebase-admin", () => require("./_fake-runtime").adminModule(() => require("./_fake-firestore").db()));
jest.mock("../../src/_db", () => ({db: () => require("./_fake-firestore").db()}));
jest.mock("../../src/middleware/rate-limiter");

import {checkRateLimit} from "../../src/middleware/rate-limiter";
import {resetFakeDb, seed, read, tsOf} from "./_fake-firestore";

const {submitMvpVote, submitMvpVotes, concludeMvpVoting} = require("../../src/voting/mvp-voting");

const RL_OK = {allowed: true, remaining: 10, resetAt: new Date(Date.now() + 60_000)};
const HOUR_MS = 60 * 60 * 1000;
const GAME = "game-1";
const PLAYER_TOKEN = {profileComplete: true, verified: true};

async function expectCode(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => undefined,
    (e: {code?: string}) => e
  );
  expect(err).toBeDefined();
  expect((err as {code: string}).code).toBe(code);
}

/** Jogo finalizado há 2h, dentro da janela de votação (90 min + 24 h). */
function seedFinishedGame(overrides: Record<string, unknown> = {}) {
  seed(`games/${GAME}`, {
    status: "FINISHED",
    owner_id: "owner-1",
    co_organizers: ["co-1"],
    group_id: "g1",
    dateTime: tsOf(Date.now() - 2 * HOUR_MS),
    duration_minutes: 90,
    voting_status: "OPEN",
    team1_score: 3,
    team2_score: 2,
    ...overrides,
  });
}

function seedConfirmed(uid: string, extra: Record<string, unknown> = {}) {
  seed(`confirmations/${GAME}_${uid}`, {
    game_id: GAME,
    user_id: uid,
    status: "CONFIRMED",
    position: "FIELD",
    ...extra,
  });
}

const vote = (voter: string, votedPlayerId: string, category: string, gameId = GAME, token = PLAYER_TOKEN) =>
  submitMvpVote({
    auth: {uid: voter, token},
    data: {gameId, votedPlayerId, category},
  });

const batch = (voter: string, votes: Array<{votedPlayerId: string; category: string}>, token = PLAYER_TOKEN) =>
  submitMvpVotes({
    auth: {uid: voter, token},
    data: {gameId: GAME, votes},
  });

const conclude = (uid: string | null, token: Record<string, unknown> = PLAYER_TOKEN) =>
  concludeMvpVoting({
    auth: uid ? {uid, token} : undefined,
    data: {gameId: GAME},
  });

beforeEach(() => {
  resetFakeDb();
  jest.clearAllMocks();
  (checkRateLimit as jest.Mock).mockResolvedValue(RL_OK);
  seedFinishedGame();
  seedConfirmed("p1");
  seedConfirmed("p2");
  seedConfirmed("p3");
});

describe("submitMvpVote - voto individual por categoria (UC7)", () => {
  it("jogador confirmado vota MVP em colega e a cédula fica incompleta", async () => {
    const result = await vote("p1", "p2", "MVP");

    expect(result).toMatchObject({success: true, ballotComplete: false});
    expect(read(`mvp_votes/${GAME}_p1_MVP`)).toMatchObject({
      voter_id: "p1",
      voted_player_id: "p2",
      category: "MVP",
    });
  });

  it("MVP + Bola Murcha completa a cédula e marca o jogo como OPEN com contagem", async () => {
    await vote("p1", "p2", "MVP");
    const second = await vote("p1", "p3", "WORST");

    expect(second).toMatchObject({ballotComplete: true});
    expect(read(`games/${GAME}`)).toMatchObject({voting_status: "OPEN", voting_submitted_count: 1});
  });

  it("voto duplicado na mesma categoria é recusado com already-exists", async () => {
    await vote("p1", "p2", "MVP");
    await expectCode(vote("p1", "p3", "MVP"), "already-exists");
  });

  it("votar em quem já é Bola Murcha como destaque é contraditório", async () => {
    await vote("p1", "p3", "WORST");
    await expectCode(vote("p1", "p3", "MVP"), "invalid-argument");
  });

  it("jogo ainda não finalizado não aceita voto", async () => {
    seedFinishedGame({status: "CONFIRMED"});
    await expectCode(vote("p1", "p2", "MVP"), "failed-precondition");
  });

  it("votação já encerrada (CONCLUDED) não aceita voto", async () => {
    seedFinishedGame({voting_status: "CONCLUDED"});
    await expectCode(vote("p1", "p2", "MVP"), "failed-precondition");
  });

  it("voto fora da janela de 24 h após o fim do jogo é recusado", async () => {
    seedFinishedGame({dateTime: tsOf(Date.now() - 60 * HOUR_MS)});
    await expectCode(vote("p1", "p2", "MVP"), "failed-precondition");
  });

  it("quem não estava confirmado no jogo não pode votar (não jogou)", async () => {
    seed(`confirmations/${GAME}_outsider`, {game_id: GAME, user_id: "outsider", status: "PENDING"});
    await expectCode(vote("outsider", "p2", "MVP"), "permission-denied");
  });

  it("confirmação cancelada não conta como participação para votar", async () => {
    seedConfirmed("p4", {status: "CANCELLED"});
    await expectCode(vote("p4", "p2", "MVP"), "permission-denied");
  });

  it("jogador com suspeita de sobreposição de agenda não vota", async () => {
    seedConfirmed("p6", {suspicious_overlap: true});
    await expectCode(vote("p6", "p2", "MVP"), "permission-denied");
  });

  it("votar em quem não estava no jogo é invalid-argument", async () => {
    await expectCode(vote("p1", "ausente", "MVP"), "invalid-argument");
  });

  it("perfil incompleto é barrado antes de qualquer leitura", async () => {
    await expectCode(vote("p1", "p2", "MVP", GAME, {profileComplete: false}), "failed-precondition");
  });
});

describe("submitMvpVotes - cédula em lote (UC7)", () => {
  it("lote com MVP e Bola Murcha de jogador elegível completa a cédula", async () => {
    const result = await batch("p1", [
      {votedPlayerId: "p2", category: "MVP"},
      {votedPlayerId: "p3", category: "WORST"},
    ]);

    expect(result).toMatchObject({success: true, ballotComplete: true});
    expect(read(`mvp_votes/${GAME}_p1_WORST`)).toMatchObject({voted_player_id: "p3"});
  });

  it("lote com categoria repetida é invalid-argument", async () => {
    await expectCode(batch("p1", [
      {votedPlayerId: "p2", category: "MVP"},
      {votedPlayerId: "p3", category: "MVP"},
    ]), "invalid-argument");
  });

  it("lote contraditório (MVP e Bola Murcha no mesmo jogador) é recusado", async () => {
    await expectCode(batch("p1", [
      {votedPlayerId: "p2", category: "MVP"},
      {votedPlayerId: "p2", category: "WORST"},
    ]), "invalid-argument");
  });

  it("lote com jogador que não jogou é recusado", async () => {
    await expectCode(batch("p1", [{votedPlayerId: "ausente", category: "MVP"}]), "invalid-argument");
  });
});

describe("concludeMvpVoting - encerramento pelo organizador (UC4/UC7)", () => {
  beforeEach(() => {
    // p1 e p3 dão MVP a p2; p2 dá MVP a p1; p1 dá Bola Murcha a p3.
    seed(`mvp_votes/${GAME}_p1_MVP`, {game_id: GAME, voter_id: "p1", voted_player_id: "p2", category: "MVP"});
    seed(`mvp_votes/${GAME}_p3_MVP`, {game_id: GAME, voter_id: "p3", voted_player_id: "p2", category: "MVP"});
    seed(`mvp_votes/${GAME}_p2_MVP`, {game_id: GAME, voter_id: "p2", voted_player_id: "p1", category: "MVP"});
    seed(`mvp_votes/${GAME}_p1_WORST`, {game_id: GAME, voter_id: "p1", voted_player_id: "p3", category: "WORST"});
    seed("statistics/p2", {currentMvpStreak: 1, bestMvpStreak: 1});
  });

  it("dono encerra e o MVP por maioria é gravado no jogo e nas confirmações", async () => {
    const result = await conclude("owner-1");

    expect(result).toMatchObject({success: true, results: {mvpId: "p2"}});
    expect(read(`games/${GAME}`)).toMatchObject({voting_status: "CONCLUDED", mvp_id: "p2"});
    expect(read(`confirmations/${GAME}_p2`)).toMatchObject({is_mvp: true});
    expect(read("statistics/p2")).toMatchObject({currentMvpStreak: 2, bestMvpStreak: 2});
  });

  it("administrador global encerra a votação de qualquer jogo", async () => {
    const result = await conclude("global-admin", {profileComplete: true, role: "ADMIN"});
    expect(result).toMatchObject({results: {mvpId: "p2"}});
  });

  it("jogador comum não encerra a votação", async () => {
    await expectCode(conclude("p1"), "permission-denied");
    expect(read(`games/${GAME}`)).toMatchObject({voting_status: "OPEN"});
  });

  it("voto de quem não jogou é ignorado na apuração", async () => {
    seed(`mvp_votes/${GAME}_ghost_MVP`, {game_id: GAME, voter_id: "ghost", voted_player_id: "p1", category: "MVP"});
    seed(`mvp_votes/${GAME}_ghost2_MVP`, {game_id: GAME, voter_id: "ghost2", voted_player_id: "p1", category: "MVP"});
    const result = await conclude("owner-1");
    expect(result).toMatchObject({results: {mvpId: "p2"}});
  });

  it("Bola Murcha é o jogador mais votado na categoria WORST", async () => {
    await conclude("owner-1");
    expect(read(`games/${GAME}`)).toMatchObject({worst_player_id: "p3"});
    expect(read(`confirmations/${GAME}_p3`)).toMatchObject({is_worst_player: true});
  });

  it("jogo ainda não finalizado não pode ser encerrado", async () => {
    seedFinishedGame({status: "CONFIRMED", owner_id: "owner-1"});
    await expectCode(conclude("owner-1"), "failed-precondition");
  });

  it("encerrar de novo devolve alreadyConcluded sem reapurar", async () => {
    await conclude("owner-1");
    const again = await conclude("owner-1");

    expect(again).toMatchObject({alreadyConcluded: true, results: {mvpId: "p2"}});
    expect(read("statistics/p2")).toMatchObject({currentMvpStreak: 2});
  });
});
