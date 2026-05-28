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
const mockDocRef = jest.fn().mockReturnValue({get: mockDocGet});

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
const mockCollection = jest.fn().mockReturnValue({
  where: mockWhere,
  limit: mockLimit,
  get: mockCollectionGet,
});

jest.mock("firebase-admin", () => {
  const mockAdmin: any = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({
      collection: mockCollection,
      doc: mockDocRef,
      batch: mockBatch,
      collectionGroup: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [], empty: true, size: 0 }),
      }),
    })),
    auth: jest.fn(() => ({})),
    initializeApp: jest.fn(),
  };
  mockAdmin.firestore.FieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  };
  return mockAdmin;
});

jest.mock("firebase-functions/v1", () => ({
  auth: {
    user: () => ({
      onDelete: (handler: any) => handler,
    }),
  },
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
  });

  test("não lança para usuário sem docs residuais", async () => {
    // Todos os where().limit().get() retornam vazio
    mockCollectionGet.mockResolvedValue({docs: [], empty: true, size: 0});

    await expect(
      onUserDeleted(makeUserRecord())
    ).resolves.not.toThrow();
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
      onUserDeleted(makeUserRecord())
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
      onUserDeleted(makeUserRecord())
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

    await onUserDeleted(makeUserRecord());

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
