const mockDb = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockGetAuth = jest.fn();
const mockLoadIdentityIndexHashes = jest.fn();

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    details?: unknown;

    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
}));

jest.mock("../../src/_db", () => ({db: mockDb}));
jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
}));
jest.mock("../../src/utils/firebase-lazy", () => ({
  getAuth: mockGetAuth,
}));
jest.mock("../../src/auth/identity-index", () => ({
  ...jest.requireActual("../../src/auth/identity-index"),
  loadIdentityIndexHashes: mockLoadIdentityIndexHashes,
}));

import {Timestamp} from "firebase-admin/firestore";
import {completeAccountMerge} from "../../src/auth/account-merge";
import {hashPhoneIdentity} from "../../src/validation/phone-identity";
import {getLevelForXp} from "../../src/xp/pipeline";

type Data = Record<string, unknown>;

interface FakeDocumentReference {
  id: string;
  path: string;
  get: () => Promise<FakeDocumentSnapshot>;
  set: (data: Data, options?: {merge?: boolean}) => Promise<void>;
  collection: (name: string) => FakeCollectionReference;
}

interface FakeDocumentSnapshot {
  id: string;
  ref: FakeDocumentReference;
  exists: boolean;
  data: () => Data | undefined;
}

interface FakeQuerySnapshot {
  docs: FakeDocumentSnapshot[];
  size: number;
  empty: boolean;
}

interface FakeQuery {
  where: (field: string, op: string, value: unknown) => FakeQuery;
  limit: (value?: number) => FakeQuery;
  startAfter: (lastDoc: FakeDocumentSnapshot) => FakeQuery;
  get: () => Promise<FakeQuerySnapshot>;
}

interface FakeCollectionReference extends FakeQuery {
  path: string;
  doc: (id?: string) => FakeDocumentReference;
}

function createFakeFirestore(
  initial: Record<string, Data>,
  options: {failBulkWritePaths?: string[]} = {},
) {
  const state = new Map<string, Data>(Object.entries(initial));
  const failBulkWritePaths = new Set(options.failBulkWritePaths ?? []);
  let automaticId = 0;

  const snapshot = (ref: FakeDocumentReference): FakeDocumentSnapshot => ({
    id: ref.id,
    ref,
    exists: state.has(ref.path),
    data: () => state.get(ref.path),
  });

  const write = (
    ref: FakeDocumentReference,
    data: Data,
    options?: {merge?: boolean},
  ) => {
    state.set(ref.path, options?.merge ? {
      ...(state.get(ref.path) ?? {}),
      ...data,
    } : {...data});
  };

  const directDocuments = (collectionPath: string): FakeDocumentSnapshot[] => {
    const prefix = `${collectionPath}/`;
    return [...state.keys()]
      .filter((path) => path.startsWith(prefix) &&
        !path.slice(prefix.length).includes("/"))
      .sort()
      .map((path) => snapshot(document(path)));
  };

  const query = (
    collectionPath: string,
    filters: Array<{field: string; op: string; value: unknown}> = [],
    limitValue?: number,
    startAfterId?: string,
  ): FakeQuery => ({
    where: (field, op, value) => query(
      collectionPath,
      [...filters, {field, op, value}],
      limitValue,
      startAfterId,
    ),
    limit: (value) => query(collectionPath, filters, value, startAfterId),
    startAfter: (lastDoc) => query(
      collectionPath,
      filters,
      limitValue,
      lastDoc.id,
    ),
    get: async () => {
      let docs = directDocuments(collectionPath).filter((doc) => {
        const data = doc.data() ?? {};
        return filters.every(({field, op, value}) => {
          const actual = data[field];
          if (op === "==") return actual === value;
          if (op === "array-contains") {
            return Array.isArray(actual) && actual.includes(value);
          }
          return false;
        });
      });
      if (startAfterId !== undefined) {
        // Mesma ordem do sort() acima (code units), como o Firestore real
        // ordena por __name__. localeCompare divergia do sort() em IDs com
        // "-"/"_" e o cursor pulava docs entre páginas.
        docs = docs.filter((doc) => doc.id > startAfterId);
      }
      if (limitValue !== undefined) {
        docs = docs.slice(0, limitValue);
      }
      return {docs, size: docs.length, empty: docs.length === 0};
    },
  });

  const collection = (path: string): FakeCollectionReference => ({
    path,
    doc: (id = `auto-${++automaticId}`) => document(`${path}/${id}`),
    ...query(path),
  });

  const document = (path: string): FakeDocumentReference => ({
    id: path.split("/").pop() ?? "",
    path,
    get: async () => snapshot(document(path)),
    set: async (data, options) => write(document(path), data, options),
    collection: (name) => collection(`${path}/${name}`),
  });

  const transaction = {
    get: jest.fn(async (ref: FakeDocumentReference) => snapshot(ref)),
    getAll: jest.fn(async (...refs: FakeDocumentReference[]) =>
      refs.map((ref) => snapshot(ref))),
    set: jest.fn((
      ref: FakeDocumentReference,
      data: Data,
      options?: {merge?: boolean},
    ) => write(ref, data, options)),
    delete: jest.fn((ref: FakeDocumentReference) => state.delete(ref.path)),
  };
  const bulkWriter = {
    // BulkWriter.set() real devolve Promise<WriteResult>; o código de
    // produção (#3909) depende disso para capturar falhas individuais. Paths
    // em failBulkWritePaths simulam uma falha definitiva (retries já
    // esgotados pelo handler padrão do SDK real).
    set: jest.fn((
      ref: FakeDocumentReference,
      data: Data,
      writeOptions?: {merge?: boolean},
    ) => {
      if (failBulkWritePaths.has(ref.path)) {
        return Promise.reject(
          Object.assign(new Error("PERMISSION_DENIED simulado"), {code: "permission-denied"}),
        );
      }
      return Promise.resolve(write(ref, data, writeOptions));
    }),
    close: jest.fn(async () => undefined),
  };
  const firestore = {
    doc: document,
    collection,
    runTransaction: jest.fn(async (
      handler: (tx: typeof transaction) => Promise<unknown>,
    ) => handler(transaction)),
    bulkWriter: jest.fn(() => bulkWriter),
  };

  return {state, firestore, transaction, bulkWriter};
}

