/**
 * Testes de regressão — #3941 (notification queue hardening)
 *
 * Cobre os defeitos F1-F5 corrigidos:
 * - F1: recoverStaleProcessingDocs paginado (>100 docs) + revertDocToPending
 * - F2: getNotificationSettingsBatch (batch read) + shouldNotifyWithSettings
 *       (filtro em memória, sem N+1)
 * - F3: enqueueNotification fatia >QUEUE_MAX_RECIPIENTS_PER_DOC em N docs
 * - F4: isTransientError inclui quota-exceeded / message-rate-exceeded
 */

jest.mock("../src/middleware/rate-limiter");

// ==========================================
// MOCKS DO FIREBASE ADMIN (configuráveis por teste)
// ==========================================

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({})),
  delete: jest.fn(() => ({_type: "FieldValueDelete"})),
  increment: jest.fn((n: number) => ({_type: "Increment", operand: n})),
  arrayUnion: jest.fn((...v: unknown[]) => ({_type: "AU", values: v})),
  arrayRemove: jest.fn((...v: unknown[]) => ({_type: "AR", values: v})),
};

const mockTimestamp = {
  fromDate: jest.fn((d: Date) => ({toDate: () => d})),
  now: jest.fn(() => ({toDate: () => new Date()})),
};

// Estado configurável por teste (lido em tempo de execução pelos mocks).
let queryGetImpl: () => Promise<unknown> = async () => ({empty: true, size: 0, docs: []});
let batchInstance: {
  update: jest.Mock;
  set: jest.Mock;
  delete: jest.Mock;
  commit: jest.Mock;
};
let txGetImpl: () => Promise<unknown> = async () => ({exists: false, data: () => ({}), id: ""});
let txUpdateMock: jest.Mock;
let getAllImpl: (refs: {id: string}[]) => Promise<unknown[]>;
let docIdCounter = 0;

jest.mock("firebase-admin", () => {
  const adminMock: unknown = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: jest.fn((id?: string) => ({
          id: id ?? `auto-${++docIdCounter}`,
          set: jest.fn().mockResolvedValue(undefined),
          get: jest.fn().mockResolvedValue({exists: false, data: () => ({})}),
          update: jest.fn().mockResolvedValue(undefined),
        })),
        add: jest.fn(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        startAfter: jest.fn().mockReturnThis(),
        get: jest.fn(() => queryGetImpl()),
      })),
      batch: jest.fn(() => batchInstance),
      runTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({get: jest.fn(() => txGetImpl()), update: txUpdateMock})),
      getAll: jest.fn((...refs: {id: string}[]) => getAllImpl(refs)),
    })),
    messaging: jest.fn(() => ({sendEachForMulticast: jest.fn()})),
    initializeApp: jest.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = adminMock as any;
  adminAny.firestore.FieldValue = mockFieldValue;
  adminAny.firestore.Timestamp = mockTimestamp;
  adminAny.firestore.FieldPath = {documentId: jest.fn(() => "__name__")};
  return adminMock;
});

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn(() => jest.fn()),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn(() => jest.fn()),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// FieldValue/FieldPath/Timestamp são importados de "firebase-admin/firestore"
// (subpath distinto) — espelhar os mesmos mocks do firebase-admin.
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: mockFieldValue,
  FieldPath: {documentId: jest.fn(() => "__name__")},
  Timestamp: mockTimestamp,
}));

// Importa AFTER os mocks.
import * as admin from "firebase-admin";
import {
  __testing as batchTesting,
  enqueueNotification,
} from "../src/notifications/batch-sender";
import {
  isTransientError,
  shouldNotifyWithSettings,
  getNotificationSettingsBatch,
} from "../src/notifications/helpers";
import {resetDb} from "../src/_db";
import {QUEUE_MAX_RECIPIENTS_PER_DOC} from "../src/constants";

// Helpers para construir snapshots.
function makeDoc(id: string, data: Record<string, unknown>) {
  return {ref: {id}, data: () => data};
}

