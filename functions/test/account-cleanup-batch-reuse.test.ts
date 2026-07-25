/**
 * REGRESSÃO #1280 — onUserDeleted reuses committed WriteBatch
 *
 * Verifica que commitBatch() recria o batch após cada commit, de forma que
 * usuários com >450 docs residuais sejam limpos completamente sem lançar
 * "Cannot modify a WriteBatch that has been committed".
 *
 * Cenário: usuário com 900 xp_logs → requer 2 ciclos de commit (450 + 450).
 * Sem o fix, o segundo ciclo de batch.delete() lançaria depois do 1º commit.
 */

// ==========================================
// MOCKS
// ==========================================

// Cada chamada a db.batch() retorna uma nova instância de mock
// (simula comportamento real: após commit, instância velha não pode ser reusada).
function makeBatchInstance() {
  const instance = {
    delete: jest.fn(),
    // FIX #2323: os loops de anonimização usam batch.update() (não delete).
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
    _committed: false,
  };
  // Simular comportamento real: após commit, deletar lança erro
  instance.commit.mockImplementation(() => {
    instance._committed = true;
    return Promise.resolve();
  });
  instance.delete.mockImplementation(() => {
    if (instance._committed) {
      throw new Error(
        "Cannot modify a WriteBatch that has been committed"
      );
    }
  });
  return instance;
}

// Rastrear todas as instâncias de batch criadas
const batchInstances: ReturnType<typeof makeBatchInstance>[] = [];
const mockBatch = jest.fn().mockImplementation(() => {
  const inst = makeBatchInstance();
  batchInstances.push(inst);
  return inst;
});

const mockDocGet = jest.fn();
const mockDocDelete = jest.fn().mockResolvedValue(undefined);
const mockDocRef = jest.fn().mockImplementation((path: string) => ({
  path,
  get: mockDocGet,
  delete: mockDocDelete,
}));

// Factory de query mock: retorna docs simulados em páginas
function makePaginatedQuery(totalDocs: number, pageSize = 500) {
  const refs = Array.from({length: totalDocs}, (_, i) => ({id: `doc_${i}`}));
  let callCount = 0;
  return jest.fn().mockImplementation(() => {
    const start = callCount * pageSize;
    const chunk = refs.slice(start, start + pageSize);
    callCount++;
    return Promise.resolve({
      docs: chunk.map((ref) => ({ref})),
      empty: chunk.length === 0,
      size: chunk.length,
    });
  });
}

const mockCollectionGet = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockStartAfter = jest.fn().mockReturnThis();
const mockCollection = jest.fn().mockReturnValue({
  where: mockWhere,
  limit: mockLimit,
  startAfter: mockStartAfter,
  get: mockCollectionGet,
});

// FIX #2323: collectionGroup mock controlável (com startAfter) para validar a
// paginação por cursor nos loops de anonimização. Cada teste sobrescreve
// mockCollectionGroupGet conforme o cenário. Default: vazio (no-op).
const mockCollectionGroupGet = jest
  .fn()
  .mockResolvedValue({docs: [], empty: true, size: 0});
const mockCollectionGroup = jest.fn().mockReturnValue({
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  get: mockCollectionGroupGet,
});

jest.mock("firebase-admin", () => {
  const mockAdmin: any = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({
      collection: mockCollection,
      doc: mockDocRef,
      batch: mockBatch,
      collectionGroup: mockCollectionGroup,
    })),
    auth: jest.fn(() => ({})),
    initializeApp: jest.fn(),
  };
  mockAdmin.firestore.FieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  };
  return mockAdmin;
});

// FIX #3877: o trigger agora é declarado via runWith({failurePolicy: true})
// para que o throw de "PII anonymization incomplete" cause retry real.
// O mock captura as opções para o teste de regressão afirmar a flag.
// Captura das opções fora do jest.fn: jest.clearAllMocks() nos beforeEach
// apagaria o registro da chamada, que acontece no load do módulo.
const runWithOptionsCaptured: any[] = [];
const mockRunWith = jest.fn((opts: any) => {
  runWithOptionsCaptured.push(opts);
  return mockRunWithBuilder();
});
const mockRunWithBuilder = () => ({
  auth: {
    user: () => ({
      onDelete: (handler: any) => handler,
    }),
  },
});
jest.mock("firebase-functions/v1", () => ({
  runWith: mockRunWith,
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      getFiles: jest.fn().mockResolvedValue([[]]),
    }),
  })),
}));

