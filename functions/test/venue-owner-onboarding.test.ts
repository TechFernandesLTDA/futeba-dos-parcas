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

  it("registra callables com auditoria e rate limit dedicados", async () => {
    jest.isolateModules(() => {
      require("../src/admin/venue-owner-onboarding");
    });

    const requestOptions = mockSecureCallable.mock.calls[0][0];
    const reviewOptions = mockSecureCallable.mock.calls[1][0];

    await expect(requestOptions.auditLogContext({
      auth: {uid: "player-1"},
      data: {locationIds: ["loc-1", "loc-2"]},
    })).resolves.toMatchObject({
      function: "requestVenueOwnerOnboarding",
      ownerUid: "player-1",
      locationCount: 2,
    });
    await expect(requestOptions.auditLogContext({
      auth: {uid: "player-1"},
      data: {locationIds: "loc-1"},
    })).resolves.toMatchObject({locationCount: 0});
    await expect(reviewOptions.auditLogContext({
      data: {ownerUid: "player-1", decision: "REJECTED"},
    })).resolves.toMatchObject({
      function: "reviewVenueOwnerOnboarding",
      ownerUid: "player-1",
      decision: "REJECTED",
    });
    expect(requestOptions.rateLimit).toMatchObject({keyPrefix: "venueOwnerOnboarding"});
    expect(reviewOptions).toMatchObject({
      requiredRole: "ADMIN",
      rateLimit: expect.objectContaining({keyPrefix: "venueOwnerReview"}),
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
        commercialDocument: "  12.345.678/0001-90  ",
        notes: "  Quero cadastrar duas quadras.  ",
        locationIds: [" loc-1 ", "loc-1", 123, "", "loc-2"],
      },
    }) as {status: string};

    expect(result.status).toBe("IN_REVIEW");
    expect(firestoreStore.get("venue_owner_onboarding/player-1"))
      .toMatchObject({
        owner_uid: "player-1",
        status: "IN_REVIEW",
        business_name: "Arena Teste",
        commercial_document: "12.345.678/0001-90",
        notes: "Quero cadastrar duas quadras.",
        location_ids: ["loc-1", "loc-2"],
      });
    expect([...firestoreStore.keys()])
      .toEqual(expect.arrayContaining([
        "venue_owner_onboarding/player-1/events/auto-1",
        "audit_logs/auto-2",
      ]));
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it("valida termos, email e dados minimos da solicitacao", async () => {
    let requestVenueOwnerOnboarding: (request: unknown) => Promise<unknown>;
    jest.isolateModules(() => {
      requestVenueOwnerOnboarding =
        require("../src/admin/venue-owner-onboarding").requestVenueOwnerOnboarding;
    });

    await expect(requestVenueOwnerOnboarding!({
      auth: {uid: "player-1", token: {role: "PLAYER"}},
      data: {contactName: "Jogador Dono", contactEmail: "dono@test.com"},
    })).rejects.toMatchObject({code: "failed-precondition"});

    await expect(requestVenueOwnerOnboarding!({
      auth: {uid: "player-1", token: {role: "PLAYER"}},
      data: {contactName: "Jogador Dono", contactEmail: "email-invalido", termsAccepted: true},
    })).rejects.toMatchObject({code: "invalid-argument"});

    firestoreStore.set("users/player-1", {role: "PLAYER"});
    await expect(requestVenueOwnerOnboarding!({
      auth: {uid: "player-1", token: {role: "PLAYER"}},
      data: {termsAccepted: true},
    })).rejects.toMatchObject({code: "invalid-argument"});

    firestoreStore.delete("users/player-1");
    await expect(requestVenueOwnerOnboarding!({
      auth: {uid: "player-1", token: {role: "PLAYER"}},
      data: {contactName: "Jogador Dono", termsAccepted: true},
    })).rejects.toMatchObject({code: "not-found"});
  });

  it("mantem aprovado e bloqueia autoatualizacao de status suspenso", async () => {
    let requestVenueOwnerOnboarding: (request: unknown) => Promise<unknown>;
    jest.isolateModules(() => {
      requestVenueOwnerOnboarding =
        require("../src/admin/venue-owner-onboarding").requestVenueOwnerOnboarding;
    });

    firestoreStore.set("venue_owner_onboarding/player-1", {status: "APPROVED"});
    await expect(requestVenueOwnerOnboarding!({
      auth: {uid: "player-1", token: {role: "PLAYER"}},
      data: {contactName: "Jogador Dono", contactEmail: "dono@test.com", termsAccepted: true},
    })).resolves.toMatchObject({status: "APPROVED", role: "PLAYER"});

    firestoreStore.set("venue_owner_onboarding/player-1", {status: "SUSPENDED"});
    await expect(requestVenueOwnerOnboarding!({
      auth: {uid: "player-1", token: {role: "PLAYER"}},
      data: {contactName: "Jogador Dono", contactEmail: "dono@test.com", termsAccepted: true},
    })).rejects.toMatchObject({code: "failed-precondition"});
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

  it("rejeita decisoes invalidas e exige motivo para nao aprovacao", async () => {
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
      data: {ownerUid: "player-1", decision: "PENDING"},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(reviewVenueOwnerOnboarding!({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {ownerUid: "player-1", decision: "REJECTED"},
    })).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("rejeicao admin atualiza status sem alterar custom claims", async () => {
    firestoreStore.set("venue_owner_onboarding/player-1", {
      owner_uid: "player-1",
      status: "IN_REVIEW",
    });

    let reviewVenueOwnerOnboarding: (request: unknown) => Promise<unknown>;
    jest.isolateModules(() => {
      reviewVenueOwnerOnboarding =
        require("../src/admin/venue-owner-onboarding").reviewVenueOwnerOnboarding;
    });

    const result = await reviewVenueOwnerOnboarding!({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        ownerUid: "player-1",
        decision: "REJECTED",
        reason: "Cadastro comercial incompleto",
      },
    }) as {status: string; role: string};

    expect(result).toMatchObject({status: "REJECTED", role: "PLAYER"});
    expect(firestoreStore.get("users/player-1")).toMatchObject({
      role: "PLAYER",
      venue_owner_onboarding_status: "REJECTED",
    });
    expect(firestoreStore.get("venue_owner_onboarding/player-1"))
      .toMatchObject({status: "REJECTED", review_reason: "Cadastro comercial incompleto"});
    expect([...firestoreStore.values()]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "VENUE_OWNER_ONBOARDING_REJECTED",
        reason: "Cadastro comercial incompleto",
      }),
    ]));
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it("falha revisao quando onboarding ou usuario nao existem", async () => {
    let reviewVenueOwnerOnboarding: (request: unknown) => Promise<unknown>;
    jest.isolateModules(() => {
      reviewVenueOwnerOnboarding =
        require("../src/admin/venue-owner-onboarding").reviewVenueOwnerOnboarding;
    });

    await expect(reviewVenueOwnerOnboarding!({
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
    })).rejects.toMatchObject({code: "not-found"});

    firestoreStore.set("venue_owner_onboarding/player-1", {status: "IN_REVIEW"});
    firestoreStore.delete("users/player-1");
    await expect(reviewVenueOwnerOnboarding!({
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
    })).rejects.toMatchObject({code: "not-found"});
  });
});