function makeBatch() {
  return {
    update: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetDb(); // _db cacheia a instância — resetar para reusar o mock atual.
  docIdCounter = 0;
  batchInstance = makeBatch();
  txUpdateMock = jest.fn();
  getAllImpl = async () => [];
});

// ==========================================
// F4 — isTransientError inclui códigos de quota
// ==========================================

describe("#3941 F4 — isTransientError", () => {
  test("classifica messaging/quota-exceeded como transiente (retentável)", () => {
    expect(isTransientError({code: "messaging/quota-exceeded"})).toBe(true);
  });

  test("classifica messaging/message-rate-exceeded como transiente", () => {
    expect(isTransientError({code: "messaging/message-rate-exceeded"})).toBe(true);
  });

  test("classifica messaging/server-unavailable como transiente (regressão)", () => {
    expect(isTransientError({code: "messaging/server-unavailable"})).toBe(true);
  });

  test("NÃO classifica token inválido como transiente", () => {
    expect(
      isTransientError({code: "messaging/registration-token-not-registered"}),
    ).toBe(false);
  });
});

// ==========================================
// F2 — shouldNotifyWithSettings (filtro em memória)
// ==========================================

describe("#3941 F2 — shouldNotifyWithSettings", () => {
  test("allow quando settings ausente no mapa (fail-open)", () => {
    expect(shouldNotifyWithSettings(undefined, "GAME_INVITE")).toBe(true);
  });

  test("deny quando push global desativado", () => {
    expect(
      shouldNotifyWithSettings(
        {
          pushEnabled: false,
          gameReminders: true,
          muteUntil: null,
          muteGroups: [],
          raw: {push_enabled: false},
        },
        "GAME_INVITE",
      ),
    ).toBe(false);
  });

  test("deny quando grupo está silenciado", () => {
    expect(
      shouldNotifyWithSettings(
        {
          pushEnabled: true,
          gameReminders: true,
          muteUntil: null,
          muteGroups: ["group-1"],
          raw: {muteGroups: ["group-1"]},
        },
        "GAME_INVITE",
        "group-1",
      ),
    ).toBe(false);
  });

  test("deny quando tipo específico desativado (snake_case)", () => {
    expect(
      shouldNotifyWithSettings(
        {
          pushEnabled: true,
          gameReminders: true,
          muteUntil: null,
          muteGroups: [],
          raw: {game_invites: false},
        },
        "GAME_INVITE",
      ),
    ).toBe(false);
  });

  test("allow quando tudo habilitado", () => {
    expect(
      shouldNotifyWithSettings(
        {
          pushEnabled: true,
          gameReminders: true,
          muteUntil: null,
          muteGroups: [],
          raw: {},
        },
        "GAME_INVITE",
      ),
    ).toBe(true);
  });
});

// ==========================================
// F2 — getNotificationSettingsBatch (leitura batched)
// ==========================================

describe("#3941 F2 — getNotificationSettingsBatch", () => {
  test("lê preferências de múltiplos usuários em uma única chamada getAll", async () => {
    getAllImpl = async (refs) =>
      refs.map((r) => ({
        id: r.id,
        exists: r.id === "user-1",
        data: () => (r.id === "user-1" ? {push_enabled: false} : {}),
      }));

    const map = await getNotificationSettingsBatch(["user-1", "user-2"]);

    // Ambos presentes no mapa.
    expect(map.size).toBe(2);
    // user-1 desativou push explicitamente.
    expect(map.get("user-1")?.pushEnabled).toBe(false);
    // user-2 sem doc => fail-open (tudo habilitado).
    expect(map.get("user-2")?.pushEnabled).toBe(true);
  });

  test("deduplica userIds repetidos", async () => {
    let calls = 0;
    getAllImpl = async (refs) => {
      calls++;
      return refs.map((r) => ({id: r.id, exists: false, data: () => ({})}));
    };

    const map = await getNotificationSettingsBatch(["user-1", "user-1", "user-2"]);

    expect(map.size).toBe(2);
    expect(calls).toBe(1);
  });

  test("retorna mapa vazio para lista vazia (sem chamada ao Firestore)", async () => {
    let called = false;
    getAllImpl = async () => {
      called = true;
      return [];
    };

    const map = await getNotificationSettingsBatch([]);

    expect(map.size).toBe(0);
    expect(called).toBe(false);
  });
});