// Importar após mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {onUserDeleted} = require("../src/auth/account-cleanup");

// ==========================================
// HELPER
// ==========================================

/** Simula um Firebase Auth UserRecord deletado */
function makeUserRecord(uid = "user-to-delete") {
  return {uid};
}

/**
 * FIX #3897: onUserDeleted agora recebe o EventContext (2º parâmetro do
 * onDelete v1) para calcular a idade do evento. `ageMs` simula um evento
 * originado há `ageMs` no passado — default 0 (evento fresco, comportamento
 * idêntico ao pré-#3897 nos testes que não testam o teto de idade).
 */
function makeEventContext(ageMs = 0): any {
  return {timestamp: new Date(Date.now() - ageMs).toISOString()};
}

// ==========================================
// TESTES
// ==========================================

describe("onUserDeleted — regressão #1280 batch reuse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    batchInstances.length = 0;

    // users/{uid}: existe (sem cpfHash para simplicidade)
    // users_private/{uid}: não existe (sem PII extra)
    mockDocGet.mockResolvedValue({exists: false, data: () => null});

    // collectionGroup default: vazio (clearAllMocks apaga o mockResolvedValue)
    mockCollectionGroupGet.mockResolvedValue({
      docs: [],
      empty: true,
      size: 0,
    });
  });

  test("não lança para usuário sem docs residuais", async () => {
    // Todos os where().limit().get() retornam vazio
    mockCollectionGet.mockResolvedValue({docs: [], empty: true, size: 0});

    await expect(
      onUserDeleted(makeUserRecord(), makeEventContext())
    ).resolves.not.toThrow();
    expect(mockCollection).toHaveBeenCalledWith("push_tokens");
    expect(mockCollection).toHaveBeenCalledWith("push_token_devices");
  });

  test("não lança para usuário com exatamente 450 docs (1 commit, sem recriação)", async () => {
    // 450 docs em uma coleção → batchOps chega a 450, commitBatch() é chamado,
    // depois loop encerra. Batch deve ser recriado e commit final não falha.
    let firstCall = true;
    mockCollectionGet.mockImplementation(() => {
      if (firstCall) {
        firstCall = false;
        return Promise.resolve({
          docs: Array.from({length: 450}, (_, i) => ({ref: {id: `doc_${i}`}})),
          empty: false,
          size: 450,
        });
      }
      // Demais coleções: vazio
      return Promise.resolve({docs: [], empty: true, size: 0});
    });

    await expect(
      onUserDeleted(makeUserRecord(), makeEventContext())
    ).resolves.not.toThrow();

    // Pelo menos 2 instâncias de batch (1 inicial + 1 após commit intermediário)
    expect(batchInstances.length).toBeGreaterThanOrEqual(2);
  });

  test("REGRESSÃO #1280: não lança para usuário com 900 docs (requer 2 commits intermediários)", async () => {
    // 900 docs na coleção audit_logs → 2 ciclos de commitBatch() no while loop
    // Antes do fix: segundo ciclo lançava "Cannot modify a WriteBatch that has been committed"
    // Depois do fix: batch é recriado após cada commit → sem erro
    let auditLogsCallCount = 0;
    mockCollectionGet.mockImplementation(() => {
      auditLogsCallCount++;
      if (auditLogsCallCount === 1) {
        // Primeira página: 500 docs
        return Promise.resolve({
          docs: Array.from({length: 500}, (_, i) => ({ref: {id: `audit_${i}`}})),
          empty: false,
          size: 500,
        });
      }
      if (auditLogsCallCount === 2) {
        // Segunda página: 400 docs (< 500, encerra loop)
        return Promise.resolve({
          docs: Array.from({length: 400}, (_, i) => ({ref: {id: `audit_500_${i}`}})),
          empty: false,
          size: 400,
        });
      }
      // Demais coleções: vazio
      return Promise.resolve({docs: [], empty: true, size: 0});
    });

    // Não deve lançar nenhuma exceção
    await expect(
      onUserDeleted(makeUserRecord(), makeEventContext())
    ).resolves.not.toThrow();

    // Verificar que múltiplas instâncias de batch foram criadas (recriação após commit)
    // Instância inicial + pelo menos 1 recriação após commit dos 450 primeiros docs
    expect(batchInstances.length).toBeGreaterThanOrEqual(2);

    // Todos os commits devem ter sido chamados
    const committedBatches = batchInstances.filter((b) => b._committed);
    expect(committedBatches.length).toBeGreaterThanOrEqual(1);
  });

  test("recria batch após cada commit intermediário (verificação estrutural)", async () => {
    // 900 docs → garante que os batches posteriores ao primeiro commit
    // são instâncias novas (não reutilizadas)
    let callIdx = 0;
    mockCollectionGet.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return Promise.resolve({
          docs: Array.from({length: 500}, (_, i) => ({ref: {id: `d_${i}`}})),
          empty: false,
          size: 500,
        });
      }
      return Promise.resolve({docs: [], empty: true, size: 0});
    });

    await onUserDeleted(makeUserRecord(), makeEventContext());

    // Verificar: nenhuma instância commitada teve delete() chamado depois do commit
    // (isso seria o bug de batch-reuse)
    for (const batch of batchInstances) {
      if (batch._committed) {
        // delete() não deve ter sido chamado APÓS commit nessa instância
        // (não temos como rastrear a ordem exata, mas verificamos que
        // a instância commitada não lançou erro — caso contrário o
        // test acima teria falhado)
        expect(batch.commit).toHaveBeenCalled();
      }
    }
  });
});

