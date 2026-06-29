process.env.FUNCTIONS_EMULATOR = "true";

type StoredDoc = Record<string, unknown>;

class FakeDocRef {
  constructor(
    readonly path: string,
    readonly id: string,
    private readonly store: Map<string, StoredDoc>
  ) {}

  async get() {
    const data = this.store.get(this.path);
    return {
      exists: Boolean(data),
      data: () => data,
    };
  }

  async set(data: StoredDoc, options?: {merge?: boolean}) {
    const current = options?.merge ? this.store.get(this.path) || {} : {};
    this.store.set(this.path, {...current, ...data});
  }

  async update(data: StoredDoc) {
    this.store.set(this.path, {...(this.store.get(this.path) || {}), ...data});
  }

  collection(name: string) {
    return new FakeCollectionRef(`${this.path}/${name}`, this.store);
  }
}

class FakeCollectionRef {
  constructor(
    readonly path: string,
    private readonly store: Map<string, StoredDoc>
  ) {}

  doc(id = `auto-${autoId++}`) {
    return new FakeDocRef(`${this.path}/${id}`, id, this.store);
  }

  async add(data: StoredDoc) {
    const ref = this.doc();
    this.store.set(ref.path, data);
    return ref;
  }
}

class FakeBatch {
  readonly update = jest.fn((ref: FakeDocRef, data: StoredDoc) => {
    this.operations.push(() => ref.update(data));
  });

  readonly commit = jest.fn(async () => {
    for (const operation of this.operations) await operation();
  });

  private readonly operations: Array<() => Promise<void>> = [];
}

const firestoreStore = new Map<string, StoredDoc>();
const mockBatch = jest.fn(() => new FakeBatch());
const mockSecureCallable = jest.fn((_options, handler) => handler);
const mockSetCustomUserClaims = jest.fn().mockResolvedValue(undefined);
const mockRevokeRefreshTokens = jest.fn().mockResolvedValue(undefined);
let autoId = 1;

jest.mock("../src/_db", () => ({
  db: () => ({
    collection: (name: string) => new FakeCollectionRef(name, firestoreStore),
    batch: mockBatch,
  }),
}));

jest.mock("../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: (...args: unknown[]) => mockSecureCallable(...args),
}));

jest.mock("firebase-admin", () => ({
  auth: () => ({
    getUser: jest.fn().mockResolvedValue({customClaims: {verified: true}}),
    setCustomUserClaims: mockSetCustomUserClaims,
    revokeRefreshTokens: mockRevokeRefreshTokens,
  }),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => ({_serverTimestamp: true}),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), error: jest.fn(), warn: jest.fn()},
}));

describe("venue owner onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    firestoreStore.clear();
    autoId = 1;
    firestoreStore.set("users/player-1", {
      name: "Jogador Dono",
      email: "dono@test.com",
      role: "PLAYER",
    });
  });

  it("permite usuario enviar solicitacao em revisao sem autoaprovar", async () => {
    let requestVenueOwnerOnboarding: (request: unknown) => Promise<unknown>;
    jest.isolateModules(() => {
      requestVenueOwnerOnboarding =
        require("../src/admin/venue-owner-onboarding").requestVenueOwnerOnboarding;
    });

    const result = await requestVenueOwnerOnboarding!({
      auth: {uid: "player-1", token: {role: "PLAYER"}},
      data: {
        contactName: "Jogador Dono",
        contactEmail: "dono@test.com",
        termsAccepted: true,
        businessName: "Arena Teste",
      },
    }) as {status: string};

    expect(result.status).toBe("IN_REVIEW");
    expect(firestoreStore.get("venue_owner_onboarding/player-1"))
      .toMatchObject({
        owner_uid: "player-1",
        status: "IN_REVIEW",
        business_name: "Arena Teste",
      });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it("aprovar exige checklist e promove para FIELD_OWNER", async () => {
    firestoreStore.set("venue_owner_onboarding/player-1", {
      owner_uid: "player-1",
      status: "IN_REVIEW",
    });

    let reviewVenueOwnerOnboarding: (request: unknown) => Promise<unknown>;
    jest.isolateModules(() => {
      reviewVenueOwnerOnboarding =
        require("../src/admin/venue-owner-onboarding").reviewVenueOwnerOnboarding;
    });

    await expect(reviewVenueOwnerOnboarding!({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {ownerUid: "player-1", decision: "APPROVED", checklist: {contactReviewed: true}},
    })).rejects.toMatchObject({code: "failed-precondition"});

    const result = await reviewVenueOwnerOnboarding!({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        ownerUid: "player-1",
        decision: "APPROVED",
        checklist: {
          contactReviewed: true,
          locationsReviewed: true,
          termsReviewed: true,
          billingReviewed: true,
        },
      },
    }) as {status: string; role: string};

    expect(result).toMatchObject({status: "APPROVED", role: "FIELD_OWNER"});
    expect(firestoreStore.get("users/player-1")).toMatchObject({
      role: "FIELD_OWNER",
      venue_owner_onboarding_status: "APPROVED",
    });
    expect(mockSetCustomUserClaims)
      .toHaveBeenCalledWith("player-1", expect.objectContaining({role: "FIELD_OWNER"}));
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith("player-1");
  });
});
