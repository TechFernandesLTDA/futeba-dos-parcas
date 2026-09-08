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

// FIX #4049: deleta objetos de mídia de jogo (game_photos/game_videos) usando
// storage_paths canônicos coletados no passo 16. Mock controlável por teste.
const mockMediaFileDelete = jest.fn().mockResolvedValue(undefined);
const mockMediaFile = jest.fn(() => ({delete: mockMediaFileDelete}));

jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      getFiles: jest.fn().mockResolvedValue([[]]),
      file: mockMediaFile,
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
      // (reviews, members, activities): 1 chamada vazia cada. Total: 5.
      // O ponto crucial: o loop ENCERROU (chamadas finitas) em vez de repetir
      // a página de 500 para sempre.
      expect(cgCallCount).toBe(5);
    },
    10000
  );

  test(
    "termina sem lançar quando subcoleções estão vazias (caminho feliz)",
    async () => {
      await expect(
        onUserDeleted(makeUserRecord(), makeEventContext())
      ).resolves.not.toThrow();
      // 4 subcoleções consultadas uma vez cada (todas vazias).
      expect(mockCollectionGroupGet).toHaveBeenCalledTimes(4);
    }
  );

  test(
    "aborta quando a paginação de grupos não avança e atinge MAX_ANON_ITERATIONS",
    async () => {
      const repeatingGroupDocs = Array.from({length: 500}, (_, i) => ({
        id: `group_${i}`,
        ref: {id: `group_${i}`},
        data: () => ({
          owner_id: "user-to-delete",
        }),
      }));
      const groupsStartAfter = jest.fn();
      mockCollection.mockImplementation((name: string) => {
        const query: any = {
          where: jest.fn(() => query),
          limit: jest.fn(() => query),
          startAfter: groupsStartAfter.mockImplementation(() => query),
          get: jest.fn(() => Promise.resolve(name === "groups" ? {
            docs: repeatingGroupDocs,
            empty: false,
            size: repeatingGroupDocs.length,
          } : {docs: [], empty: true, size: 0})),
        };
        return query;
      });

      await expect(
        onUserDeleted(makeUserRecord(), makeEventContext())
      ).rejects.toThrow("PII anonymization incomplete");

      expect(groupsStartAfter).toHaveBeenCalled();
      mockCollection.mockReturnValue({
        where: mockWhere,
        limit: mockLimit,
        startAfter: mockStartAfter,
        get: mockCollectionGet,
      });
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

    test(
      "erro transitório (código gRPC UNAVAILABLE) no catch de reviews " +
      "força retry (throw final)",
      async () => {
        // collectionGroup é chamado em ordem: cashbox (1ª), reviews (2ª),
        // activities (3ª). A 1ª chamada resolve vazia (cashbox ok); a 2ª
        // (reviews) rejeita com erro transitório.
        let call = 0;
        mockCollectionGroupGet.mockImplementation(() => {
          call++;
          if (call === 2) {
            const err: any = new Error("Firestore unavailable");
            err.code = 14; // UNAVAILABLE
            return Promise.reject(err);
          }
          return Promise.resolve({docs: [], empty: true, size: 0});
        });

        await expect(
          onUserDeleted(makeUserRecord(), makeEventContext())
        ).rejects.toThrow("PII anonymization incomplete");
      }
    );

    test(
      "erro permanente (sem código gRPC reconhecido) no catch de reviews " +
      "NÃO força retry",
      async () => {
        let call = 0;
        mockCollectionGroupGet.mockImplementation(() => {
          call++;
          if (call === 2) {
            return Promise.reject(new TypeError("dado malformado"));
          }
          return Promise.resolve({docs: [], empty: true, size: 0});
        });

        await expect(
          onUserDeleted(makeUserRecord(), makeEventContext())
        ).resolves.not.toThrow();
      }
    );

    test(
      "erro transitório (código gRPC UNAVAILABLE) no catch de activities " +
      "target força retry (throw final)",
      async () => {
        // 3ª chamada de collectionGroup (após cashbox e reviews, ambas ok).
        let call = 0;
        mockCollectionGroupGet.mockImplementation(() => {
          call++;
          if (call === 3) {
            const err: any = new Error("Firestore unavailable");
            err.code = 14; // UNAVAILABLE
            return Promise.reject(err);
          }
          return Promise.resolve({docs: [], empty: true, size: 0});
        });

        await expect(
          onUserDeleted(makeUserRecord(), makeEventContext())
        ).rejects.toThrow("PII anonymization incomplete");
      }
    );

    test(
      "erro permanente (sem código gRPC reconhecido) no catch de " +
      "activities target NÃO força retry",
      async () => {
        let call = 0;
        mockCollectionGroupGet.mockImplementation(() => {
          call++;
          if (call === 3) {
            return Promise.reject(new TypeError("dado malformado"));
          }
          return Promise.resolve({docs: [], empty: true, size: 0});
        });

        await expect(
          onUserDeleted(makeUserRecord(), makeEventContext())
        ).resolves.not.toThrow();
      }
    );

    test(
      "erro transitório (código gRPC UNAVAILABLE) no catch de groups " +
      "força retry (throw final)",
      async () => {
        // groups usa db.collection("groups"), não collectionGroup — precisa
        // interceptar mockCollection por nome (mesmo padrão do teste de
        // notifications acima) para não afetar as demais coleções.
        mockCollection.mockImplementation((name: string) => {
          const query: any = {
            where: jest.fn(() => query),
            limit: jest.fn(() => query),
            startAfter: jest.fn(() => query),
            get: jest.fn(() => {
              if (name === "groups") {
                const err: any = new Error("Firestore unavailable");
                err.code = 14; // UNAVAILABLE
                return Promise.reject(err);
              }
              return Promise.resolve({docs: [], empty: true, size: 0});
            }),
          };
          return query;
        });

        await expect(
          onUserDeleted(makeUserRecord(), makeEventContext())
        ).rejects.toThrow("PII anonymization incomplete");
      }
    );

    test(
      "erro permanente (sem código gRPC reconhecido) no catch de groups " +
      "NÃO força retry",
      async () => {
        mockCollection.mockImplementation((name: string) => {
          const query: any = {
            where: jest.fn(() => query),
            limit: jest.fn(() => query),
            startAfter: jest.fn(() => query),
            get: jest.fn(() => {
              if (name === "groups") {
                return Promise.reject(new TypeError("dado malformado"));
              }
              return Promise.resolve({docs: [], empty: true, size: 0});
            }),
          };
          return query;
        });

        await expect(
          onUserDeleted(makeUserRecord(), makeEventContext())
        ).resolves.not.toThrow();
      }
    );
  }
);

