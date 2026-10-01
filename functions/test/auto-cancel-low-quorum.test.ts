const mockSendNotificationToUsers = jest.fn().mockResolvedValue(1);
const mockSendNotificationToUser = jest.fn().mockResolvedValue(true);
const mockSaveNotificationToFirestore = jest.fn().mockResolvedValue("notif-id");
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocSet = jest.fn().mockResolvedValue(undefined);
const mockRunTransaction = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockCollectionGet = jest.fn();
const mockCollectionAdd = jest.fn().mockResolvedValue({id: "audit-1"});
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue([]);

// Issue #3974: mock apenas startSchedulerHeartbeat (mantendo
// acquire/release reais via jest.requireActual), para controlar
// isLost() e testar o abort gracioso quando o lock é perdido.
const mockHeartbeatStop = jest.fn();
const mockHeartbeatIsLost = jest.fn().mockReturnValue(false);
const mockHeartbeatHandle = {
  stop: mockHeartbeatStop,
  isLost: mockHeartbeatIsLost,
};
const mockStartSchedulerHeartbeat = jest.fn(() => mockHeartbeatHandle);

// FIX #3968: a query agora é paginada (orderBy + limit + startAfter com
// cursor). A chain fluente do mock precisa suportar todos os terminais,
// caso contrário `.orderBy(...).limit(...).startAfter(...).get()` quebra.
const queryChain: any = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  get: mockCollectionGet,
};

const mockDoc = jest.fn((id: string) => ({
  id,
  get: jest.fn(),
  update: mockDocUpdate,
  set: mockDocSet,
  // FIX #4133: subcoleção waitlist do jogo (games/{id}/waitlist).
  collection: jest.fn(() => ({
    where: queryChain.where,
    orderBy: queryChain.orderBy,
    limit: queryChain.limit,
    get: mockCollectionGet,
  })),
}));

const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  where: queryChain.where,
  orderBy: queryChain.orderBy,
  limit: queryChain.limit,
  startAfter: queryChain.startAfter,
  get: mockCollectionGet,
  add: mockCollectionAdd,
}));

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  delete: jest.fn(() => ({ _type: "FieldDelete" })),
};
const mockTimestamp = {
  fromDate: jest.fn((d: Date) => ({ toDate: () => d, _type: "Timestamp" })),
  now: jest.fn(() => ({ toDate: () => new Date(), _type: "Timestamp" })),
};
const mockFirestore = jest.fn(() => ({
  collection: mockCollection,
  FieldValue: mockFieldValue,
  Timestamp: mockTimestamp,
  runTransaction: mockRunTransaction,
  // FIX #4133: batch de expiração da waitlist.
  batch: jest.fn(() => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
}));

(mockFirestore as any).FieldValue = mockFieldValue;
(mockFirestore as any).Timestamp = mockTimestamp;

jest.mock("firebase-admin", () => ({
  apps: [{ name: "test" }],
  initializeApp: jest.fn(),
  firestore: mockFirestore,
}));

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_c: any, h: any) => h),
}));

jest.mock("../src/notifications", () => ({
  sendNotificationToUser: mockSendNotificationToUser,
  sendNotificationToUsers: mockSendNotificationToUsers,
  saveNotificationToFirestore: mockSaveNotificationToFirestore,
  NotificationType: {
    GAME_CANCELLED: "GAME_CANCELLED",
    GAME_REMINDER: "GAME_REMINDER",
    GAME_SUMMON: "GAME_SUMMON",
  },
}));

// Issue #3974: partial mock — acquireSchedulerLock e releaseSchedulerLock
// continuam reais (exercitam mockRunTransaction/mockTransactionGet como
// antes), só startSchedulerHeartbeat é substituído para permitir
// controlar isLost() nos testes de abort.
jest.mock("../src/utils/scheduler-lock", () => {
  const actual = jest.requireActual("../src/utils/scheduler-lock");
  return {
    ...actual,
    startSchedulerHeartbeat: mockStartSchedulerHeartbeat,
  };
});

import {autoCancelLowQuorum} from "../src/reminders";
import {logger} from "firebase-functions";