// ==========================================
// F1 — recoverStaleProcessingDocs (paginação)
// ==========================================

describe("#3941 F1 — recoverStaleProcessingDocs", () => {
  test("pagina além de 100 docs (corrigindo o bug do .limit(100) sem loop)", async () => {
    // Duas páginas: 500 + 50 = 550 docs stale, depois vazio.
    const page1 = Array.from({length: 500}, (_, i) =>
      makeDoc(`doc-${i}`, {retry_count: 0}),
    );
    const page2 = Array.from({length: 50}, (_, i) =>
      makeDoc(`doc-${i + 500}`, {retry_count: 0}),
    );
    const pages = [page1, page2, []];
    let pageIdx = 0;
    queryGetImpl = async () => {
      const page = pages[pageIdx++] || [];
      return {empty: page.length === 0, size: page.length, docs: page};
    };

    const firestore = admin.firestore();
    const recovered = await batchTesting.recoverStaleProcessingDocs(firestore as never);

    // 550 recuperados (antes o .limit(100) deixaria 450 presos).
    expect(recovered).toBe(550);
    // 2 passadas de query (500, 50); a curta (50 < 500) encerra o loop sem
    // precisar de uma query vazia extra.
    expect(pageIdx).toBe(2);
    // Cada doc resetado a PENDING com retry_count increment(1).
    expect(batchInstance.update).toHaveBeenCalledTimes(550);
    const firstUpdate = batchInstance.update.mock.calls[0][1];
    expect(firstUpdate.status).toBe("PENDING");
    expect(firstUpdate.retry_count).toEqual({_type: "Increment", operand: 1});
    // Dois commits de batch (uma por página não-vazia).
    expect(batchInstance.commit).toHaveBeenCalledTimes(2);
  });

  test("marca como FAILED quando retry_count já excedeu o máximo", async () => {
    const page = [makeDoc("doc-x", {retry_count: 99})];
    queryGetImpl = async () => ({
      empty: false,
      size: 1,
      docs: page,
    });
    // Simula que após o reset a próxima query retorna vazio.
    const origImpl = queryGetImpl;
    let secondCall = false;
    queryGetImpl = async () => {
      if (!secondCall) {
        secondCall = true;
        return origImpl();
      }
      return {empty: true, size: 0, docs: []};
    };

    const firestore = admin.firestore();
    const recovered = await batchTesting.recoverStaleProcessingDocs(firestore as never);

    expect(recovered).toBe(1);
    expect(batchInstance.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({status: "FAILED"}),
    );
  });

  test("retorna 0 quando não há docs stale", async () => {
    queryGetImpl = async () => ({empty: true, size: 0, docs: []});

    const firestore = admin.firestore();
    const recovered = await batchTesting.recoverStaleProcessingDocs(firestore as never);

    expect(recovered).toBe(0);
    expect(batchInstance.commit).not.toHaveBeenCalled();
  });
});

// ==========================================
// F1/F5 — revertDocToPending (reverte claim órfã)
// ==========================================