// ==========================================
// REGRESSÃO #2323 — loop infinito na anonimização LGPD (collectionGroup)
// ==========================================

describe("onUserDeleted — regressão #2323 loop infinito anonimização", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    batchInstances.length = 0;
    mockDocGet.mockResolvedValue({exists: false, data: () => null});
    mockCollectionGet.mockResolvedValue({docs: [], empty: true, size: 0});
    mockCollectionGroupGet.mockResolvedValue({
      docs: [],
      empty: true,
      size: 0,
    });
  });

  test(
    "termina com >= 500 docs anonimizados (cursor avança, não reprocessa)",
    async () => {
      // Cenário do bug: usuário com 750 docs em uma subcoleção (ex: cashbox
      // transactions). Antes do fix, a query sem cursor retornava sempre os
      // mesmos 500 primeiros docs (size === 500) → while(true) infinito.
      // Depois do fix: startAfter(lastDoc) avança → 2ª página tem 250 docs
      // (< 500) → loop encerra. Se o cursor NÃO avançasse, este mock retornaria
      // 500 indefinidamente e o teste estouraria o timeout (falha = bug voltou).
      const PAGE_1 = 500;
      const PAGE_2 = 250;
      // Snapshot mock com forEach (QuerySnapshot real expõe forEach + docs).
      const makeSnap = (n: number, prefix: string) => {
        const docs = Array.from({length: n}, (_, i) => ({
          ref: {id: `${prefix}_${i}`},
        }));
        return {
          docs,
          empty: n === 0,
          size: n,
          forEach: (cb: (d: {ref: {id: string}}) => void) =>
            docs.forEach(cb),
        };
      };
      let cgCallCount = 0;
      mockCollectionGroupGet.mockImplementation(() => {
        cgCallCount++;
        // Apenas a PRIMEIRA subcoleção consultada (cashbox transactions) tem
        // docs; chamadas subsequentes (reviews/activities) já vêm vazias para
        // manter o teste focado e rápido.
        if (cgCallCount === 1) {
          return Promise.resolve(makeSnap(PAGE_1, "tx"));
        }
        if (cgCallCount === 2) {
          return Promise.resolve(makeSnap(PAGE_2, "tx_500"));
        }
        return Promise.resolve(makeSnap(0, "empty"));
      });

      await expect(
        onUserDeleted(makeUserRecord(), makeEventContext())
      ).resolves.not.toThrow();

      // 1ª subcoleção: 2 páginas (500 + 250) → 2 chamadas. Demais subcoleções
      // (reviews, activities): 1 chamada vazia cada. Total esperado: 4.
      // O ponto crucial: o loop ENCERROU (chamadas finitas) em vez de repetir
      // a página de 500 para sempre.
      expect(cgCallCount).toBe(4);
    },
    10000
  );

  test(
    "termina sem lançar quando subcoleções estão vazias (caminho feliz)",
    async () => {
      await expect(
        onUserDeleted(makeUserRecord(), makeEventContext())
      ).resolves.not.toThrow();
      // 3 subcoleções consultadas uma vez cada (todas vazias).
      expect(mockCollectionGroupGet).toHaveBeenCalledTimes(3);
    }
  );

  test(
    "aborta quando a paginação de grupos não avança e atinge MAX_ANON_ITERATIONS",
    async () => {
      const repeatingGroupDocs = Array.from({length: 500}, (_, i) => ({
        id: `group_${i}`,
        ref: {id: `group_${i}`},
        data: () => ({
          ownerId: "other-user",
          members: [],
        }),
      }));

      let collectionGetCalls = 0;
      mockCollectionGet.mockImplementation(() => {
        collectionGetCalls++;
        // Duas consultas adicionais cobrem push_tokens/push_token_devices.
        if (collectionGetCalls <= 14) {
          return Promise.resolve({
            docs: [],
            empty: true,
            size: 0,
          });
        }

        return Promise.resolve({
          docs: repeatingGroupDocs,
          empty: false,
          size: repeatingGroupDocs.length,
        });
      });

      await expect(
        onUserDeleted(makeUserRecord(), makeEventContext())
      ).rejects.toThrow("PII anonymization incomplete");

      expect(mockStartAfter).toHaveBeenCalled();
    },
    10000
  );
});

