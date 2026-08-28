const mockTxGet = jest.fn();
const mockTxSet = jest.fn();
const mockRunTransaction = jest.fn(async (callback: any) => callback({
  get: mockTxGet,
  set: mockTxSet,
}));

const entryRef = {kind: "entry"};
const activeQuery = {kind: "active-query"};
const gameRef = {kind: "game", collection: jest.fn()};
const confirmationRef = {kind: "confirmation"};
const memberRef = {kind: "member"};
const userRef = {get: jest.fn()};

const db = {
  collection: jest.fn((name: string) => {
    if (name === "games") return {doc: jest.fn(() => gameRef)};
    if (name === "confirmations") return {doc: jest.fn(() => confirmationRef)};
    if (name === "users") return {doc: jest.fn(() => userRef)};
    if (name === "groups") {
      return {
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({doc: jest.fn(() => memberRef)})),
        })),
      };
    }
    return {doc: jest.fn(() => userRef)};
  }),
  runTransaction: mockRunTransaction,
};

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => db), {
    FieldValue: {serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP")},
  }),
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
  onCall: jest.fn((_options: unknown, handler: unknown) => handler),
}));

jest.mock("../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: jest.fn((_options: unknown, handler: unknown) => handler),
}));

import {joinGameWaitlistHandler} from "../src/waitlist/join-game-waitlist";

const state = {
  game: {exists: true, data: {status: "SCHEDULED", group_id: "group-1", owner_id: "owner"}},
  member: {exists: true, data: {user_id: "uid-1", status: "ACTIVE"}},
  confirmation: {exists: false, data: undefined},
  entry: {exists: false, data: undefined},
  activeDocs: [] as Array<{data: () => Record<string, unknown>}>,
};

function snapshot(exists: boolean, data?: Record<string, unknown>) {
  return {exists, data: () => data};
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    auth: {uid: "uid-1"},
    data: {gameId: "game-1", position: "FIELD", ...overrides},
  } as any;
}

describe("joinGameWaitlist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state.game = {exists: true, data: {status: "SCHEDULED", group_id: "group-1", owner_id: "owner"}};
    state.member = {exists: true, data: {user_id: "uid-1", status: "ACTIVE"}};
    state.confirmation = {exists: false, data: undefined};
    state.entry = {exists: false, data: undefined};
    state.activeDocs = [];

    gameRef.collection.mockImplementation(() => ({
      doc: jest.fn(() => entryRef),
      where: jest.fn(() => activeQuery),
    }));
    userRef.get.mockResolvedValue({data: () => ({display_name: "Player 1"})});
    mockTxGet.mockImplementation(async (target: any) => {
      switch (target.kind) {
        case "game": return snapshot(state.game.exists, state.game.data);
        case "member": return snapshot(state.member.exists, state.member.data);
        case "confirmation": return snapshot(state.confirmation.exists, state.confirmation.data);
        case "entry": return snapshot(state.entry.exists, state.entry.data);
        case "active-query": return {docs: state.activeDocs};
        default: return snapshot(false);
      }
    });
  });

  it("atribui a próxima posição dentro da transação", async () => {
    state.activeDocs = [
      {data: () => ({queue_position: 2})},
      {data: () => ({queue_position: 7})},
    ];

    await expect(joinGameWaitlistHandler(request())).resolves.toEqual({
      success: true,
      alreadyActive: false,
      entryId: "uid-1",
      queuePosition: 8,
    });

    expect(mockTxSet).toHaveBeenCalledWith(entryRef, expect.objectContaining({
      game_id: "game-1",
      user_id: "uid-1",
      position: "FIELD",
      queue_position: 8,
      added_at: "SERVER_TIMESTAMP",
    }));
  });

  it("e idempotente quando a entrada ja esta ativa", async () => {
    state.entry = {exists: true, data: {status: "WAITING", queue_position: 3}};

    await expect(joinGameWaitlistHandler(request()))
      .resolves.toMatchObject({alreadyActive: true, queuePosition: 3});
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it("nega caller que nao e membro do grupo do jogo", async () => {
    state.member = {exists: false, data: undefined};
    state.game = {exists: true, data: {status: "SCHEDULED", group_id: "group-1", owner_id: "owner"}};

    await expect(joinGameWaitlistHandler(request()))
      .rejects.toMatchObject({code: "permission-denied"});
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it("permite o dono do jogo sem vinculo de membro", async () => {
    state.member = {exists: false, data: undefined};
    state.game = {exists: true, data: {status: "SCHEDULED", group_id: "group-1", owner_id: "uid-1"}};

    await expect(joinGameWaitlistHandler(request()))
      .resolves.toMatchObject({alreadyActive: false});
    expect(mockTxSet).toHaveBeenCalled();
  });

  it("nega entrada na fila de jogo FINISHED", async () => {
    state.game = {exists: true, data: {status: "FINISHED", group_id: "group-1", owner_id: "owner"}};

    await expect(joinGameWaitlistHandler(request()))
      .rejects.toMatchObject({code: "permission-denied"});
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it("nega caller que ja esta CONFIRMED no jogo", async () => {
    state.confirmation = {exists: true, data: {status: "CONFIRMED"}};

    await expect(joinGameWaitlistHandler(request()))
      .rejects.toMatchObject({code: "permission-denied"});
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it("aplica o teto de fila por jogo", async () => {
    state.activeDocs = Array.from({length: 200}, () => ({data: () => ({})}));

    await expect(joinGameWaitlistHandler(request()))
      .rejects.toMatchObject({code: "resource-exhausted"});
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it("normaliza position invalida para FIELD", async () => {
    await expect(joinGameWaitlistHandler(request({position: "MIDFIELDER"})))
      .resolves.toMatchObject({alreadyActive: false});

    expect(mockTxSet).toHaveBeenCalledWith(entryRef, expect.objectContaining({
      position: "FIELD",
    }));
  });

  it("preserva position GOALKEEPER valida", async () => {
    await expect(joinGameWaitlistHandler(request({position: "GOALKEEPER"})))
      .resolves.toMatchObject({alreadyActive: false});

    expect(mockTxSet).toHaveBeenCalledWith(entryRef, expect.objectContaining({
      position: "GOALKEEPER",
    }));
  });

  it("nega caller sem autenticacao", async () => {
    await expect(joinGameWaitlistHandler({
      auth: null,
      data: {gameId: "game-1"},
    } as any)).rejects.toMatchObject({code: "unauthenticated"});
  });
});