describe("autoCancelLowQuorum", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Issue #3974: isLost() default false — abort só é exercitado no
    // teste específico de lock perdido.
    mockHeartbeatIsLost.mockReturnValue(false);
    mockStartSchedulerHeartbeat.mockReturnValue(mockHeartbeatHandle);
    mockRunTransaction.mockImplementation(async (callback: any) =>
      callback({
        get: mockTransactionGet,
        set: mockTransactionSet,
        update: mockTransactionUpdate,
      })
    );
    mockTransactionGet.mockResolvedValue({
      exists: false,
      data: () => null,
    });
  });

  it("cancela jogo CONFIRMED com poucos jogadores dentro de 2h", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const gameData = {
      status: "CONFIRMED",
      dateTime: { toDate: () => futureDate },
      location_name: "Campo 1",
      date: "2026-05-25",
    };
    const gameRef = { id: "game1" };
    mockCollectionGet.mockResolvedValueOnce({
      docs: [
        {
          id: "game1",
          ref: gameRef,
          data: () => gameData,
        },
      ],
      size: 1,
    });
    mockTransactionGet
      .mockResolvedValueOnce({
        exists: false,
        data: () => null,
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => gameData,
      })
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ user_id: "user1" }) },
          { data: () => ({ user_id: "user2" }) },
        ],
        size: 2,
      });

    await autoCancelLowQuorum();

    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      gameRef,
      expect.objectContaining({
        status: "CANCELLED",
        auto_cancelled: true,
        cancel_reason: "Baixo quórum",
      })
    );
    expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
      ["user1", "user2"],
      expect.objectContaining({ title: "Jogo cancelado" })
    );
  });

  it("nao cancela jogo com jogadores suficientes", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const gameData = {
      status: "CONFIRMED",
      dateTime: { toDate: () => futureDate },
    };
    mockCollectionGet.mockResolvedValueOnce({
      docs: [
        {
          id: "game1",
          ref: { id: "game1" },
          data: () => gameData,
        },
      ],
      size: 1,
    });
    mockTransactionGet
      .mockResolvedValueOnce({
        exists: false,
        data: () => null,
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => gameData,
      })
      .mockResolvedValueOnce({
        docs: Array.from({ length: 8 }, (_, i) => ({
          data: () => ({ user_id: `user${i}` }),
        })),
        size: 8,
      });

    await autoCancelLowQuorum();

    expect(mockTransactionUpdate).not.toHaveBeenCalled();
  });

  it("pula jogos ja auto-cancelados", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const gameData = {
      status: "CONFIRMED",
      dateTime: { toDate: () => futureDate },
      auto_cancelled: true,
    };
    mockCollectionGet.mockResolvedValueOnce({
      docs: [
        {
          id: "game1",
          ref: { id: "game1" },
          data: () => gameData,
        },
      ],
      size: 1,
    });
    mockTransactionGet
      .mockResolvedValueOnce({
        exists: false,
        data: () => null,
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => gameData,
      });

    await autoCancelLowQuorum();

    expect(mockTransactionUpdate).not.toHaveBeenCalled();
  });

  it("usa min_players customizado do jogo", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const gameData = {
      status: "CONFIRMED",
      dateTime: { toDate: () => futureDate },
      min_players: 4,
      location_name: "Campo",
      date: "2026-05-25",
    };
    const gameRef = { id: "game1" };
    mockCollectionGet.mockResolvedValueOnce({
      docs: [
        {
          id: "game1",
          ref: gameRef,
          data: () => gameData,
        },
      ],
      size: 1,
    });
    mockTransactionGet
      .mockResolvedValueOnce({
        exists: false,
        data: () => null,
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => gameData,
      })
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ user_id: "user1" }) },
          { data: () => ({ user_id: "user2" }) },
          { data: () => ({ user_id: "user3" }) },
        ],
        size: 3,
      });

    await autoCancelLowQuorum();

    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      gameRef,
      expect.objectContaining({ status: "CANCELLED" })
    );
  });

  it("#4133: nao cancela jogo CHEIO com max_players menor que o default", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const gameData = {
      status: "CONFIRMED",
      dateTime: { toDate: () => futureDate },
      max_players: 5,
      location_name: "Quadra pequena",
      date: "2026-10-01",
    };
    mockCollectionGet.mockResolvedValueOnce({
      docs: [
        {
          id: "game-small",
          ref: { id: "game-small" },
          data: () => gameData,
        },
      ],
      size: 1,
    });
    mockTransactionGet
      .mockResolvedValueOnce({
        exists: false,
        data: () => null,
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => gameData,
      })
      .mockResolvedValueOnce({
        docs: Array.from({length: 5}, (_, i) => ({
          data: () => ({user_id: `user${i}`}),
        })),
        size: 5,
      });

    await autoCancelLowQuorum();

    // 5 confirmados = jogo cheio (max_players 5): não cancela mesmo com
    // min_players ausente (default 6 > max 5).
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
    expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
  });

  it("#4133/#1786: opt-out auto_cancel_enabled=false pula o cancelamento", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const gameData = {
      status: "CONFIRMED",
      dateTime: { toDate: () => futureDate },
      auto_cancel_enabled: false,
      location_name: "Campo",
      date: "2026-10-01",
    };
    mockCollectionGet.mockResolvedValueOnce({
      docs: [
        {
          id: "game-optout",
          ref: { id: "game-optout" },
          data: () => gameData,
        },
      ],
      size: 1,
    });
    mockTransactionGet
      .mockResolvedValueOnce({
        exists: false,
        data: () => null,
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => gameData,
      })
      .mockResolvedValueOnce({
        docs: [{data: () => ({user_id: "user1"})}],
        size: 1,
      });

    await autoCancelLowQuorum();

    expect(mockTransactionUpdate).not.toHaveBeenCalled();
    expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
  });

  it("#4133/#1786: cancelamento expira waitlist, notifica e grava audit log", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const gameData = {
      status: "CONFIRMED",
      dateTime: { toDate: () => futureDate },
      location_name: "Campo 1",
      date: "2026-10-01",
    };
    const gameRef = {id: "game1"};
    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [{id: "game1", ref: gameRef, data: () => gameData}],
        size: 1,
      })
      .mockResolvedValueOnce({
        empty: false,
        size: 2,
        docs: [
          {
            ref: {id: "wl-a", parent: {parent: {id: "game1"}}},
            data: () => ({user_id: "wl-user-a", status: "WAITING"}),
          },
          {
            ref: {id: "wl-b", parent: {parent: {id: "game1"}}},
            data: () => ({user_id: "wl-user-b", status: "NOTIFIED"}),
          },
        ],
      });
    mockTransactionGet
      .mockResolvedValueOnce({
        exists: false,
        data: () => null,
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => gameData,
      })
      .mockResolvedValueOnce({
        docs: [{data: () => ({user_id: "user1"})}],
        size: 1,
      });

    await autoCancelLowQuorum();

    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({id: "wl-a"}),
      expect.objectContaining({
        status: "EXPIRED",
        expired_reason: "game_cancelled",
      })
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({id: "wl-b"}),
      expect.objectContaining({status: "EXPIRED"})
    );
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
      ["wl-user-a", "wl-user-b"],
      expect.objectContaining({type: "GAME_CANCELLED"})
    );
    expect(mockCollectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "AUTO_CANCEL_LOW_QUORUM",
        target_id: "game1",
        reason: "LOW_QUORUM",
      })
    );
  });

  it("nao cancela quando nao ha jogos na janela", async () => {
    mockCollectionGet.mockResolvedValueOnce({
      docs: [],
      size: 0,
    });

    await autoCancelLowQuorum();

    expect(mockTransactionUpdate).not.toHaveBeenCalled();
  });

  it("pula execucao quando lock agendado ja esta em andamento", async () => {
    mockRunTransaction.mockResolvedValueOnce(false);

    await autoCancelLowQuorum();

    expect(mockCollectionGet).not.toHaveBeenCalled();
  });

  it.each(["LIVE", "FINISHED", "CANCELLED"])(
    "nao regride jogo que mudou para %s durante a execucao",
    async (status) => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      const initialGameData = {
        status: "CONFIRMED",
        dateTime: { toDate: () => futureDate },
      };
      mockCollectionGet.mockResolvedValueOnce({
        docs: [
          {
            id: "game1",
            ref: { id: "game1" },
            data: () => initialGameData,
          },
        ],
        size: 1,
      });
      mockTransactionGet
        .mockResolvedValueOnce({
          exists: false,
          data: () => null,
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ ...initialGameData, status }),
        });

      await autoCancelLowQuorum();

      expect(mockTransactionUpdate).not.toHaveBeenCalled();
      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    }
  );

  it("reconta confirmacoes dentro da transacao antes de cancelar", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const gameData = {
      status: "CONFIRMED",
      dateTime: { toDate: () => futureDate },
    };
    mockCollectionGet.mockResolvedValueOnce({
      docs: [
        {
          id: "game1",
          ref: { id: "game1" },
          data: () => gameData,
        },
      ],
      size: 1,
    });
    mockTransactionGet
      .mockResolvedValueOnce({
        exists: false,
        data: () => null,
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => gameData,
      })
      .mockResolvedValueOnce({
        docs: Array.from({ length: 6 }, (_, i) => ({
          data: () => ({ user_id: `user${i}` }),
        })),
        size: 6,
      });

    await autoCancelLowQuorum();

    expect(mockTransactionUpdate).not.toHaveBeenCalled();
    expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
  });

  // ---- FIX #3968: hardening da varredura ----

  it("pagina a query com orderBy + limit + startAfter (cursor avanca a cauda)", async () => {
    // Página 1 cheia (100 docs): como o default do mockTransactionGet é
    // exists:false, todos pulam com 1 get cada — cenário barato que
    // exercita só a mecânica de paginação. Página 2 vem parcial (3 docs)
    // e drena a janela.
    const makeDoc = (id: string) => ({
      id,
      ref: { id },
      data: () => ({}),
    });
    const page1 = Array.from({length: 100}, (_, i) =>
      makeDoc(`game-p1-${i}`)
    );
    const page2 = Array.from({length: 3}, (_, i) =>
      makeDoc(`game-p2-${i}`)
    );

    mockCollectionGet
      .mockResolvedValueOnce({ docs: page1, size: 100 })
      .mockResolvedValueOnce({ docs: page2, size: 3 });

    await autoCancelLowQuorum();

    // Query paginada declarada explicitamente.
    expect(queryChain.orderBy).toHaveBeenCalledWith("dateTime", "asc");
    expect(queryChain.limit).toHaveBeenCalledWith(100);
    // Cursor avançou: startAfter chamado com o ÚLTIMO doc processado da
    // página 1 — prova que a cauda avança entre execuções consecutivas.
    expect(queryChain.startAfter).toHaveBeenCalledTimes(1);
    expect(queryChain.startAfter).toHaveBeenCalledWith(page1[99]);
    // Duas páginas lidas; nenhuma além do esgotamento da janela.
    expect(mockCollectionGet).toHaveBeenCalledTimes(2);
  });

  it("isola falha por doc: jogo que lança não aborta o lote", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const game2Data = {
      status: "CONFIRMED",
      dateTime: { toDate: () => futureDate },
      location_name: "Campo 2",
      date: "2026-05-25",
    };
    const game1Ref = { id: "game1" };
    const game2Ref = { id: "game2" };

    mockCollectionGet.mockResolvedValueOnce({
      docs: [
        { id: "game1", ref: game1Ref, data: () => ({}) },
        { id: "game2", ref: game2Ref, data: () => ({}) },
      ],
      size: 2,
    });

    // Ordem das transações: (1) lock acquire, (2) jogo 1 -> lança,
    // (3) jogo 2 -> cancela, (4) lock release (default do beforeEach).
    mockRunTransaction
      .mockImplementationOnce(async (callback: any) => callback({
        get: mockTransactionGet,
        set: mockTransactionSet,
        update: mockTransactionUpdate,
      }))
      .mockImplementationOnce(async () => {
        throw new Error("transação indisponível");
      });

    // gets da tx: lock acquire (exists:false) + jogo 2 doc + jogo 2 confs.
    mockTransactionGet
      .mockResolvedValueOnce({ exists: false, data: () => null })
      .mockResolvedValueOnce({ exists: true, data: () => game2Data })
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ user_id: "userA" }) },
          { data: () => ({ user_id: "userB" }) },
        ],
        size: 2,
      });

    await autoCancelLowQuorum();

    // Jogo 1 não chegou a atualizar (lançou antes); jogo 2 sim.
    expect(mockTransactionUpdate).toHaveBeenCalledTimes(1);
    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      game2Ref,
      expect.objectContaining({ status: "CANCELLED" })
    );
    expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
      ["userA", "userB"],
      expect.objectContaining({ title: "Jogo cancelado" })
    );
    // Erro do jogo 1 foi logado (não propagado).
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[AUTO_CANCEL] Erro ao processar jogo game1:"),
      expect.any(Error)
    );
  });

  it("respeita orçamento de tempo: para antes do deadline e emite aviso de backlog", async () => {
    const gameRef = { id: "game1" };
    mockCollectionGet.mockResolvedValueOnce({
      docs: [
        { id: "game1", ref: gameRef, data: () => ({}) },
        { id: "game2", ref: { id: "game2" }, data: () => ({}) },
        { id: "game3", ref: { id: "game3" }, data: () => ({}) },
      ],
      size: 3,
    });

    // Controla Date.now: as 2 primeiras chamadas (cálculo do deadline +
    // checagem do while) retornam 0; a partir da 3ª (checagem por doc)
    // retornam um valor acima do orçamento -> budget hit no 1º doc.
    const HUGE = 10_000_000;
    let nowCalls = 0;
    const dateNowSpy = jest
      .spyOn(Date, "now")
      .mockImplementation(() => {
        nowCalls += 1;
        return nowCalls <= 2 ? 0 : HUGE;
      });

    try {
      await autoCancelLowQuorum();

      // Nenhum jogo foi processado (deadline estourou antes do 1º doc).
      expect(mockTransactionUpdate).not.toHaveBeenCalled();
      // Apenas uma página foi lida — o laço parou limpo.
      expect(mockCollectionGet).toHaveBeenCalledTimes(1);
      // Sinal de saturação emitido.
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("backlog")
      );
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  // ===== Issue #3974: abort gracioso quando o lock é perdido =====

  it("#3974: aborta a execucao quando heartbeat reporta lock perdido antes do loop", async () => {
    // Defeito A: antes o retorno boolean do heartbeat era descartado.
    // Agora o caller checa isLost() e aborta para evitar writes
    // conflitantes com o novo owner.
    mockHeartbeatIsLost.mockReturnValue(true);

    await autoCancelLowQuorum();

    // Nenhum jogo foi queryado — abortou no primeiro cheque do loop.
    expect(mockCollectionGet).not.toHaveBeenCalled();
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
    // Lock perdido é CRITICAL — logado em error.
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Scheduler lock perdido durante execucao")
    );
    // Heartbeat foi interrompido no finally.
    expect(mockHeartbeatStop).toHaveBeenCalled();
  });

  it("#3974: NAO chama releaseSchedulerLock quando o lock foi perdido", async () => {
    // Quando o lock foi tomado por outro owner, release seria rejeitado
    // (owner divergente) e só geraria ruído — o novo owner cuida da
    // liberação. Verifica-se que o finally pula o release.
    mockHeartbeatIsLost.mockReturnValue(true);
    const releaseSpy = jest.spyOn(
      require("../src/utils/scheduler-lock"),
      "releaseSchedulerLock"
    );

    try {
      await autoCancelLowQuorum();

      expect(releaseSpy).not.toHaveBeenCalled();
      // acquire ainda foi chamado (lock obtido antes de ser perdido).
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Pulando release do lock"),
      );
    } finally {
      releaseSpy.mockRestore();
    }
  });
});