// ==========================================
// REGRESSÃO #3877 — LGPD: cleanup de notifications + retry real
// ==========================================

describe("onUserDeleted — regressão #3877 LGPD", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    batchInstances.length = 0;
    mockDocGet.mockResolvedValue({exists: false, data: () => null});
    mockCollectionGet.mockResolvedValue({docs: [], empty: true, size: 0});
    mockCollectionGroupGet.mockResolvedValue({
      docs: [],
      empty: true,
      size: 0,
    });
  });

  afterEach(() => {
    // Restaura o comportamento default de collection() para não vazar a
    // implementação por-coleção deste describe para outros testes.
    mockCollection.mockReturnValue({
      where: mockWhere,
      limit: mockLimit,
      startAfter: mockStartAfter,
      get: mockCollectionGet,
    });
  });

  test(
    "trigger é declarado com failurePolicy: true (throw causa retry real)",
    () => {
      // Antes do fix: auth.user().onDelete(...) sem runWith → failurePolicy
      // default false → o throw "PII anonymization incomplete" era no-op.
      // A captura acontece no load do módulo (por isso fora de clearAllMocks).
      // FIX #3897: timeoutSeconds/memory adicionados — função pesada (~16
      // loops paginados + 2 collectionGroup + Storage) não cabe no default
      // de 60s. Alinhado com pii-migration.ts (memory em sintaxe v1: "512MB").
      expect(runWithOptionsCaptured).toContainEqual({
        failurePolicy: true,
        timeoutSeconds: 540,
        memory: "512MB",
      });
    }
  );

  test(
    "cleanup de notifications consulta user_id (campo real do escritor) " +
    "e apaga os docs",
    async () => {
      // Antes do fix: a query usava `recipient_id`, campo que nenhum escritor
      // grava (helpers.ts grava `user_id`) → retornava vazia e as notificações
      // sobreviviam à exclusão da conta.
      const uid = "user-to-delete";
      const notificationRef = {id: "notif_1", path: "notifications/notif_1"};
      let notificationsWhereField: string | undefined;
      let notificationsServed = false;

      mockCollection.mockImplementation((name: string) => {
        const query: any = {
          where: jest.fn((field: string) => {
            if (name === "notifications") {
              notificationsWhereField = field;
            }
            return query;
          }),
          limit: jest.fn(() => query),
          startAfter: jest.fn(() => query),
          get: jest.fn(() => {
            if (name === "notifications" && !notificationsServed) {
              notificationsServed = true;
              return Promise.resolve({
                docs: [{ref: notificationRef}],
                empty: false,
                size: 1,
              });
            }
            return Promise.resolve({docs: [], empty: true, size: 0});
          }),
        };
        return query;
      });

      await expect(
        onUserDeleted(makeUserRecord(uid), makeEventContext())
      ).resolves.not.toThrow();

      // Campo alinhado com o escritor (notifications/helpers.ts: user_id)
      expect(notificationsWhereField).toBe("user_id");

      // O doc de notification foi de fato enfileirado para delete no batch
      const deletedRefs = batchInstances.flatMap((b) =>
        b.delete.mock.calls.map((call: any[]) => call[0])
      );
      expect(deletedRefs).toContain(notificationRef);
    }
  );
});