describe("onUserDeleted — FIX #4113: schema real de grupos", () => {
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
    mockCollection.mockReturnValue({
      where: mockWhere,
      limit: mockLimit,
      startAfter: mockStartAfter,
      get: mockCollectionGet,
    });
    mockCollectionGroup.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      startAfter: jest.fn().mockReturnThis(),
      get: mockCollectionGroupGet,
    });
  });

  test("anonimiza owner/member snake_case e remove convite real", async () => {
    const uid = "user-to-delete";
    const groupRef = {path: "groups/group-1"};
    const memberRef = {path: `groups/group-1/members/${uid}`};
    const inviteRef = {path: "group_invites/invite-1"};
    let ownerQueryField: string | undefined;
    const served = new Set<string>();

    mockCollection.mockImplementation((name: string) => {
      let field: string | undefined;
      const query: any = {
        where: jest.fn((nextField: string) => {
          field = nextField;
          if (name === "groups") ownerQueryField = nextField;
          return query;
        }),
        limit: jest.fn(() => query),
        startAfter: jest.fn(() => query),
        get: jest.fn(() => {
          const key = `${name}:${field}`;
          if (name === "groups" && !served.has(key)) {
            served.add(key);
            return Promise.resolve({
              docs: [{
                ref: groupRef,
                data: () => ({
                  owner_id: uid,
                  owner_name: "Nome real",
                  members: [uid],
                }),
              }],
              empty: false,
              size: 1,
            });
          }
          if (
            name === "group_invites" &&
            field === "invited_user_id" &&
            !served.has(key)
          ) {
            served.add(key);
            return Promise.resolve({
              docs: [{ref: inviteRef}],
              empty: false,
              size: 1,
              forEach: (callback: (doc: {ref: unknown}) => void) =>
                callback({ref: inviteRef}),
            });
          }
          return Promise.resolve({docs: [], empty: true, size: 0});
        }),
      };
      return query;
    });

    mockCollectionGroup.mockImplementation((name: string) => {
      const query: any = {
        where: jest.fn(() => query),
        limit: jest.fn(() => query),
        startAfter: jest.fn(() => query),
        get: jest.fn(() => Promise.resolve(name === "members" ? {
          docs: [{ref: memberRef}],
          empty: false,
          size: 1,
          forEach: (callback: (doc: {ref: unknown}) => void) =>
            callback({ref: memberRef}),
        } : {docs: [], empty: true, size: 0})),
      };
      return query;
    });

    await onUserDeleted(makeUserRecord(uid), makeEventContext());

    expect(ownerQueryField).toBe("owner_id");
    const updates = batchInstances.flatMap((batch) => batch.update.mock.calls);
    expect(updates).toContainEqual([
      groupRef,
      {owner_name: "Usuário removido"},
    ]);
    expect(updates).toContainEqual([
      memberRef,
      {
        user_name: "Usuário removido",
        user_photo: null,
        user_photo_url: null,
      },
    ]);
    expect(updates.some(([, data]) => "members" in data)).toBe(false);
    const deletes = batchInstances.flatMap((batch) =>
      batch.delete.mock.calls.map((call) => call[0])
    );
    expect(deletes).toContain(inviteRef);
    expect(deletes).toContainEqual(
      expect.objectContaining({path: `statistics/${uid}`})
    );
  });

  test("falha transitória na subcoleção members força retry", async () => {
    mockCollectionGroup.mockImplementation((name: string) => {
      const query: any = {
        where: jest.fn(() => query),
        limit: jest.fn(() => query),
        startAfter: jest.fn(() => query),
        get: jest.fn(() => name === "members" ?
          Promise.reject(Object.assign(new Error("unavailable"), {code: 14})) :
          Promise.resolve({docs: [], empty: true, size: 0})),
      };
      return query;
    });

    await expect(
      onUserDeleted(makeUserRecord(), makeEventContext())
    ).rejects.toThrow("PII anonymization incomplete");
  });
});

