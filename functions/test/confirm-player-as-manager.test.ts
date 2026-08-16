let mockRunTransaction = jest.fn();
let mockDoc = jest.fn();
let mockCollection = jest.fn();
let mockCheckRateLimit = jest.fn();
let mockOnCallConfig: unknown;

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
  onCall: jest.fn((config: unknown, handler: unknown) => {
    mockOnCallConfig = config;
    return handler;
  }),
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

jest.mock("node:crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-1234"),
}));

import {confirmPlayerAsManager} from "../src/games/confirm-player-as-manager";

type FakeDoc = {exists: boolean; data: () => Record<string, unknown>};

function gameDoc(overrides: Record<string, unknown> = {}): FakeDoc {
  return {
    exists: true,
    data: () => ({
      status: "SCHEDULED",
      max_players: 14,
      max_goalkeepers: 3,
      total_cost: 100,
      price_manual_override: false,
      owner_id: "owner1",
      co_organizers: [],
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
  return {
    id: data.id ?? `cap_${data.user_id ?? "x"}`,
    data: () => data,
  };
}

function arrangeTransaction(input: {
  game?: FakeDoc;
  target?: FakeDoc;
  capacity?: Array<{id?: string; data: () => Record<string, unknown>}>;
}) {
  const capacityQuery = {
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
  };
  const auditDocRef = {set: jest.fn().mockResolvedValue(undefined)};
  const auditCollection = {
    doc: jest.fn(() => auditDocRef),
  };
  const tx = {
    get: jest.fn(async (ref: {path?: string}) => {
      if (ref?.path === "games/game1") return input.game ?? gameDoc();
      if (ref?.path === "confirmations/game1_target") {
        return input.target ?? confirmationDoc();
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
  mockCollection.mockImplementation((path: string) =>
    path === "audit_logs" ? auditCollection : capacityQuery
  );
  mockRunTransaction.mockImplementation(
    async (handler: (transaction: typeof tx) => Promise<unknown>) => handler(tx)
  );
  return {tx, auditDocRef};
}

describe("confirmPlayerAsManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(Date.now() + 60000),
    });
  });

  test("exige App Check (reativado) enquanto preserva o handler", () => {
    expect(mockOnCallConfig).toEqual(expect.objectContaining({
      enforceAppCheck: true,
      consumeAppCheckToken: true,
    }));
  });

  test("dono eleva PENDING -> CONFIRMED e atualiza players_count", async () => {
    const {tx} = arrangeTransaction({
      target: confirmationDoc({status: "PENDING", position: "FIELD", user_id: "target"}),
      capacity: [capacityDoc({status: "CONFIRMED", position: "FIELD", user_id: "other"})],
    });

    const result = await confirmPlayerAsManager({
      auth: {uid: "owner1", token: {role: "USER"}},
      data: {gameId: "game1", userId: "target"},
    });

    expect(result).toMatchObject({success: true, alreadyConfirmed: false});
    expect(tx.update).toHaveBeenCalledWith(
      {path: "confirmations/game1_target"},
      expect.objectContaining({status: "CONFIRMED", confirmed_by_manager: "owner1"})
    );
    expect(tx.update).toHaveBeenCalledWith(
      {path: "games/game1"},
      expect.objectContaining({players_count: 2})
    );
  });

  test("#3874: grava capacity_sync_token para o trigger nao somar +1 por cima", async () => {
    // Contrato #3501: quem escreve players_count em valor absoluto na mesma
    // transacao DEVE trocar o capacity_sync_token da confirmacao, senao
    // onConfirmationWrite aplica FieldValue.increment(1) por cima e infla
    // os contadores do jogo (espelha confirm-game-presence.test.ts).
    const {tx} = arrangeTransaction({
      target: confirmationDoc({status: "PENDING", position: "GOALKEEPER", user_id: "target"}),
      capacity: [capacityDoc({status: "CONFIRMED", position: "FIELD", user_id: "other"})],
    });

    await confirmPlayerAsManager({
      auth: {uid: "owner1", token: {role: "USER"}},
      data: {gameId: "game1", userId: "target"},
    });

    expect(tx.update).toHaveBeenCalledWith(
      {path: "confirmations/game1_target"},
      expect.objectContaining({capacity_sync_token: expect.any(String)})
    );
    // Escrita absoluta dos contadores continua correta na mesma transacao.
    expect(tx.update).toHaveBeenCalledWith(
      {path: "games/game1"},
      expect.objectContaining({players_count: 2, goalkeepers_count: 1})
    );
  });

  test("co-organizador pode confirmar", async () => {
    arrangeTransaction({
      game: gameDoc({owner_id: "owner1", co_organizers: ["coorg1"]}),
      target: confirmationDoc({status: "PENDING", position: "FIELD"}),
    });

    const result = await confirmPlayerAsManager({
      auth: {uid: "coorg1", token: {role: "USER"}},
      data: {gameId: "game1", userId: "target"},
    });

    expect(result).toMatchObject({success: true});
  });

  test("idempotente: já CONFIRMED retorna alreadyConfirmed sem reescrever", async () => {
    const {tx} = arrangeTransaction({
      target: confirmationDoc({status: "CONFIRMED", position: "FIELD"}),
    });

    const result = await confirmPlayerAsManager({
      auth: {uid: "owner1", token: {role: "USER"}},
      data: {gameId: "game1", userId: "target"},
    });

    expect(result).toMatchObject({success: true, alreadyConfirmed: true});
    expect(tx.update).not.toHaveBeenCalled();
  });

  test("nao-gestor recebe permission-denied", async () => {
    arrangeTransaction({
      game: gameDoc({owner_id: "owner1", co_organizers: []}),
      target: confirmationDoc({status: "PENDING", position: "FIELD"}),
    });

    await expect(confirmPlayerAsManager({
      auth: {uid: "outsider", token: {role: "USER"}},
      data: {gameId: "game1", userId: "target"},
    })).rejects.toMatchObject({code: "permission-denied"});
  });

  test("jogo lotado rejeita com resource-exhausted", async () => {
    arrangeTransaction({
      game: gameDoc({max_players: 1, owner_id: "owner1"}),
      target: confirmationDoc({status: "PENDING", position: "FIELD"}),
      capacity: [capacityDoc({status: "CONFIRMED", position: "FIELD", user_id: "other", id: "cap_other"})],
    });

    await expect(confirmPlayerAsManager({
      auth: {uid: "owner1", token: {role: "USER"}},
      data: {gameId: "game1", userId: "target"},
    })).rejects.toMatchObject({code: "resource-exhausted"});
  });

  test("confirmacao inexistente (summon nao feito) rejeita not-found", async () => {
    arrangeTransaction({
      target: confirmationDoc(),
    });

    await expect(confirmPlayerAsManager({
      auth: {uid: "owner1", token: {role: "USER"}},
      data: {gameId: "game1", userId: "target"},
    })).rejects.toMatchObject({code: "not-found"});
  });

  test("auto-confirmacao por nao-admin rejeita invalid-argument", async () => {
    arrangeTransaction({});

    await expect(confirmPlayerAsManager({
      auth: {uid: "owner1", token: {role: "USER"}},
      data: {gameId: "game1", userId: "owner1"},
    })).rejects.toMatchObject({code: "invalid-argument"});
  });

  test("admin global pode confirmar qualquer jogador", async () => {
    arrangeTransaction({
      game: gameDoc({owner_id: "someoneElse"}),
      target: confirmationDoc({status: "PENDING", position: "FIELD"}),
    });

    const result = await confirmPlayerAsManager({
      auth: {uid: "admin1", token: {role: "ADMIN"}},
      data: {gameId: "game1", userId: "target"},
    });

    expect(result).toMatchObject({success: true});
  });

  test("jogo fora de SCHEDULED/CONFIRMED rejeita failed-precondition", async () => {
    arrangeTransaction({
      game: gameDoc({status: "FINISHED"}),
      target: confirmationDoc({status: "PENDING", position: "FIELD"}),
    });

    await expect(confirmPlayerAsManager({
      auth: {uid: "owner1", token: {role: "USER"}},
      data: {gameId: "game1", userId: "target"},
    })).rejects.toMatchObject({code: "failed-precondition"});
  });
});
