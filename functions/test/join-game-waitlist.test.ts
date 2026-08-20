const mockSet = jest.fn();
const mockTransactionGet = jest.fn();
const mockRunTransaction = jest.fn(async (callback: any) => callback({
  get: mockTransactionGet,
  set: mockSet,
}));

const entryRef = {id: "uid-1"};
const activeQuery = {type: "active-query"};
const gameRef = {
  get: jest.fn(),
  collection: jest.fn(() => ({
    doc: jest.fn(() => entryRef),
    where: jest.fn(() => activeQuery),
  })),
};
const userRef = {get: jest.fn()};
const db = {
  collection: jest.fn((name: string) => name === "games" ? {
    doc: jest.fn(() => gameRef),
  } : {doc: jest.fn(() => userRef)}),
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

import {joinGameWaitlistHandler} from "../src/waitlist/join-game-waitlist";

describe("joinGameWaitlist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gameRef.get.mockResolvedValue({exists: true});
    userRef.get.mockResolvedValue({data: () => ({display_name: "Player 1"})});
  });

  it("atribui a próxima posição dentro da transação", async () => {
    mockTransactionGet
      .mockResolvedValueOnce({exists: false, data: () => undefined})
      .mockResolvedValueOnce({docs: [
        {data: () => ({queue_position: 2})},
        {data: () => ({queue_position: 7})},
      ]});

    await expect(joinGameWaitlistHandler({
      auth: {uid: "uid-1"},
      data: {gameId: "game-1", position: "FIELD"},
    } as any)).resolves.toEqual({
      success: true,
      alreadyActive: false,
      entryId: "uid-1",
      queuePosition: 8,
    });

    expect(mockSet).toHaveBeenCalledWith(entryRef, expect.objectContaining({
      game_id: "game-1",
      user_id: "uid-1",
      queue_position: 8,
      added_at: "SERVER_TIMESTAMP",
    }));
  });

  it("e idempotente quando a entrada ja esta ativa", async () => {
    mockTransactionGet
      .mockResolvedValueOnce({exists: true, data: () => ({status: "WAITING", queue_position: 3})})
      .mockResolvedValueOnce({docs: []});

    await expect(joinGameWaitlistHandler({
      auth: {uid: "uid-1"},
      data: {gameId: "game-1", position: "FIELD"},
    } as any)).resolves.toMatchObject({alreadyActive: true, queuePosition: 3});
    expect(mockSet).not.toHaveBeenCalled();
  });
});
