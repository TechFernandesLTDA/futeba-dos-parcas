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
  get: () => Promise<FakeQuerySnapshot>;
}

interface FakeCollectionReference extends FakeQuery {
  path: string;
  doc: (id?: string) => FakeDocumentReference;
}

function createFakeFirestore(initial: Record<string, Data>) {
  const state = new Map<string, Data>(Object.entries(initial));
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
  ): FakeQuery => ({
    where: (field, op, value) => query(
      collectionPath,
      [...filters, {field, op, value}],
    ),
    get: async () => {
      const docs = directDocuments(collectionPath).filter((doc) => {
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
    set: jest.fn((
      ref: FakeDocumentReference,
      data: Data,
      options?: {merge?: boolean},
    ) => write(ref, data, options)),
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
});
