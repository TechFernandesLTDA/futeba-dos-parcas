let mockRunTransaction = jest.fn();
let mockDoc = jest.fn();
let mockCollection = jest.fn();
let mockCheckRateLimit = jest.fn();

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({
    doc: mockDoc,
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  })),
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

class MockHttpsError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpsError";
    this.code = code;
    this.details = details;
  }
}

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: MockHttpsError,
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

import {
  CONFIRM_GAME_PRESENCE_RATE_LIMIT,
  confirmGamePresence,
  resolveConfirmationPayment,
} from "../src/games/join-public-game";
import {checkRateLimit} from "../src/middleware/rate-limiter";

type FakeDoc = {exists: boolean; data: () => Record<string, unknown>};

const futureTimestamp = {
  toMillis: () => Date.now() + 60 * 60 * 1000,
};

function gameDoc(overrides: Record<string, unknown> = {}): FakeDoc {
  return {
    exists: true,
    data: () => ({
      status: "SCHEDULED",
      date_time: futureTimestamp,
      max_players: 2,
      max_goalkeepers: 1,
      total_cost: 100,
      price_manual_override: false,
      owner_id: "user1",
      ...overrides,
    }),
  };
}

function confirmationDoc(
  data?: Record<string, unknown>
): FakeDoc {
  return {
    exists: Boolean(data),
    data: () => data ?? {},
  };
}

function capacityDoc(data: Record<string, unknown>) {
  return {data: () => data};
}

function arrangeTransaction(input: {
  game?: FakeDoc;
  existing?: FakeDoc;
  capacity?: Array<{data: () => Record<string, unknown>}>;
  member?: FakeDoc;
}) {
  const capacityQuery = {
    where: jest.fn().mockReturnThis(),
  };
  const tx = {
    get: jest.fn(async (ref: {path?: string}) => {
      if (ref?.path === "games/game1") return input.game ?? gameDoc();
      if (ref?.path === "confirmations/game1_user1") {
        return input.existing ?? confirmationDoc();
      }
      if (ref?.path === "groups/group1/members/user1") {
        return input.member ?? confirmationDoc();
      }
      return {
        size: input.capacity?.length ?? 0,
        docs: input.capacity ?? [],
      };
    }),
    update: jest.fn(),
    set: jest.fn(),
  };

  mockDoc.mockImplementation((path: string) => ({path}));
  mockCollection.mockReturnValue(capacityQuery);
  mockRunTransaction.mockImplementation(
    async (handler: (transaction: typeof tx) => Promise<unknown>) => handler(tx)
  );
  return tx;
}

describe("confirmGamePresence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(Date.now() + 60000),
    });
  });

  test("reserva total e vaga de goleiro na mesma transaction", async () => {
    const tx = arrangeTransaction({
      capacity: [capacityDoc({status: "CONFIRMED", position: "FIELD"})],
    });

    await expect(confirmGamePresence({
      auth: {uid: "user1", token: {verified: true}},
      data: {gameId: "game1", position: "GOALKEEPER"},
    })).resolves.toMatchObject({
      success: true,
      alreadyConfirmed: false,
      confirmationId: "game1_user1",
      position: "GOALKEEPER",
      expectedPayment: 50,
      expectedPaymentCents: 5000,
    });

    expect(tx.update).toHaveBeenCalledWith(
      {path: "games/game1"},
      expect.objectContaining({
        players_count: 2,
        goalkeepers_count: 1,
      })
    );
    expect(tx.set).toHaveBeenCalledWith(
      {path: "confirmations/game1_user1"},
      expect.objectContaining({
        status: "CONFIRMED",
        position: "GOALKEEPER",
        capacity_sync_token: expect.any(String),
      }),
      {merge: true}
    );
    expect(checkRateLimit).toHaveBeenCalledWith(
      "user1",
      CONFIRM_GAME_PRESENCE_RATE_LIMIT
    );
  });

  test("rejeita quando capacidade total seria excedida", async () => {
    const tx = arrangeTransaction({
      capacity: [
        capacityDoc({status: "CONFIRMED", position: "FIELD"}),
        capacityDoc({status: "CONFIRMED", position: "FIELD"}),
      ],
    });

    await expect(confirmGamePresence({
      auth: {uid: "user1", token: {verified: true}},
      data: {gameId: "game1", position: "FIELD"},
    })).rejects.toMatchObject({code: "resource-exhausted"});
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
  });

  test("rejeita goleiro quando limite da posicao seria excedido", async () => {
    const tx = arrangeTransaction({
      game: gameDoc({max_players: 5, max_goalkeepers: 1}),
      capacity: [
        capacityDoc({status: "CONFIRMED", position: "GOALKEEPER"}),
      ],
    });

    await expect(confirmGamePresence({
      auth: {uid: "user1", token: {verified: true}},
      data: {gameId: "game1", position: "GOALKEEPER"},
    })).rejects.toMatchObject({
      code: "resource-exhausted",
      message: "As vagas de goleiro já foram preenchidas.",
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  test("retry da mesma confirmacao e idempotente e nao reaplica contador", async () => {
    const tx = arrangeTransaction({
      existing: confirmationDoc({
        status: "CONFIRMED",
        position: "LINE",
        expected_payment: 50,
        expected_payment_cents: 5000,
      }),
    });

    await expect(confirmGamePresence({
      auth: {uid: "user1", token: {verified: true}},
      data: {gameId: "game1", position: "FIELD"},
    })).resolves.toMatchObject({
      success: true,
      alreadyConfirmed: true,
    });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
  });

  test("rejeita usuario sem convite ou membership em jogo privado", async () => {
    const tx = arrangeTransaction({
      game: gameDoc({owner_id: "owner", group_id: "group1"}),
    });

    await expect(confirmGamePresence({
      auth: {uid: "user1", token: {verified: true}},
      data: {gameId: "game1", position: "FIELD"},
    })).rejects.toMatchObject({code: "permission-denied"});
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
  });

  test("permite membro ativo do grupo sem convite preexistente", async () => {
    const tx = arrangeTransaction({
      game: gameDoc({owner_id: "owner", group_id: "group1"}),
      member: confirmationDoc({status: "ACTIVE"}),
    });

    await expect(confirmGamePresence({
      auth: {uid: "user1", token: {verified: true}},
      data: {gameId: "game1", position: "FIELD"},
    })).resolves.toMatchObject({success: true, alreadyConfirmed: false});
    expect(tx.set).toHaveBeenCalled();
  });
});

describe("resolveConfirmationPayment", () => {
  test("usa total por jogador quando preco nao e manual", () => {
    expect(resolveConfirmationPayment({
      total_cost: 525,
      max_players: 14,
      daily_price: 21,
      price_manual_override: false,
    })).toEqual({amount: 37.5, cents: 3750});
  });

  test("preserva daily price com override manual", () => {
    expect(resolveConfirmationPayment({
      total_cost: 525,
      max_players: 14,
      daily_price: 21,
      price_manual_override: true,
    })).toEqual({amount: 21, cents: 2100});
  });
});