describe("#3941 F5 — revertDocToPending", () => {
  test("reverte PROCESSING a PENDING com retry_count incrementado", async () => {
    // MAX_RETRY_COUNT = 3; retry_count=1 -> next=2 < 3 => PENDING.
    txGetImpl = async () => ({
      exists: true,
      id: "doc-1",
      data: () => ({status: "PROCESSING", retry_count: 1}),
    });

    await batchTesting.revertDocToPending({ref: {id: "doc-1"}} as never);

    expect(txUpdateMock).toHaveBeenCalledTimes(1);
    const update = txUpdateMock.mock.calls[0][1];
    expect(update.status).toBe("PENDING");
    expect(update.retry_count).toBe(2);
    expect(update.processing_at).toEqual({_type: "FieldValueDelete"});
  });

  test("marca FAILED quando retry_count + 1 atinge o máximo", async () => {
    // MAX_RETRY_COUNT = 3; retry_count=2 -> next=3 >= 3 => FAILED.
    txGetImpl = async () => ({
      exists: true,
      id: "doc-2",
      data: () => ({status: "PROCESSING", retry_count: 2}),
    });
    // MAX_RETRY_COUNT = 3; 2 + 1 = 3 >= 3 => FAILED.

    await batchTesting.revertDocToPending({ref: {id: "doc-2"}} as never);

    const update = txUpdateMock.mock.calls[0][1];
    expect(update.status).toBe("FAILED");
    expect(update.failure_reason).toContain("Excedeu");
  });

  test("não reverte se o doc já não está mais em PROCESSING (CAS)", async () => {
    txGetImpl = async () => ({
      exists: true,
      id: "doc-3",
      data: () => ({status: "SENT"}),
    });

    await batchTesting.revertDocToPending({ref: {id: "doc-3"}} as never);

    expect(txUpdateMock).not.toHaveBeenCalled();
  });

  test("não reverte se o doc foi removido", async () => {
    txGetImpl = async () => ({exists: false, id: "doc-4", data: () => ({})});

    await batchTesting.revertDocToPending({ref: {id: "doc-4"}} as never);

    expect(txUpdateMock).not.toHaveBeenCalled();
  });
});

// ==========================================
// F3 — enqueueNotification fatia > QUEUE_MAX_RECIPIENTS_PER_DOC
// ==========================================

describe("#3941 F3 — enqueueNotification cap de fan-out", () => {
  test("cria um único doc para ≤ QUEUE_MAX_RECIPIENTS_PER_DOC destinatários", async () => {
    const userIds = Array.from({length: QUEUE_MAX_RECIPIENTS_PER_DOC}, (_, i) => `u-${i}`);

    const id = await enqueueNotification({
      userIds,
      title: "T",
      body: "B",
      type: "GAME_INVITE",
    });

    expect(id).toBe("auto-1");
    // Path ≤500 usa set direto no doc (não batch).
    expect(batchInstance.set).not.toHaveBeenCalled();
  });

  test("fatia > QUEUE_MAX_RECIPIENTS_PER_DOC em múltiplos docs via batch", async () => {
    const userIds = Array.from(
      {length: QUEUE_MAX_RECIPIENTS_PER_DOC + 100},
      (_, i) => `u-${i}`,
    );

    const id = await enqueueNotification({
      userIds,
      title: "T",
      body: "B",
      type: "GAME_INVITE",
    });

    // 2 chunks: 500 + 100.
    expect(batchInstance.set).toHaveBeenCalledTimes(2);
    const firstChunk = batchInstance.set.mock.calls[0][1];
    const secondChunk = batchInstance.set.mock.calls[1][1];
    expect(firstChunk.userIds).toHaveLength(QUEUE_MAX_RECIPIENTS_PER_DOC);
    expect(secondChunk.userIds).toHaveLength(100);
    // Ambos PENDING, mesmo type/title.
    expect(firstChunk.status).toBe("PENDING");
    expect(secondChunk.status).toBe("PENDING");
    expect(firstChunk.title).toBe("T");
    expect(secondChunk.title).toBe("T");
    // Commit único do batch.
    expect(batchInstance.commit).toHaveBeenCalledTimes(1);
    // Retorna id do primeiro doc.
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  test("retorna string vazia para nenhum destinatário", async () => {
    const id = await enqueueNotification({
      userIds: [],
      title: "T",
      body: "B",
      type: "GAME_INVITE",
    });

    expect(id).toBe("");
    expect(batchInstance.set).not.toHaveBeenCalled();
    expect(batchInstance.commit).not.toHaveBeenCalled();
  });
});
