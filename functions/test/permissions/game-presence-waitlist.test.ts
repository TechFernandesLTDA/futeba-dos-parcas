/**
 * Marcação de jogo (UC6): confirmação de presença, jogo público, lista de espera
 * e confirmação feita pelo gestor.
 * Callables/handlers: confirmGamePresence, joinPublicGame, joinGameWaitlistHandler,
 * confirmPlayerAsManager. Funções puras: getPublicCapacityStatuses, resolveConfirmationPayment.
 */

jest.mock("firebase-functions/v2", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions/v2/https", () => require("./_fake-runtime").httpsModule);
jest.mock("firebase-admin/firestore", () => require("./_fake-firestore"));
jest.mock("firebase-admin", () => require("./_fake-runtime").adminModule(() => require("./_fake-firestore").db()));
jest.mock("../../src/_db", () => ({db: () => require("./_fake-firestore").db()}));
jest.mock("../../src/middleware/rate-limiter");
jest.mock("../../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: (_options: unknown, handler: unknown) => handler,
}));

import {checkRateLimit} from "../../src/middleware/rate-limiter";
import {resetFakeDb, seed, read, pathsWithPrefix, tsOf} from "./_fake-firestore";

const {
  confirmGamePresence,
  joinPublicGame,
  getPublicCapacityStatuses,
  resolveConfirmationPayment,
} = require("../../src/games/join-public-game");
const {joinGameWaitlistHandler, MAX_WAITLIST_PER_GAME} = require("../../src/waitlist/join-game-waitlist");
const {confirmPlayerAsManager} = require("../../src/games/confirm-player-as-manager");

const RL_OK = {allowed: true, remaining: 10, resetAt: new Date(Date.now() + 60_000)};
const DAY_MS = 24 * 60 * 60 * 1000;
const GAME = "game-1";
const VERIFIED = {verified: true, name: "Jogador Teste"};

async function expectCode(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => undefined,
    (e: {code?: string}) => e
  );
  expect(err).toBeDefined();
  expect((err as {code: string}).code).toBe(code);
}

/** Jogo agendado para daqui a 3 dias, do grupo g1, com 4 vagas (1 goleiro). */
function seedGame(overrides: Record<string, unknown> = {}) {
  seed(`games/${GAME}`, {
    status: "SCHEDULED",
    group_id: "g1",
    owner_id: "owner-1",
    visibility: "GROUP_ONLY",
    dateTime: tsOf(Date.now() + 3 * DAY_MS),
    max_players: 4,
    max_goalkeepers: 1,
    total_cost: 100,
    players_count: 0,
    goalkeepers_count: 0,
    ...overrides,
  });
}

function seedGroup() {
  seed("groups/g1", {name: "Pelada Sul", owner_id: "owner-1", status: "ACTIVE"});
  seed("groups/g1/members/owner-1", {user_id: "owner-1", role: "OWNER", status: "ACTIVE"});
  seed("groups/g1/members/member-1", {user_id: "member-1", role: "MEMBER", status: "ACTIVE"});
  seed("groups/g1/members/admin-1", {user_id: "admin-1", role: "ADMIN", status: "ACTIVE"});
}

function seedConfirmed(uid: string, position = "FIELD") {
  seed(`confirmations/${GAME}_${uid}`, {
    game_id: GAME,
    user_id: uid,
    status: "CONFIRMED",
    position,
  });
}

const presence = (uid: string, data: Record<string, unknown> = {}, token: Record<string, unknown> = VERIFIED) =>
  confirmGamePresence({
    auth: {uid, token},
    data: {gameId: GAME, position: "FIELD", isCasualPlayer: false, ...data},
  });

const publicJoin = (uid: string, data: Record<string, unknown> = {}, token: Record<string, unknown> = VERIFIED) =>
  joinPublicGame({
    auth: {uid, token},
    data: {gameId: GAME, position: "FIELD", ...data},
  });

const waitlist = (uid: string | null, data: Record<string, unknown> = {}, token: Record<string, unknown> = {}) =>
  joinGameWaitlistHandler({
    auth: uid ? {uid, token: {name: "Jogador Fila", ...token}} : undefined,
    data: {gameId: GAME, position: "GOALKEEPER", ...data},
  } as never);

const manage = (uid: string | null, data: Record<string, unknown> = {}, token: Record<string, unknown> = {}) =>
  confirmPlayerAsManager({
    auth: uid ? {uid, token} : undefined,
    data: {gameId: GAME, userId: "target-1", position: "FIELD", ...data},
  });

beforeEach(() => {
  resetFakeDb();
  jest.clearAllMocks();
  (checkRateLimit as jest.Mock).mockResolvedValue(RL_OK);
  seedGroup();
  seedGame();
});