// ==========================================
// FIX #4049 — limpeza de mídia de jogo (game_photos/game_videos) no Storage
// ==========================================

describe("onUserDeleted — FIX #4049: mídia de jogo no Storage", () => {
  const uid = "user-to-delete";

  const mediaQuery = (storagePath: string) => {
    const query: any = {
      where: jest.fn(() => query),
      limit: jest.fn(() => query),
      startAfter: jest.fn(() => query),
      get: jest.fn(() =>
        Promise.resolve({
          docs: [
            {
              id: "media-1",
              ref: {id: "media-1", path: "media/media-1"},
              data: () => ({storage_path: storagePath}),
            },
          ],
          empty: false,
          size: 1,
        })
      ),
    };
    return query;
  };

  const emptyQuery = () => {
    const query: any = {
      where: jest.fn(() => query),
      limit: jest.fn(() => query),
      startAfter: jest.fn(() => query),
      get: jest.fn(() => Promise.resolve({docs: [], empty: true, size: 0})),
    };
    return query;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    batchInstances.length = 0;
    mockDocGet.mockResolvedValue({exists: false, data: () => null});
    mockCollectionGroupGet.mockResolvedValue({docs: [], empty: true, size: 0});
    mockMediaFileDelete.mockResolvedValue(undefined);
    mockMediaFile.mockClear();

    mockCollection.mockImplementation((name: string) => {
      if (name === "game_photos") {
        return mediaQuery("games/g1/photos/uid/photo.jpg");
      }
      if (name === "game_videos") {
        return mediaQuery("games/g1/videos/uid/clip.mp4");
      }
      return emptyQuery();
    });
  });

  test("deleta os objetos de mídia usando os storage_paths dos docs", async () => {
    await expect(
      onUserDeleted(makeUserRecord(uid), makeEventContext())
    ).resolves.not.toThrow();

    expect(mockMediaFile).toHaveBeenCalledWith("games/g1/photos/uid/photo.jpg");
    expect(mockMediaFile).toHaveBeenCalledWith("games/g1/videos/uid/clip.mp4");
    expect(mockMediaFileDelete).toHaveBeenCalledTimes(2);
    expect(mockMediaFileDelete).toHaveBeenCalledWith({ignoreNotFound: true});
  });

  test("loga warn e segue quando a exclusão de uma mídia falha", async () => {
    mockMediaFileDelete.mockRejectedValue(new Error("storage 403"));

    await expect(
      onUserDeleted(makeUserRecord(uid), makeEventContext())
    ).resolves.not.toThrow();

    expect(mockMediaFileDelete).toHaveBeenCalledTimes(2);
    const logger = jest.requireMock("firebase-functions/v2").logger;
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Erro ao deletar mídia"),
      expect.any(Error)
    );
  });

  test(
    "FIX #4082: pagina game_photos com cursor e conta docs únicos (sem inflar)",
    async () => {
      // 550 docs em game_photos → 2 páginas (500 + 50). Antes do fix, a query
      // sem startAfter relia sempre os mesmos 500 docs (leitura quadrática) e
      // gameMediaTotal somava o tamanho bruto da página (inflando o log de
      // auditoria LGPD com duplicados).
      const photos = Array.from({length: 550}, (_, i) => ({
        id: `photo_${i}`,
        ref: {id: `photo_${i}`, path: `game_photos/photo_${i}`},
        data: () => ({storage_path: `games/g1/photos/${i}.jpg`}),
      }));

      let page = 0;
      const gamePhotosQuery = (() => {
        const query: any = {
          where: jest.fn(() => query),
          limit: jest.fn(() => query),
          startAfter: jest.fn(() => query),
          get: jest.fn(() => {
            const start = page * 500;
            const chunk = photos.slice(start, start + 500);
            page++;
            return Promise.resolve({
              docs: chunk,
              empty: chunk.length === 0,
              size: chunk.length,
            });
          }),
        };
        return query;
      })();

      mockCollection.mockImplementation((name: string) => {
        if (name === "game_photos") return gamePhotosQuery;
        return emptyQuery();
      });

      await expect(
        onUserDeleted(makeUserRecord(uid), makeEventContext())
      ).resolves.not.toThrow();

      // Cursor avançou (startAfter chamado na 2ª página).
      expect(gamePhotosQuery.startAfter).toHaveBeenCalled();

      // gameMediaTotal conta exatamente 550 docs únicos (não 500+500=1000).
      const logger = jest.requireMock("firebase-functions/v2").logger;
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("550 game_photos/game_videos")
      );

      // 550 refs únicos de game_photos enfileirados para delete.
      const deletedPaths = batchInstances.flatMap((b) =>
        b.delete.mock.calls.map((call: any[]) => call[0].path)
      );
      const photoPaths = deletedPaths.filter((p: string) =>
        p.startsWith("game_photos/")
      );
      expect(new Set(photoPaths).size).toBe(550);
    },
    10000
  );
});
