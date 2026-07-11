const mockLoggerWarn = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatch = jest.fn(() => ({
  set: mockBatchSet,
  commit: mockBatchCommit,
}));
const mockQueryGet = jest.fn();
const mockQuery = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: mockQueryGet,
};
const gameDocuments = new Map<string, {exists: boolean; data: () => unknown}>();
const mockDoc = jest.fn((path: string) => ({
  path,
  get: jest.fn(async () => gameDocuments.get(path) ?? {
    exists: false,
    data: () => undefined,
  }),
}));
const mockDb = jest.fn(() => ({
  doc: mockDoc,
  collection: jest.fn(() => mockQuery),
  batch: mockBatch,
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    warn: mockLoggerWarn,
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

jest.mock("../src/_db", () => ({
  db: mockDb,
}));

import {onConfirmationCreated} from "../src/voting/temporal-overlap";

function gameSnapshot(date: unknown, durationMinutes = 90) {
  return {
    exists: true,
    data: () => ({date_time: date, duration_minutes: durationMinutes}),
  };
}

function confirmationDoc(id: string, data: Record<string, unknown>) {
  return {id, data: () => data};
}

function eventFor(
  data: Record<string, unknown> | null,
  ref: unknown = {path: "confirmations/current"},
) {
  return {
    data: data === null ? undefined : {data: () => data, ref},
    params: {confId: "current"},
  };
}

describe("onConfirmationCreated temporal overlap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gameDocuments.clear();
    mockQueryGet.mockResolvedValue({docs: []});
    mockBatch.mockImplementation(() => ({
      set: mockBatchSet,
      commit: mockBatchCommit,
    }));
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it("ignora confirmação recriada pela união de contas sem consultar jogos", async () => {
    await onConfirmationCreated(eventFor({
      user_id: "user-1",
      game_id: "game-1",
      status: "CONFIRMED",
      merged_from_alias: true,
    }) as never);

    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {user_id: "user-1", status: "CONFIRMED"},
    {user_id: "user-1", game_id: "game-1", status: "CANCELLED"},
  ])("encerra cedo para confirmação inelegível %#", async (confirmation) => {
    await onConfirmationCreated(eventFor(confirmation) as never);
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("registra somente conflitos temporais reais em batch atômico", async () => {
    const currentStart = {toDate: () => new Date("2026-07-11T20:00:00.000Z")};
    gameDocuments.set("games/game-current", gameSnapshot(currentStart));
    gameDocuments.set("games/game-overlap", gameSnapshot("2026-07-11T20:30:00.000Z"));
    gameDocuments.set("games/game-far", gameSnapshot("2026-07-12T00:30:00.000Z"));
    gameDocuments.set("games/game-invalid", gameSnapshot("invalid"));
    mockQueryGet.mockResolvedValue({
      docs: [
        confirmationDoc("current", {game_id: "game-current", status: "CONFIRMED"}),
        confirmationDoc("same-game", {game_id: "game-current", status: "CONFIRMED"}),
        confirmationDoc("cancelled", {game_id: "game-cancelled", status: "CANCELLED"}),
        confirmationDoc("missing-game-id", {status: "CONFIRMED"}),
        confirmationDoc("overlap", {game_id: "game-overlap", status: "PENDING"}),
        confirmationDoc("far", {game_id: "game-far", status: "CONFIRMED"}),
        confirmationDoc("missing-game", {game_id: "game-missing", status: "CONFIRMED"}),
        confirmationDoc("invalid-game", {game_id: "game-invalid", status: "CONFIRMED"}),
      ],
    });
    const confirmationRef = {path: "confirmations/current"};

    await onConfirmationCreated(eventFor({
      user_id: "user-1",
      game_id: "game-current",
      status: "CONFIRMED",
    }, confirmationRef) as never);

    expect(mockQuery.where).toHaveBeenCalledWith("user_id", "==", "user-1");
    expect(mockBatchSet).toHaveBeenNthCalledWith(
      1,
      confirmationRef,
      {suspicious_overlap: true},
      {merge: true},
    );
    expect(mockBatchSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({path: "audit_logs/overlap_current"}),
      expect.objectContaining({
        type: "CONFIRMATION_OVERLAP",
        conflict_conf_ids: ["overlap"],
      }),
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("não grava quando jogo atual tem data inválida", async () => {
    gameDocuments.set("games/game-current", gameSnapshot(123));

    await onConfirmationCreated(eventFor({
      user_id: "user-1",
      game_id: "game-current",
      status: "PENDING",
    }) as never);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "[OVERLAP_CHECK] Game sem date valida",
      {gameId: "game-current", userId: "user-1"},
    );
    expect(mockQueryGet).not.toHaveBeenCalled();
  });

  it("não grava quando há sobreposição mas o evento não fornece ref", async () => {
    gameDocuments.set("games/game-current", gameSnapshot("2026-07-11T20:00:00.000Z"));
    gameDocuments.set("games/game-overlap", gameSnapshot("2026-07-11T20:15:00.000Z"));
    mockQueryGet.mockResolvedValue({
      docs: [confirmationDoc("overlap", {
        game_id: "game-overlap",
        status: "CONFIRMED",
      })],
    });

    await onConfirmationCreated(eventFor({
      user_id: "user-1",
      game_id: "game-current",
      status: "CONFIRMED",
    }, null) as never);

    expect(mockBatch).not.toHaveBeenCalled();
  });
});