describe("confirmGamePresence - jogador de grupo (UC6)", () => {
  it("membro ativo confirma presença e o contador de vagas sobe", async () => {
    const result = await presence("member-1");

    expect(result).toMatchObject({success: true, alreadyConfirmed: false, expectedPayment: 25});
    expect(read(`confirmations/${GAME}_member-1`)).toMatchObject({
      status: "CONFIRMED",
      position: "FIELD",
      payment_status: "PENDING",
      confirmation_order: 1,
    });
    expect(read(`games/${GAME}`)).toMatchObject({players_count: 1, goalkeepers_count: 0});
  });

  it("trocar de linha para goleiro mantém players_count e atualiza goleiros", async () => {
    await presence("member-1", {position: "FIELD"});
    await presence("member-1", {position: "GOALKEEPER"});

    expect(read(`games/${GAME}`)).toMatchObject({players_count: 1, goalkeepers_count: 1});
  });

  it("goleiro além do limite de goleiros é recusado com resource-exhausted", async () => {
    seedConfirmed("other-gk", "GOALKEEPER");
    seed(`games/${GAME}`, {...read(`games/${GAME}`), goalkeepers_count: 1});
    await expectCode(presence("member-1", {position: "GOALKEEPER"}), "resource-exhausted");
  });

  it("jogo lotado recusa nova confirmação com resource-exhausted", async () => {
    seedGame({max_players: 2});
    seedConfirmed("p1");
    seedConfirmed("p2");
    await expectCode(presence("member-1"), "resource-exhausted");
    expect(read(`confirmations/${GAME}_member-1`)).toBeUndefined();
  });

  it("usuário bloqueado no grupo não confirma presença", async () => {
    seed("groups/g1/blocked_players/member-1", {user_id: "member-1"});
    await expectCode(presence("member-1"), "permission-denied");
  });

  it("não-membro sem convite não confirma em jogo do grupo", async () => {
    await expectCode(presence("visitor-1"), "permission-denied");
  });

  it("convidado com convite PENDING confirma mesmo sem vínculo com o grupo", async () => {
    seed(`confirmations/${GAME}_guest-1`, {game_id: GAME, user_id: "guest-1", status: "PENDING"});
    const result = await presence("guest-1");
    expect(result).toMatchObject({success: true, alreadyConfirmed: false});
  });

  it("dono do jogo (owner_id) sem documento de vínculo confirma presença", async () => {
    seedGame({owner_id: "owner-solo"});
    const result = await presence("owner-solo");
    expect(result).toMatchObject({success: true});
  });

  it("jogo finalizado não aceita confirmação", async () => {
    seedGame({status: "FINISHED"});
    await expectCode(presence("member-1"), "failed-precondition");
  });

  it("jogo cujo horário já passou não aceita confirmação", async () => {
    seedGame({dateTime: tsOf(Date.now() - 1000)});
    await expectCode(presence("member-1"), "failed-precondition");
  });

  it("sem autenticação devolve unauthenticated", async () => {
    await expectCode(
      confirmGamePresence({data: {gameId: GAME, position: "FIELD"}}),
      "unauthenticated"
    );
  });

  it("usuário não verificado fora da carência não confirma presença", async () => {
    await expectCode(presence("member-1", {}, {verified: false}), "permission-denied");
  });
});

describe("joinPublicGame - jogo público aberto (UC4/UC6)", () => {
  it("usuário de fora entra em jogo PUBLIC_OPEN", async () => {
    seedGame({visibility: "PUBLIC_OPEN", group_id: null});
    const result = await publicJoin("stranger-1");

    expect(result).toMatchObject({success: true, alreadyConfirmed: false});
    expect(read(`confirmations/${GAME}_stranger-1`)).toMatchObject({source: "public_game", status: "CONFIRMED"});
  });

  it("jogo restrito ao grupo não aceita entrada de fora", async () => {
    await expectCode(publicJoin("stranger-3"), "permission-denied");
  });

  it("membro bloqueado no grupo não entra em jogo público do grupo", async () => {
    seedGame({visibility: "PUBLIC_OPEN"});
    seed("groups/g1/blocked_players/member-1", {user_id: "member-1"});
    await expectCode(publicJoin("member-1"), "permission-denied");
  });

  it("jogo público lotado recusa nova entrada", async () => {
    seedGame({visibility: "PUBLIC_OPEN", group_id: null, max_players: 1});
    seedConfirmed("first-in");
    await expectCode(publicJoin("stranger-4"), "resource-exhausted");
  });
});

describe("regras puras de capacidade e pagamento", () => {
  it("jogo público recorrente conta só CONFIRMED na capacidade", () => {
    expect(getPublicCapacityStatuses({visibility: "PUBLIC_OPEN", recurrence: "weekly"})).toEqual(["CONFIRMED"]);
  });

  it("valor por jogador é o total dividido pelas vagas", () => {
    expect(resolveConfirmationPayment({total_cost: 100, max_players: 4})).toEqual({amount: 25, cents: 2500});
  });

  it("override manual usa a diária em vez de dividir o total", () => {
    expect(resolveConfirmationPayment({
      total_cost: 100, max_players: 4, price_manual_override: true, daily_price: 15,
    })).toEqual({amount: 15, cents: 1500});
  });
});

