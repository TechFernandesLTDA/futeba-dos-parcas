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
        docs = docs.filter((doc) => doc.id.localeCompare(startAfterId) > 0);
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

  return {
    state,
    firestore,
    transaction,
    bulkWriter,
    failBulkWritePaths,
  };
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
      [`statistics/${sourceUid}`]: {
        totalGames: 5,
        totalGoals: 2,
        currentMvpStreak: 1,
        bestMvpStreak: 3,
      },
      [`statistics/${targetUid}`]: {
        totalGames: 2,
        totalGoals: 1,
        currentMvpStreak: 2,
        bestMvpStreak: 2,
      },
      [`xp_logs/game_game-2_user_${sourceUid}`]: {
        user_id: sourceUid,
        game_id: "game-2",
        xp_earned: 15,
      },
      [`xp_logs/game_game-2_user_${targetUid}`]: {
        user_id: targetUid,
        game_id: "game-2",
        xp_earned: 20,
      },
      [`user_badges/${sourceUid}_GAMES_10`]: {
        user_id: sourceUid,
        badge_id: "GAMES_10",
        earned: true,
        count: 2,
        earned_at: Timestamp.fromMillis(1_000),
        last_earned_at: Timestamp.fromMillis(3_000),
      },
      "user_badges/legacy-source-games-10": {
        user_id: sourceUid,
        badge_id: "GAMES_10",
        earned: true,
        count: 4,
        earned_at: Timestamp.fromMillis(500),
        last_earned_at: Timestamp.fromMillis(5_000),
      },
      [`user_badges/${targetUid}_GAMES_10`]: {
        user_id: targetUid,
        badge_id: "GAMES_10",
        earned: true,
        count: 1,
        earned_at: Timestamp.fromMillis(2_000),
        last_earned_at: Timestamp.fromMillis(2_000),
      },
      [`user_badges/${sourceUid}_GOALS_10`]: {
        user_id: sourceUid,
        badge_id: "GOALS_10",
        earned: true,
        count: 1,
        earned_at: Timestamp.fromMillis(4_000),
      },
      [`season_participation/season-1_${sourceUid}`]: {
        user_id: sourceUid,
        season_id: "season-1",
        points: 7,
        games_played: 3,
        total_xp: 200,
        position: 2,
        group_ids: ["group-1"],
        by_gender: {MALE: {points: 7, total_xp: 200}},
      },
      [`season_participation/season-1_${targetUid}`]: {
        user_id: targetUid,
        season_id: "season-1",
        points: 3,
        games_played: 1,
        total_xp: 100,
        position: 5,
        group_ids: ["group-2"],
        by_gender: {MALE: {points: 3, total_xp: 100}},
      },
      [`mvp_votes/game-2_${sourceUid}_BEST_PLAYER`]: {
        game_id: "game-2",
        voter_id: sourceUid,
        voted_player_id: "other-player",
        category: "BEST_PLAYER",
      },
      [`mvp_votes/game-2_${targetUid}_BEST_PLAYER`]: {
        game_id: "game-2",
        voter_id: targetUid,
        voted_player_id: "canonical-choice",
        category: "BEST_PLAYER",
      },
      "mvp_votes/game-3_other_BEST_PLAYER": {
        game_id: "game-3",
        voter_id: "other-voter",
        voted_player_id: sourceUid,
        category: "BEST_PLAYER",
      },
      "activities/game-2": {
        user_id: sourceUid,
        user_name: "Nome anterior",
        user_photo: "source.jpg",
      },
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
        statisticsMigrated: 1,
        xpLogsMigrated: 1,
        userBadgesMigrated: 2,
        seasonParticipationMigrated: 1,
        mvpVotesMigrated: 1,
        mvpVoteReferencesMigrated: 1,
        activitiesMigrated: 1,
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
    expect(state.has(`statistics/${sourceUid}`)).toBe(false);
    expect(state.get(`statistics/${targetUid}`)).toMatchObject({
      totalGames: 7,
      totalGoals: 3,
      currentMvpStreak: 2,
      bestMvpStreak: 3,
      user_id: targetUid,
    });
    expect(state.has(`xp_logs/game_game-2_user_${sourceUid}`)).toBe(false);
    expect(state.get(`xp_logs/game_game-2_user_${targetUid}`)).toMatchObject({
      user_id: targetUid,
      xp_earned: 20,
      merged_from_uid: sourceUid,
    });
    expect(state.has(`user_badges/${sourceUid}_GAMES_10`)).toBe(false);
    expect(state.has("user_badges/legacy-source-games-10")).toBe(false);
    expect(state.has(`user_badges/${sourceUid}_GOALS_10`)).toBe(false);
    expect(state.get(`user_badges/${targetUid}_GAMES_10`)).toMatchObject({
      user_id: targetUid,
      count: 7,
    });
    expect(
      (state.get(`user_badges/${targetUid}_GAMES_10`)
        ?.earned_at as Timestamp).toMillis()
    ).toBe(500);
    expect(state.has(`season_participation/season-1_${sourceUid}`))
      .toBe(false);
    expect(state.get(`season_participation/season-1_${targetUid}`))
      .toMatchObject({
        user_id: targetUid,
        points: 10,
        games_played: 4,
        total_xp: 300,
        position: 2,
        group_ids: ["group-1", "group-2"],
        by_gender: {MALE: {points: 10, total_xp: 300}},
      });
    expect(state.has(`mvp_votes/game-2_${sourceUid}_BEST_PLAYER`))
      .toBe(false);
    expect(state.get(`mvp_votes/game-2_${targetUid}_BEST_PLAYER`))
      .toMatchObject({
        voter_id: targetUid,
        voted_player_id: "canonical-choice",
      });
    expect(state.get("mvp_votes/game-3_other_BEST_PLAYER")).toMatchObject({
      voted_player_id: targetUid,
    });
    expect(state.get("activities/game-2")).toMatchObject({
      user_id: targetUid,
      user_name: "Nome canônico",
      user_photo: "target.jpg",
    });
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
    const {state, firestore, failBulkWritePaths} = createFakeFirestore({
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
      [`statistics/${sourceUid}`]: {totalGames: 4, totalGoals: 2},
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

    return {state, auth, failBulkWritePaths};
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
    "retry após progresso parcial preserva gamificação e manifest (#4112)",
    async () => {
      const {state, auth, failBulkWritePaths} =
        setupFailingBulkWriteFixture("notifications/notification-1");
      const invoke = () => (completeAccountMerge as unknown as (
        request: Data,
      ) => Promise<Data>)({
        auth: {uid: targetUid, token: {}},
        data: {requestId},
      });

      await expect(invoke()).rejects.toMatchObject({code: "internal"});
      expect(state.has(`statistics/${sourceUid}`)).toBe(false);
      expect(state.get(`statistics/${targetUid}`)).toMatchObject({
        totalGames: 4,
        totalGoals: 2,
        merged_from_uid: sourceUid,
      });
      expect(auth.updateUser).not.toHaveBeenCalled();

      state.set(`account_merge_requests/${requestId}`, {
        ...state.get(`account_merge_requests/${requestId}`),
        processingLeaseExpiresAt: Timestamp.fromMillis(Date.now() - 1),
      });
      failBulkWritePaths.clear();

      await expect(invoke()).resolves.toMatchObject({
        success: true,
        status: "completed",
      });
      expect(state.get(`account_merge_requests/${requestId}`)).toMatchObject({
        status: "completed",
        manifest: expect.objectContaining({statisticsMigrated: 1}),
      });
      expect(auth.updateUser).toHaveBeenCalledTimes(1);
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