describe("completeAccountMerge transactional migration", () => {
  const sourceUid = "source-user";
  const targetUid = "target-user";
  const requestId = "a".repeat(64);
  const phone = "+5511999999999";
  const salt = "0123456789abcdef";
  const cpfHash = "cpf-hash";
  const canonicalPhoneHash = hashPhoneIdentity(phone, salt);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CPF_SALT = salt;
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      resetAt: new Date(Date.now() + 60_000),
    });
  });

  afterAll(() => {
    delete process.env.CPF_SALT;
  });

  it("migra referências, colisões e índices no caminho completo", async () => {
    const {state, firestore, transaction, bulkWriter} = createFakeFirestore({
      [`account_merge_requests/${requestId}`]: {
        sourceUid,
        targetUid,
        status: "ready",
        proofExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      },
      [`users/${sourceUid}`]: {
        display_name: "Nome anterior",
        photo_url: "source.jpg",
        bio: "Bio preservada",
      },
      [`users/${targetUid}`]: {
        display_name: "Nome canônico",
        photo_url: "target.jpg",
      },
      [`users_private/${sourceUid}`]: {
        cpfHash,
        cpfMasked: "***.***.***-00",
        cpfVerifiedAt: Timestamp.fromMillis(1_000),
        phoneHash: "old-source-phone",
      },
      [`users_private/${targetUid}`]: {
        cpfHash,
        phoneHash: "old-target-phone",
      },
      [`cpf_index/${cpfHash}`]: {uid: sourceUid, createdAt: "cpf-created"},
      [`phone_index/${canonicalPhoneHash}`]: {
        uid: targetUid,
        createdAt: "phone-created",
      },
      "phone_index/old-source-phone": {uid: sourceUid},
      "phone_index/old-target-phone": {uid: targetUid},
      [`users/${sourceUid}/groups/group-1`]: {
        role: "MEMBER",
        status: "ACTIVE",
      },
      [`users/${targetUid}/groups/group-1`]: {
        role: "ADMIN",
        status: "ACTIVE",
      },
      "groups/group-1": {owner_id: sourceUid, ownerId: sourceUid},
      [`groups/group-1/members/${sourceUid}`]: {
        user_id: sourceUid,
        role: "MEMBER",
        status: "ACTIVE",
      },
      [`groups/group-1/members/${targetUid}`]: {
        user_id: targetUid,
        role: "ADMIN",
        status: "ACTIVE",
      },
      "confirmations/game-1_source-a": {
        game_id: "game-1",
        user_id: sourceUid,
        status: "PENDING",
        position: "GK",
        updated_at: Timestamp.fromMillis(1_000),
      },
      "confirmations/game-1_source-b": {
        gameId: "game-1",
        userId: sourceUid,
        status: "CONFIRMED",
        updated_at: Timestamp.fromMillis(2_000),
      },
      [`confirmations/game-1_${targetUid}`]: {
        game_id: "game-1",
        user_id: targetUid,
        checked_in: true,
      },
      "game_summons/summon-1": {user_id: sourceUid},
      "group_invites/invite-1": {
        invited_user_id: sourceUid,
        invitedUserId: sourceUid,
      },
      "notifications/notification-1": {user_id: sourceUid},
      "games/game-1": {
        owner_id: sourceUid,
        ownerId: sourceUid,
        co_organizers: [sourceUid, targetUid, "other-user"],
      },
      "locations/location-1": {
        owner_id: sourceUid,
        ownerId: sourceUid,
        managers: [sourceUid, targetUid, "manager"],
      },
      "schedules/schedule-1": {owner_id: sourceUid},
      "live_games/live-game-1": {owner_id: sourceUid},
      "live_scores/live-score-1": {owner_id: sourceUid},
      [`users/${sourceUid}/game_templates/template-1`]: {
        owner_id: sourceUid,
        name: "Modelo antigo",
        location_name: "Quadra antiga",
      },
      [`users/${targetUid}/game_templates/template-1`]: {
        owner_id: targetUid,
        name: "Modelo canônico",
      },
    });
    mockDb.mockReturnValue(firestore);
    mockLoadIdentityIndexHashes.mockImplementation(async (
      _database: unknown,
      collectionName: string,
      uid: string,
    ) => {
      if (collectionName === "cpf_index") return [cpfHash];
      return uid === sourceUid ?
        ["old-source-phone"] :
        ["old-target-phone", canonicalPhoneHash];
    });

    const sourceAuth = {
      uid: sourceUid,
      disabled: false,
      email: "old@example.com",
      providerData: [{providerId: "google.com"}],
      customClaims: {},
    };
    const targetAuth = {
      uid: targetUid,
      disabled: false,
      email: "main@example.com",
      phoneNumber: phone,
      providerData: [],
      customClaims: {role: "ADMIN"},
    };
    const auth = {
      getUser: jest.fn(async (uid: string) =>
        uid === sourceUid ? sourceAuth : targetAuth),
      updateUser: jest.fn(async () => undefined),
      revokeRefreshTokens: jest.fn(async () => undefined),
      setCustomUserClaims: jest.fn(async () => undefined),
    };
    mockGetAuth.mockReturnValue(auth);

    const result = await (completeAccountMerge as unknown as (
      request: Data,
    ) => Promise<Data>)({
      auth: {uid: targetUid, token: {}},
      data: {requestId},
    });

    expect(result).toMatchObject({
      success: true,
      status: "completed",
      alreadyCompleted: false,
      providersToRelink: ["google.com"],
      tokenRefreshRequired: true,
    });
    expect(state.get(`account_merge_requests/${requestId}`)).toMatchObject({
      status: "completed",
      irreversibleStage: "references_migrated",
      manifest: {
        groupLinksCopied: 1,
        membershipsCopied: 1,
        sourceMembershipsDeactivated: 1,
        groupOwnershipsTransferred: 1,
        confirmationsCopied: 2,
        groupInvitesMigrated: 1,
        gamesOwnershipMigrated: 1,
        locationsOwnershipMigrated: 1,
        schedulesOwnershipMigrated: 1,
        liveGamesOwnershipMigrated: 1,
        liveScoresOwnershipMigrated: 1,
        gameTemplatesMigrated: 1,
      },
    });
    expect(state.get("groups/group-1")).toMatchObject({
      owner_id: targetUid,
      ownerId: targetUid,
    });
    expect(state.get(`groups/group-1/members/${targetUid}`)).toMatchObject({
      user_id: targetUid,
      role: "OWNER",
      status: "ACTIVE",
    });
    expect(state.get(`groups/group-1/members/${sourceUid}`)).toMatchObject({
      status: "INACTIVE",
      merged_to_uid: targetUid,
    });
    expect(state.get(`confirmations/game-1_${targetUid}`)).toMatchObject({
      user_id: targetUid,
      status: "CONFIRMED",
      position: "GK",
      checked_in: true,
    });
    expect(state.has("confirmations/game-1_source-a")).toBe(false);
    expect(state.has("confirmations/game-1_source-b")).toBe(false);
    expect(state.get("games/game-1")).toMatchObject({
      owner_id: targetUid,
      ownerId: targetUid,
      co_organizers: ["other-user"],
    });
    expect(state.get("locations/location-1")).toMatchObject({
      owner_id: targetUid,
      ownerId: targetUid,
      managers: ["manager"],
    });
    expect(state.has(`users/${sourceUid}/game_templates/template-1`)).toBe(false);
    expect(state.get(`users/${targetUid}/game_templates/template-1`))
      .toMatchObject({
        owner_id: targetUid,
        name: "Modelo canônico",
        location_name: "Quadra antiga",
      });
    expect(auth.updateUser).toHaveBeenCalledWith(sourceUid, {
      disabled: true,
      providersToUnlink: ["google.com"],
    });
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith(sourceUid);
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith(
      targetUid,
      expect.objectContaining({role: "ADMIN", verified: true}),
    );
    expect(transaction.delete).toHaveBeenCalled();
    expect(bulkWriter.close).toHaveBeenCalledTimes(1);
  });

  /**
   * Fixture mínima com um write do BulkWriter programado para falhar em
   * definitivo (simula retries do SDK real já esgotados).
   * @param {string} failPath Path do documento cujo set() deve rejeitar.
   * @return {{state: Map<string, Data>; auth: {
   *   getUser: jest.Mock;
   *   updateUser: jest.Mock;
   *   revokeRefreshTokens: jest.Mock;
   *   setCustomUserClaims: jest.Mock;
   * }}} Estado do Firestore fake e mocks de Auth.
   */
  function setupFailingBulkWriteFixture(failPath: string) {
    const {state, firestore} = createFakeFirestore({
      [`account_merge_requests/${requestId}`]: {
        sourceUid,
        targetUid,
        status: "ready",
        proofExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      },
      [`users_private/${sourceUid}`]: {cpfHash, phoneHash: "old-source-phone"},
      [`users_private/${targetUid}`]: {cpfHash, phoneHash: "old-target-phone"},
      [`cpf_index/${cpfHash}`]: {uid: sourceUid, createdAt: "cpf-created"},
      [`phone_index/${canonicalPhoneHash}`]: {
        uid: targetUid,
        createdAt: "phone-created",
      },
      "phone_index/old-source-phone": {uid: sourceUid},
      "phone_index/old-target-phone": {uid: targetUid},
      "notifications/notification-1": {user_id: sourceUid},
    }, {failBulkWritePaths: [failPath]});
    mockDb.mockReturnValue(firestore);
    mockLoadIdentityIndexHashes.mockImplementation(async (
      _database: unknown,
      collectionName: string,
      uid: string,
    ) => {
      if (collectionName === "cpf_index") return [cpfHash];
      return uid === sourceUid ?
        ["old-source-phone"] :
        ["old-target-phone", canonicalPhoneHash];
    });

    const sourceAuth = {
      uid: sourceUid,
      disabled: false,
      email: "old@example.com",
      providerData: [{providerId: "google.com"}],
      customClaims: {},
    };
    const targetAuth = {
      uid: targetUid,
      disabled: false,
      email: "main@example.com",
      phoneNumber: phone,
      providerData: [],
      customClaims: {role: "ADMIN"},
    };
    const auth = {
      getUser: jest.fn(async (uid: string) =>
        uid === sourceUid ? sourceAuth : targetAuth),
      updateUser: jest.fn(async () => undefined),
      revokeRefreshTokens: jest.fn(async () => undefined),
      setCustomUserClaims: jest.fn(async () => undefined),
    };
    mockGetAuth.mockReturnValue(auth);

    return {state, auth};
  }

  it(
    "aborta antes do estágio irreversível quando um write do BulkWriter " +
    "falha em definitivo (#3909)",
    async () => {
      const {state, auth} = setupFailingBulkWriteFixture(
        "notifications/notification-1",
      );

      await expect((completeAccountMerge as unknown as (
        request: Data,
      ) => Promise<Data>)({
        auth: {uid: targetUid, token: {}},
        data: {requestId},
      })).rejects.toMatchObject({code: "internal"});

      // Estágio irreversível não pode ter sido executado.
      expect(auth.updateUser).not.toHaveBeenCalled();
      expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();

      const requestState = state.get(`account_merge_requests/${requestId}`);
      expect(requestState?.status).toBe("processing");
      expect(requestState?.irreversibleStage).toBeUndefined();
      expect(requestState?.lastBulkWriteFailure).toMatchObject({
        failures: [
          expect.objectContaining({path: "notifications/notification-1"}),
        ],
      });

      // O documento que falhou continua apontando pra origem: nada foi
      // migrado nele, e uma nova tentativa (lease expirada) reprocessa.
      expect(state.get("notifications/notification-1")).toMatchObject({
        user_id: sourceUid,
      });
    },
  );

  it(
    "não deixa nenhuma promise de escrita do BulkWriter sem handler quando " +
    "há falha (#3909)",
    async () => {
      const unhandled = jest.fn();
      process.on("unhandledRejection", unhandled);
      try {
        setupFailingBulkWriteFixture("notifications/notification-1");

        await (completeAccountMerge as unknown as (
          request: Data,
        ) => Promise<Data>)({
          auth: {uid: targetUid, token: {}},
          data: {requestId},
        }).catch(() => undefined);

        // Dá ao Node uma volta do loop de eventos para reportar qualquer
        // rejection não tratada antes de checarmos o listener.
        await new Promise((resolve) => setImmediate(resolve));

        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off("unhandledRejection", unhandled);
      }
    },
  );

  it(
    "drena notifications além de MAX_DOCS_PER_QUERY sem bloquear o merge (#4039)",
    async () => {
      const initial: Record<string, Data> = {
        [`account_merge_requests/${requestId}`]: {
          sourceUid,
          targetUid,
          status: "ready",
          proofExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
        },
        [`users/${sourceUid}`]: {display_name: "Source"},
        [`users/${targetUid}`]: {display_name: "Target"},
        [`users_private/${sourceUid}`]: {cpfHash, phoneHash: "old-source"},
        [`users_private/${targetUid}`]: {cpfHash, phoneHash: canonicalPhoneHash},
        [`cpf_index/${cpfHash}`]: {uid: sourceUid, createdAt: "x"},
        [`phone_index/${canonicalPhoneHash}`]: {uid: targetUid, createdAt: "y"},
      };
      // 1500 notificações não lidas — antes saturava permanentemente o merge.
      for (let i = 0; i < 1500; i++) {
        initial[`notifications/notif-${i}`] = {user_id: sourceUid};
      }

      const {firestore} = createFakeFirestore(initial);
      mockDb.mockReturnValue(firestore);
      mockLoadIdentityIndexHashes.mockImplementation(async (
        _db: unknown,
        collectionName: string,
        uid: string,
      ) => {
        if (collectionName === "cpf_index") return [cpfHash];
        return uid === sourceUid ?
          ["old-source"] :
          [canonicalPhoneHash];
      });
      const sourceAuth = {
        uid: sourceUid,
        disabled: false,
        email: "old@example.com",
        providerData: [{providerId: "google.com"}],
        customClaims: {},
      };
      const targetAuth = {
        uid: targetUid,
        disabled: false,
        email: "main@example.com",
        phoneNumber: phone,
        providerData: [],
        customClaims: {},
      };
      mockGetAuth.mockReturnValue({
        getUser: jest.fn(async (uid: string) =>
          uid === sourceUid ? sourceAuth : targetAuth),
        updateUser: jest.fn(async () => undefined),
        revokeRefreshTokens: jest.fn(async () => undefined),
        setCustomUserClaims: jest.fn(async () => undefined),
      });

      const result = await (completeAccountMerge as unknown as (
        request: Data,
      ) => Promise<Data>)({
        auth: {uid: targetUid, token: {}},
        data: {requestId},
      });

      expect(result).toEqual(expect.objectContaining({
        success: true,
        status: "completed",
      }));
    },
  );

  it(
    "aborta com failed-precondition quando games (owner_id) satura (#4039)",
    async () => {
      const initial: Record<string, Data> = {
        [`account_merge_requests/${requestId}`]: {
          sourceUid,
          targetUid,
          status: "ready",
          proofExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
        },
        [`users/${sourceUid}`]: {display_name: "Source"},
        [`users/${targetUid}`]: {display_name: "Target"},
        [`users_private/${sourceUid}`]: {cpfHash, phoneHash: "old-source"},
        [`users_private/${targetUid}`]: {cpfHash, phoneHash: canonicalPhoneHash},
        [`cpf_index/${cpfHash}`]: {uid: sourceUid, createdAt: "x"},
        [`phone_index/${canonicalPhoneHash}`]: {uid: targetUid, createdAt: "y"},
      };
      // Coleção CRÍTICA de posse saturando: o guard deve ser preservado.
      for (let i = 0; i < 501; i++) {
        initial[`games/game-${i}`] = {owner_id: sourceUid};
      }

      const {firestore} = createFakeFirestore(initial);
      mockDb.mockReturnValue(firestore);
      mockLoadIdentityIndexHashes.mockImplementation(async (
        _db: unknown,
        collectionName: string,
        uid: string,
      ) => {
        if (collectionName === "cpf_index") return [cpfHash];
        return uid === sourceUid ?
          ["old-source"] :
          [canonicalPhoneHash];
      });
      const sourceAuth = {
        uid: sourceUid,
        disabled: false,
        email: "old@example.com",
        providerData: [{providerId: "google.com"}],
        customClaims: {},
      };
      const targetAuth = {
        uid: targetUid,
        disabled: false,
        email: "main@example.com",
        phoneNumber: phone,
        providerData: [],
        customClaims: {},
      };
      mockGetAuth.mockReturnValue({
        getUser: jest.fn(async (uid: string) =>
          uid === sourceUid ? sourceAuth : targetAuth),
        updateUser: jest.fn(async () => undefined),
        revokeRefreshTokens: jest.fn(async () => undefined),
        setCustomUserClaims: jest.fn(async () => undefined),
      });

      await expect((completeAccountMerge as unknown as (
        request: Data,
      ) => Promise<Data>)({
        auth: {uid: targetUid, token: {}},
        data: {requestId},
      })).rejects.toMatchObject({
        code: "failed-precondition",
        message: expect.stringContaining("games (owner_id)"),
      });
    },
  );
});