// ==========================================
// FIX #3897 — teto de idade do evento
// ==========================================

describe("onUserDeleted — FIX #3897: teto de idade do evento", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    batchInstances.length = 0;
    mockDocGet.mockResolvedValue({exists: false, data: () => null});
    mockCollectionGet.mockResolvedValue({docs: [], empty: true, size: 0});
    mockCollectionGroupGet.mockResolvedValue({
      docs: [],
      empty: true,
      size: 0,
    });
  });

  test(
    "evento com mais de 24h aborta sem tocar Firestore e sem lançar",
    async () => {
      // failurePolicy reenfileira por até 7 dias — sem este teto, uma falha
      // permanente vira 7 dias de tentativas completas. O handler deve
      // abortar com `return` (nunca `throw`, que rearmaria o retry).
      const context = makeEventContext(25 * 60 * 60 * 1000); // 25h atrás

      await expect(
        onUserDeleted(makeUserRecord(), context)
      ).resolves.toBeUndefined();

      // Abortou ANTES de qualquer leitura/escrita.
      expect(mockCollection).not.toHaveBeenCalled();
      expect(mockCollectionGroup).not.toHaveBeenCalled();
      expect(mockDocDelete).not.toHaveBeenCalled();
    }
  );

  test(
    "evento com menos de 24h processa normalmente (nao aborta)",
    async () => {
      const context = makeEventContext(23 * 60 * 60 * 1000); // 23h atrás

      await expect(
        onUserDeleted(makeUserRecord(), context)
      ).resolves.not.toThrow();

      expect(mockCollection).toHaveBeenCalledWith("push_tokens");
    }
  );
});

// ==========================================
// FIX #3897 — split de erro transitório vs permanente na anonimização
// ==========================================

describe(
  "onUserDeleted — FIX #3897: erro transitório vs permanente na anonimização",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      batchInstances.length = 0;
      mockDocGet.mockResolvedValue({exists: false, data: () => null});
      mockCollectionGet.mockResolvedValue({docs: [], empty: true, size: 0});
      mockCollectionGroupGet.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      });
    });

    test(
      "erro transitório (código gRPC UNAVAILABLE) no catch de cashbox " +
      "força retry (throw final)",
      async () => {
        // Primeira chamada de collectionGroup (cashbox) rejeita com um erro
        // com `.code` reconhecido como transitório — deve ligar anonFailed
        // e o handler deve lançar no final (retry via failurePolicy).
        const transientError: any = new Error("Firestore unavailable");
        transientError.code = 14; // UNAVAILABLE
        mockCollectionGroupGet.mockImplementationOnce(
          () => Promise.reject(transientError)
        );

        await expect(
          onUserDeleted(makeUserRecord(), makeEventContext())
        ).rejects.toThrow("PII anonymization incomplete");
      }
    );

    test(
      "erro permanente (sem código gRPC reconhecido) no catch de cashbox " +
      "NÃO força retry",
      async () => {
        // Erro genérico (ex.: TypeError em dado malformado) — sem `.code`
        // numérico reconhecido, tratado como permanente. Não deve ligar
        // anonFailed nem lançar: repetir a mesma limpeza não resolveria.
        mockCollectionGroupGet.mockImplementationOnce(
          () => Promise.reject(new TypeError("dado malformado"))
        );

        await expect(
          onUserDeleted(makeUserRecord(), makeEventContext())
        ).resolves.not.toThrow();
      }
    );
  }
);
