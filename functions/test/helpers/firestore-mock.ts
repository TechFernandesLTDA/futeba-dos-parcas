/**
 * UTILITÁRIO DE MOCK DO FIRESTORE PARA TESTES
 *
 * Fábrica de mocks reutilizáveis para evitar duplicação
 * nos arquivos de teste. Padroniza a criação de mocks
 * do Firestore seguindo os padrões do projeto.
 */

// ==========================================
// MOCK DE TIMESTAMP
// ==========================================

/**
 * Cria um mock de Timestamp do Firestore.
 *
 * @param {Date} date - Data opcional (padrão: agora)
 * @returns Mock de Timestamp com toDate()
 */
export function mockTimestamp(date?: Date) {
  const d = date || new Date();
  return {
    toDate: () => d,
    toMillis: () => d.getTime(),
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
    _type: "Timestamp",
  };
}

// ==========================================
// MOCK DE FIELDVALUE
// ==========================================

/**
 * Cria um mock de FieldValue do Firestore.
 *
 * @returns Mock de FieldValue com serverTimestamp, increment, delete, etc.
 */
export function mockFieldValue() {
  return {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
    increment: jest.fn((n: number) => ({ _type: "Increment", operand: n })),
    delete: jest.fn(() => ({ _type: "FieldValueDelete" })),
    arrayUnion: jest.fn((...items: unknown[]) => ({ _type: "ArrayUnion", elements: items })),
    arrayRemove: jest.fn((...items: unknown[]) => ({ _type: "ArrayRemove", elements: items })),
  };
}

// ==========================================
// MOCK DE DOCUMENT SNAPSHOT
// ==========================================

/**
 * Cria um mock de DocumentSnapshot do Firestore.
 *
 * @param {Record<string, unknown>} data - Dados do documento
 * @param {boolean} exists - Se o documento existe (padrão: true)
 * @param {string} id - ID do documento (padrão: "mock-doc-id")
 * @returns Mock de DocumentSnapshot
 */
export function createMockDocSnapshot(
  data: Record<string, unknown> | null,
  exists = true,
  id = "mock-doc-id"
) {
  return {
    exists,
    id,
    ref: { id, path: `collection/${id}` },
    data: () => (exists ? data : null),
    get: (field: string) => (exists && data ? data[field] : undefined),
  };
}

// ==========================================
// MOCK DE QUERY SNAPSHOT
// ==========================================

/**
 * Cria um mock de QuerySnapshot do Firestore.
 *
 * @param {Array} docs - Array de snapshots de documentos
 * @returns Mock de QuerySnapshot
 */
export function createMockQuerySnapshot(
  docs: ReturnType<typeof createMockDocSnapshot>[]
) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (fn: (doc: ReturnType<typeof createMockDocSnapshot>) => void) =>
      docs.forEach(fn),
  };
}

// ==========================================
// MOCK DE TRANSACTION
// ==========================================

/**
 * Cria um mock de Transaction do Firestore.
 *
 * @returns Mock de Transaction com get, set, update, delete
 */
export function createMockTransaction() {
  return {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

// ==========================================
// MOCK DE BATCH
// ==========================================

/**
 * Cria um mock de WriteBatch do Firestore.
 *
 * @returns Mock de WriteBatch com set, update, delete, commit
 */
export function createMockBatch() {
  return {
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };
}

// ==========================================
// MOCK DE DOC REF
// ==========================================

/**
 * Cria um mock de DocumentReference do Firestore.
 *
 * @param {string} id - ID do documento
 * @param {Record<string, unknown>} data - Dados para get()
 * @param {boolean} exists - Se o documento existe
 * @returns Mock de DocumentReference
 */
export function createMockDocRef(
  id = "mock-doc-id",
  data: Record<string, unknown> | null = {},
  exists = true
) {
  const snapshot = createMockDocSnapshot(data, exists, id);
  return {
    id,
    path: `collection/${id}`,
    get: jest.fn().mockResolvedValue(snapshot),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    collection: jest.fn(),
  };
}

// ==========================================
// MOCK COMPLETO DO FIRESTORE
// ==========================================

/**
 * Cria um mock completo do Firestore para uso nos testes.
 *
 * Retorna um objeto com collection/doc/get/set/update/delete/batch/runTransaction.
 * Use as funções individuais (mockGet, mockUpdate, etc.) para configurar
 * o comportamento desejado em cada teste.
 *
 * @returns Mock do Firestore com todas as operações principais
 */
export function createMockFirestore() {
  const mockBatch = createMockBatch();
  const mockRunTransaction = jest.fn();

  const mockDocGet = jest.fn().mockResolvedValue(
    createMockDocSnapshot({}, true)
  );
  const mockDocSet = jest.fn().mockResolvedValue(undefined);
  const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
  const mockDocDelete = jest.fn().mockResolvedValue(undefined);

  const mockWhere = jest.fn().mockReturnThis();
  const mockOrderBy = jest.fn().mockReturnThis();
  const mockLimit = jest.fn().mockReturnThis();
  const mockQueryGet = jest.fn().mockResolvedValue(
    createMockQuerySnapshot([])
  );

  const mockDoc = jest.fn().mockReturnValue({
    id: "mock-doc-id",
    get: mockDocGet,
    set: mockDocSet,
    update: mockDocUpdate,
    delete: mockDocDelete,
    collection: jest.fn().mockReturnThis(),
  });

  const mockCollection = jest.fn().mockReturnValue({
    doc: mockDoc,
    add: jest.fn().mockResolvedValue({ id: "new-doc-id" }),
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    get: mockQueryGet,
  });

  const firestore = {
    collection: mockCollection,
    batch: jest.fn().mockReturnValue(mockBatch),
    runTransaction: mockRunTransaction,
    // Referências para configuração nos testes
    _mocks: {
      batch: mockBatch,
      runTransaction: mockRunTransaction,
      docGet: mockDocGet,
      docSet: mockDocSet,
      docUpdate: mockDocUpdate,
      docDelete: mockDocDelete,
      queryGet: mockQueryGet,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      doc: mockDoc,
      collection: mockCollection,
    },
  };

  return firestore;
}