// ==========================================
// #4112 — gamificação migrada/fundida na união
// ==========================================

describe("completeAccountMerge gamificação (#4112)", () => {
  const sourceUid = "source-user";
  const targetUid = "target-user";
  const requestId = "b".repeat(64);
  const phone = "+5511999999999";
  const salt = "0123456789abcdef";
  const cpfHash = "cpf-hash";
  const canonicalPhoneHash = hashPhoneIdentity(phone, salt);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CPF_SALT = salt;
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      resetAt: new Date(Date.now() + 60_000),
    });
  });

  afterAll(() => {
    delete process.env.CPF_SALT;
  });

  /**
   * Fixture: origem (conta legada, com histórico) + destino (com histórico
   * próprio). Formas de doc espelham os ESCRITORES reais:
   * - statistics/{uid}: contadores camelCase sem user_id (index.ts);
   * - season_participation/{seasonId}_{uid}: helpers.ts + mvp-voting.ts;
   * - user_badges/{uid}_{badgeId}: user-badge-docs.ts;
   * - xp_logs/game_{gameId}_user_{uid}: index.ts;
   * - mvp_votes/{gameId}_{voterId}_{category}: mvp-voting.ts;
   * - activities/{gameId}: activities.ts.
   * @return {{state: Map<string, Data>}} Estado do Firestore fake.
   */
  function setupGamificationFixture() {
    const earnedGoals = Timestamp.fromMillis(10_000);
    const earnedGamesSource = Timestamp.fromMillis(20_000);
    const earnedGamesTarget = Timestamp.fromMillis(30_000);
    const {state, firestore} = createFakeFirestore({
      [`account_merge_requests/${requestId}`]: {
        sourceUid,
        targetUid,
        status: "ready",
        proofExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      },
      [`users/${sourceUid}`]: {
        display_name: "Conta legada",
        experience_points: 500,
        level: 3,
        milestones_achieved: ["GOALS_10", "GAMES_10"],
      },
      [`users/${targetUid}`]: {
        display_name: "Conta canônica",
        experience_points: 120,
        level: 1,
        milestones_achieved: ["GAMES_10"],
      },
      [`users_private/${sourceUid}`]: {cpfHash, phoneHash: "old-source"},
      [`users_private/${targetUid}`]: {cpfHash, phoneHash: canonicalPhoneHash},
      [`cpf_index/${cpfHash}`]: {uid: sourceUid, createdAt: "x"},
      [`phone_index/${canonicalPhoneHash}`]: {uid: targetUid, createdAt: "y"},

      // statistics — escritor Functions (camelCase, sem user_id) na origem;
      // destino já com histórico próprio.
      [`statistics/${sourceUid}`]: {
        totalGames: 10,
        totalGoals: 7,
        totalAssists: 3,
        gamesWon: 6,
        bestMvpStreak: 2,
        currentMvpStreak: 1,
        // Escritor Android legado (snake_case) convivendo no mesmo doc.
        total_games: 2,
      },
      [`statistics/${targetUid}`]: {
        totalGames: 4,
        totalGoals: 1,
        gamesWon: 1,
        bestMvpStreak: 3,
        currentMvpStreak: 0,
      },

      // season_participation — temporada corrente com doc nos dois lados,
      // temporada anterior só na origem.
      [`season_participation/2026-05_${sourceUid}`]: {
        user_id: sourceUid,
        season_id: "2026-05",
        points: 9,
        games_played: 4,
        wins: 3,
        draws: 0,
        losses: 1,
        goals_scored: 5,
        assists: 2,
        mvp_count: 1,
        total_xp: 200,
        by_gender: {MALE: {points: 9, games_played: 4, wins: 3}},
        group_id: "group-1",
        group_ids: ["group-1"],
      },
      [`season_participation/2026-05_${targetUid}`]: {
        user_id: targetUid,
        season_id: "2026-05",
        points: 3,
        games_played: 1,
        wins: 1,
        draws: 0,
        losses: 0,
        goals_scored: 0,
        assists: 0,
        mvp_count: 0,
        total_xp: 40,
        by_gender: {MIXED: {points: 3, games_played: 1, wins: 1}},
        group_id: "group-2",
        group_ids: ["group-2"],
        rating: 1050,
        division: "PRATA",
      },
      [`season_participation/2026-04_${sourceUid}`]: {
        user_id: sourceUid,
        season_id: "2026-04",
        points: 6,
        games_played: 2,
        total_xp: 90,
      },

      // user_badges — GOALS_10 só na origem; GAMES_10 nos dois lados.
      [`user_badges/${sourceUid}_GOALS_10`]: {
        user_id: sourceUid,
        badge_id: "GOALS_10",
        earned: true,
        count: 1,
        earned_at: earnedGoals,
        last_earned_at: earnedGoals,
      },
      [`user_badges/${sourceUid}_GAMES_10`]: {
        user_id: sourceUid,
        badge_id: "GAMES_10",
        earned: true,
        count: 1,
        earned_at: earnedGamesSource,
      },
      [`user_badges/${targetUid}_GAMES_10`]: {
        user_id: targetUid,
        badge_id: "GAMES_10",
        earned: true,
        count: 1,
        earned_at: earnedGamesTarget,
      },

      // xp_logs — derivados das confirmations que a união já movia.
      [`xp_logs/game_game-1_user_${sourceUid}`]: {
        user_id: sourceUid,
        game_id: "game-1",
        xp_earned: 50,
      },
      [`xp_logs/badge_GOALS_10_user_${sourceUid}`]: {
        user_id: sourceUid,
        xp_earned: 25,
      },

      // mvp_votes — emitidos (voter_id) e recebidos (voted_player_id).
      [`mvp_votes/game-1_${sourceUid}_MVP`]: {
        id: `game-1_${sourceUid}_MVP`,
        game_id: "game-1",
        voter_id: sourceUid,
        voted_player_id: "other-user",
        category: "MVP",
      },
      [`mvp_votes/game-2_${sourceUid}_MVP`]: {
        id: `game-2_${sourceUid}_MVP`,
        game_id: "game-2",
        voter_id: sourceUid,
        voted_player_id: "other-user",
        category: "MVP",
      },
      [`mvp_votes/game-2_${targetUid}_MVP`]: {
        id: `game-2_${targetUid}_MVP`,
        game_id: "game-2",
        voter_id: targetUid,
        voted_player_id: "someone-else",
        category: "MVP",
      },
      "mvp_votes/game-1_other-user_MVP": {
        id: "game-1_other-user_MVP",
        game_id: "game-1",
        voter_id: "other-user",
        voted_player_id: sourceUid,
        category: "MVP",
      },

      // activities — autor é a origem.
      "activities/game-1": {
        type: "GAME_FINISHED",
        user_id: sourceUid,
        user_name: "Conta legada",
        reference_id: "game-1",
      },
    });
    mockDb.mockReturnValue(firestore);
    mockLoadIdentityIndexHashes.mockImplementation(async (
      _db: unknown,
      collectionName: string,
      uid: string,
    ) => {
      if (collectionName === "cpf_index") return [cpfHash];
      return uid === sourceUid ? ["old-source"] : [canonicalPhoneHash];
    });
    const sourceAuth = {
      uid: sourceUid,
      disabled: false,
      email: "old@example.com",
      providerData: [],
      customClaims: {},
    };
    const targetAuth = {
      uid: targetUid,
      disabled: false,
      email: "main@example.com",
      phoneNumber: phone,
      providerData: [],
      customClaims: {},
    };
    mockGetAuth.mockReturnValue({
      getUser: jest.fn(async (uid: string) =>
        uid === sourceUid ? sourceAuth : targetAuth),
      updateUser: jest.fn(async () => undefined),
      revokeRefreshTokens: jest.fn(async () => undefined),
      setCustomUserClaims: jest.fn(async () => undefined),
    });
    return {state, earnedGoals, earnedGamesSource, earnedGamesTarget};
  }

  it(
    "funde statistics/season/badges/xp/votos/activities no destino sem " +
    "deixar docs órfãos na origem",
    async () => {
      const {state, earnedGoals, earnedGamesTarget} = setupGamificationFixture();

      const result = await (completeAccountMerge as unknown as (
        request: Data,
      ) => Promise<Data>)({
        auth: {uid: targetUid, token: {}},
        data: {requestId},
      });
      expect(result).toMatchObject({success: true, status: "completed"});

      // statistics: SOMA dos contadores (não sobrescrita), máximos e estado
      // corrente tratados à parte, origem apagada.
      expect(state.get(`statistics/${targetUid}`)).toMatchObject({
        totalGames: 14,
        totalGoals: 8,
        totalAssists: 3,
        gamesWon: 7,
        total_games: 2,
        bestMvpStreak: 3,
        currentMvpStreak: 0,
        user_id: targetUid,
        merged_from_alias: true,
      });
      expect(state.has(`statistics/${sourceUid}`)).toBe(false);

      // season_participation: temporada corrente fundida (1 doc no ranking),
      // temporada anterior movida para o ID do destino.
      const currentSeason = state.get(`season_participation/2026-05_${targetUid}`);
      expect(currentSeason).toMatchObject({
        user_id: targetUid,
        season_id: "2026-05",
        points: 12,
        games_played: 5,
        wins: 4,
        losses: 1,
        goals_scored: 5,
        assists: 2,
        mvp_count: 1,
        total_xp: 240,
        rating: 1050,
        division: "PRATA",
        group_id: "group-2",
        merged_from_alias: true,
      });
      expect(currentSeason?.by_gender).toEqual({
        MALE: {points: 9, games_played: 4, wins: 3},
        MIXED: {points: 3, games_played: 1, wins: 1},
      });
      expect(currentSeason?.group_ids).toEqual(
        expect.arrayContaining(["group-1", "group-2"]),
      );
      expect(state.has(`season_participation/2026-05_${sourceUid}`)).toBe(false);
      expect(state.get(`season_participation/2026-04_${targetUid}`)).toMatchObject({
        user_id: targetUid,
        season_id: "2026-04",
        points: 6,
        games_played: 2,
        total_xp: 90,
      });
      expect(state.has(`season_participation/2026-04_${sourceUid}`)).toBe(false);

      // user_badges: união — só da origem é copiada com a data original;
      // já existente no destino não é duplicada nem sobrescrita.
      expect(state.get(`user_badges/${targetUid}_GOALS_10`)).toMatchObject({
        user_id: targetUid,
        badge_id: "GOALS_10",
        earned_at: earnedGoals,
        merged_from_alias: true,
      });
      expect(state.get(`user_badges/${targetUid}_GAMES_10`)).toMatchObject({
        user_id: targetUid,
        earned_at: earnedGamesTarget,
      });
      expect(state.get(`user_badges/${targetUid}_GAMES_10`)?.merged_from_alias)
        .toBeUndefined();
      expect(state.has(`user_badges/${sourceUid}_GOALS_10`)).toBe(false);
      expect(state.has(`user_badges/${sourceUid}_GAMES_10`)).toBe(false);

      // xp_logs: re-apontados no lugar.
      expect(state.get(`xp_logs/game_game-1_user_${sourceUid}`)).toMatchObject({
        user_id: targetUid,
        xp_earned: 50,
        merged_from_alias: true,
      });
      expect(state.get(`xp_logs/badge_GOALS_10_user_${sourceUid}`)).toMatchObject({
        user_id: targetUid,
      });

      // mvp_votes emitidos: movidos para o ID canônico; colisão mantém o
      // voto do destino e descarta o da origem. Recebidos: re-apontados.
      expect(state.get(`mvp_votes/game-1_${targetUid}_MVP`)).toMatchObject({
        id: `game-1_${targetUid}_MVP`,
        voter_id: targetUid,
        voted_player_id: "other-user",
        category: "MVP",
      });
      expect(state.has(`mvp_votes/game-1_${sourceUid}_MVP`)).toBe(false);
      expect(state.get(`mvp_votes/game-2_${targetUid}_MVP`)).toMatchObject({
        voted_player_id: "someone-else",
      });
      expect(state.has(`mvp_votes/game-2_${sourceUid}_MVP`)).toBe(false);
      expect(state.get("mvp_votes/game-1_other-user_MVP")).toMatchObject({
        voter_id: "other-user",
        voted_player_id: targetUid,
      });

      // activities: autor re-apontado.
      expect(state.get("activities/game-1")).toMatchObject({
        user_id: targetUid,
        merged_from_alias: true,
      });

      // users: XP agregado somado, nível recalculado, milestones unidos,
      // origem marcada (idempotência da retomada).
      expect(state.get(`users/${targetUid}`)).toMatchObject({
        experience_points: 620,
        level: getLevelForXp(620),
      });
      expect(state.get(`users/${targetUid}`)?.milestones_achieved).toEqual(
        expect.arrayContaining(["GOALS_10", "GAMES_10"]),
      );
      expect(state.get(`users/${sourceUid}`)).toMatchObject({
        xp_merged_to: targetUid,
        experience_points: 500,
      });

      // Nenhum doc de gamificação continua apontando para a origem.
      for (const [path, data] of state.entries()) {
        if (path.startsWith("users") || path.startsWith("account_merge")) continue;
        expect({path, user_id: data.user_id}).not.toEqual({path, user_id: sourceUid});
        expect({path, voter_id: data.voter_id}).not.toEqual({path, voter_id: sourceUid});
        expect({path, voted_player_id: data.voted_player_id})
          .not.toEqual({path, voted_player_id: sourceUid});
      }

      // manifest auditável por coleção.
      expect(state.get(`account_merge_requests/${requestId}`)).toMatchObject({
        status: "completed",
        manifest: {
          statisticsMerged: 1,
          seasonParticipationMerged: 2,
          userBadgesCopied: 1,
          userBadgesSkipped: 1,
          xpLogsMigrated: 2,
          mvpVotesCastMigrated: 2,
          mvpVotesReceivedMigrated: 1,
          activitiesMigrated: 1,
          xpPointsTransferred: 500,
        },
      });
    },
  );

  it(
    "aborta com failed-precondition quando user_badges satura (guard de " +
    "coleção crítica)",
    async () => {
      const {state} = setupGamificationFixture();
      for (let i = 0; i < 500; i++) {
        state.set(`user_badges/${sourceUid}_BADGE_${i}`, {
          user_id: sourceUid,
          badge_id: `BADGE_${i}`,
        });
      }

      await expect((completeAccountMerge as unknown as (
        request: Data,
      ) => Promise<Data>)({
        auth: {uid: targetUid, token: {}},
        data: {requestId},
      })).rejects.toMatchObject({
        code: "failed-precondition",
        message: expect.stringContaining("user_badges (user_id)"),
      });
      // Nada foi fundido: a origem ainda tem seus docs.
      expect(state.has(`statistics/${sourceUid}`)).toBe(true);
    },
  );

  it(
    "drena xp_logs além de MAX_DOCS_PER_QUERY sem bloquear a união",
    async () => {
      const {state} = setupGamificationFixture();
      for (let i = 0; i < 1200; i++) {
        state.set(`xp_logs/game_bulk-${i}_user_${sourceUid}`, {
          user_id: sourceUid,
          game_id: `bulk-${i}`,
          xp_earned: 10,
        });
      }

      const result = await (completeAccountMerge as unknown as (
        request: Data,
      ) => Promise<Data>)({
        auth: {uid: targetUid, token: {}},
        data: {requestId},
      });
      expect(result).toMatchObject({success: true, status: "completed"});
      expect(state.get(`account_merge_requests/${requestId}`)).toMatchObject({
        manifest: {xpLogsMigrated: 1202},
      });
      const orphans = [...state.entries()].filter(([path, data]) =>
        path.startsWith("xp_logs/") && data.user_id === sourceUid);
      expect(orphans).toHaveLength(0);
    },
  );
});