describe("lista de espera - joinGameWaitlist (UC6)", () => {
  it("membro ativo entra na fila em primeiro lugar", async () => {
    seed("users/member-1", {name: "Membro Um"});
    const result = await waitlist("member-1");

    expect(result).toMatchObject({success: true, alreadyActive: false, queuePosition: 1});
    expect(read(`games/${GAME}/waitlist/member-1`)).toMatchObject({
      status: "WAITING",
      position: "GOALKEEPER",
      queue_position: 1,
    });
  });

  it("repetir a entrada devolve alreadyActive sem criar nova posição", async () => {
    await waitlist("member-1");
    const again = await waitlist("member-1");
    expect(again).toMatchObject({alreadyActive: true, queuePosition: 1});
  });

  it("jogo cancelado não aceita fila", async () => {
    seedGame({status: "CANCELLED"});
    await expectCode(waitlist("member-1"), "permission-denied");
  });

  it("não-membro não entra na fila de jogo restrito ao grupo", async () => {
    await expectCode(waitlist("visitor-1"), "permission-denied");
  });

  it("jogo público aceita entrada na fila de não-membro", async () => {
    seedGame({visibility: "PUBLIC_OPEN", group_id: null});
    const result = await waitlist("stranger-1");
    expect(result).toMatchObject({success: true, queuePosition: 1});
  });

  it("administrador global entra na fila de qualquer jogo", async () => {
    const result = await waitlist("global-admin", {}, {role: "ADMIN"});
    expect(result).toMatchObject({success: true});
  });

  it("fila cheia (200 ativos) devolve resource-exhausted", async () => {
    expect(MAX_WAITLIST_PER_GAME).toBe(200);
    for (let i = 0; i < MAX_WAITLIST_PER_GAME; i += 1) {
      seed(`games/${GAME}/waitlist/w-${i}`, {status: "WAITING", queue_position: i + 1});
    }
    await expectCode(waitlist("member-1"), "resource-exhausted");
  });

  // Bloqueado no grupo não entra na fila de jogo público (mesmo padrão de joinPublicGame).
  test(
    "usuário bloqueado no grupo do jogo não entra na fila de jogo público",
    async () => {
      seedGame({visibility: "PUBLIC_OPEN"});
      seed("groups/g1/blocked_players/blocked-1", {user_id: "blocked-1"});
      await expectCode(waitlist("blocked-1"), "permission-denied");
    }
  );
});

describe("confirmPlayerAsManager - gestor confirma convidado (UC4/UC6)", () => {
  beforeEach(() => {
    seed(`confirmations/${GAME}_target-1`, {game_id: GAME, user_id: "target-1", status: "PENDING", position: "FIELD"});
  });

  it("dono confirma convidado PENDING e o jogo atualiza a contagem", async () => {
    const result = await manage("owner-1");

    expect(result).toMatchObject({success: true, alreadyConfirmed: false});
    expect(read(`confirmations/${GAME}_target-1`)).toMatchObject({
      status: "CONFIRMED",
      confirmed_by_manager: "owner-1",
    });
    expect(read(`games/${GAME}`)).toMatchObject({players_count: 1});
    expect(pathsWithPrefix("audit_logs/confirm_player_as_manager_")).toHaveLength(1);
  });

  it("administrador global confirma convidado sem ser organizador", async () => {
    const result = await manage("global-admin", {}, {role: "ADMIN"});
    expect(result).toMatchObject({success: true});
  });

  it("MEMBER comum não confirma jogadores", async () => {
    await expectCode(manage("member-1"), "permission-denied");
    expect(read(`confirmations/${GAME}_target-1`)).toMatchObject({status: "PENDING"});
  });

  it("ADMIN do grupo sem ser organizador do jogo não confirma", async () => {
    await expectCode(manage("admin-1"), "permission-denied");
  });

  it("jogador sem convite não pode ser confirmado pelo gestor", async () => {
    await expectCode(manage("owner-1", {userId: "no-invite"}), "not-found");
  });

  it("status de convite inválido (DECLINED) não é confirmado", async () => {
    seed(`confirmations/${GAME}_target-1`, {status: "DECLINED", position: "FIELD"});
    await expectCode(manage("owner-1"), "failed-precondition");
  });

  it("jogo lotado recusa confirmação do gestor", async () => {
    seedGame({max_players: 1});
    seedConfirmed("first-in");
    await expectCode(manage("owner-1"), "resource-exhausted");
  });

  test(
    "gestor não confirma jogador bloqueado no grupo",
    async () => {
      seed("groups/g1/blocked_players/target-1", {user_id: "target-1"});
      await expectCode(manage("owner-1"), "permission-denied");
    }
  );
});
