type StoredDoc = Record<string, unknown>;

function applyUpdate(current: StoredDoc, data: StoredDoc) {
  return {...current, ...data};
}

class FakeDocRef {
  constructor(
    readonly path: string,
    readonly id: string,
    private readonly store: Map<string, StoredDoc>
  ) {}

  async get() {
    const data = this.store.get(this.path);
    return {
      id: this.id,
      ref: this,
      exists: Boolean(data),
      data: () => data,
    };
  }

  async update(data: StoredDoc) {
    const current = this.store.get(this.path) || {};
    this.store.set(this.path, applyUpdate(current, data));
  }

  async set(data: StoredDoc, options?: {merge?: boolean}) {
    const current = options?.merge ? this.store.get(this.path) || {} : {};
    this.store.set(this.path, options?.merge ? applyUpdate(current, data) : data);
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
    if (failCollectionAddsFor.has(this.path)) {
      throw new Error(`forced add failure for ${this.path}`);
    }
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

class FakeBatch {
  readonly set = jest.fn((ref: FakeDocRef, data: StoredDoc, options?: {merge?: boolean}) => {
    this.operations.push(() => ref.set(data, options));
  });
  readonly update = jest.fn((ref: FakeDocRef, data: StoredDoc) => {
    this.operations.push(() => ref.update(data));
  });
  readonly commit = jest.fn(async () => {
    for (const operation of this.operations) {
      await operation();
    }
  });
  private readonly operations: Array<() => Promise<void>> = [];
}

const firestoreStore = new Map<string, StoredDoc>();
const batchInstances: FakeBatch[] = [];
const mockSecureCallableOptions: Array<Record<string, unknown>> = [];
const failCollectionAddsFor = new Set<string>();
let autoId = 1;

const fakeDb = {
  collection: jest.fn((name: string) => new FakeCollectionRef(name, firestoreStore)),
  batch: jest.fn(() => {
    const batch = new FakeBatch();
    batchInstances.push(batch);
    return batch;
  }),
};

jest.mock("../src/_db", () => ({
  db: () => fakeDb,
}));

jest.mock("../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: jest.fn((options, handler) => {
    mockSecureCallableOptions.push(options);
    return handler;
  }),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  linkLocationToVenueAccount,
  unlinkLocationFromVenueAccount,
  upsertVenueAccount,
} = require("../src/admin/venue-accounts");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {logger} = require("firebase-functions/v2");

function resetFirestore() {
  firestoreStore.clear();
  batchInstances.length = 0;
  mockSecureCallableOptions.length = 0;
  failCollectionAddsFor.clear();
  fakeDb.collection.mockClear();
  fakeDb.batch.mockClear();
  logger.warn.mockClear();
  autoId = 1;
}

function seedOwner() {
  firestoreStore.set("users/owner-1", {
    name: "Dono da Arena",
    role: "FIELD_OWNER",
  });
}

function seedLocations() {
  firestoreStore.set("locations/location-1", {
    owner_id: "owner-1",
    publication_status: "PUBLISHED",
    is_verified: true,
    field_count: 2,
    has_active_fields: true,
    monthly_fee_cents: 9000,
  });
  firestoreStore.set("locations/location-2", {
    owner_id: "owner-1",
    publication_status: "PENDING_REVIEW",
    field_count: 1,
    has_active_fields: true,
    monthly_fee_cents: 7000,
  });
}

describe("venue account admin callables", () => {
  beforeEach(() => {
    resetFirestore();
    seedOwner();
    seedLocations();
  });

  it("cria conta comercial, calcula mensalidade e denormaliza nas quadras", async () => {
    const result = await upsertVenueAccount({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        ownerUid: "owner-1",
        status: "ACTIVE",
        billingScope: "FIELD_COUNT",
        billingPlanCode: "PRO",
        billingPlanLabel: "Pro Campos",
        billingCycle: "MONTHLY",
        pricePerActiveFieldCents: 5000,
        billingDueDay: 10,
        billingContactEmail: "Financeiro@Arena.com",
        linkedLocationIds: ["location-1", "location-2", "location-1"],
      },
    });

    expect(result).toMatchObject({
      success: true,
      accountId: "owner-1",
      linkedLocationIds: ["location-1", "location-2"],
      linkedLocationsCount: 2,
      publishedLocationsCount: 1,
      activeFieldCount: 3,
      computedMonthlyFeeCents: 15000,
      status: "ACTIVE",
      billingScope: "FIELD_COUNT",
    });
    expect(firestoreStore.get("venue_accounts/owner-1")).toMatchObject({
      owner_uid: "owner-1",
      billing_contact_email: "financeiro@arena.com",
      billing_plan_label: "Pro Campos",
      linked_location_ids: ["location-1", "location-2"],
      computed_monthly_fee_cents: 15000,
    });
    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      venue_account_id: "owner-1",
      venue_account_status: "ACTIVE",
      venue_account_charge_scope: "FIELD_COUNT",
      venue_account_monthly_total_cents: 15000,
      venue_account_linked_locations_count: 2,
      venue_account_active_fields_count: 3,
    });
    expect(Array.from(firestoreStore.keys()).some((path) =>
      path.startsWith("venue_accounts/owner-1/events/")
    )).toBe(true);
    expect(Array.from(firestoreStore.keys()).some((path) =>
      path.startsWith("audit_logs/")
    )).toBe(true);
  });

  it("mantem sucesso quando evento de auditoria falha apos persistencia", async () => {
    failCollectionAddsFor.add("venue_accounts/owner-1/events");

    await expect(upsertVenueAccount({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        ownerUid: "owner-1",
        status: "ACTIVE",
        billingScope: "LOCATION",
        defaultLocationFeeCents: 8000,
        linkedLocationIds: ["location-1"],
      },
    })).resolves.toMatchObject({
      success: true,
      accountId: "owner-1",
      computedMonthlyFeeCents: 8000,
    });

    expect(firestoreStore.get("venue_accounts/owner-1")).toMatchObject({
      owner_uid: "owner-1",
      computed_monthly_fee_cents: 8000,
    });
    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      venue_account_id: "owner-1",
      venue_account_monthly_total_cents: 8000,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "Venue account owner-1 synced but audit event failed",
      expect.any(Error)
    );
  });

  it("vincula e desvincula quadra mantendo denormalizacao consistente", async () => {
    firestoreStore.set("venue_accounts/owner-1", {
      owner_uid: "owner-1",
      status: "ACTIVE",
      billing_scope: "LOCATION",
      default_location_fee_cents: 8000,
      linked_location_ids: ["location-1"],
    });

    const linked = await linkLocationToVenueAccount({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {ownerUid: "owner-1", locationId: "location-2"},
    });

    expect(linked).toMatchObject({
      linkedLocationIds: ["location-1", "location-2"],
      computedMonthlyFeeCents: 16000,
    });
    expect(firestoreStore.get("locations/location-2")).toMatchObject({
      venue_account_id: "owner-1",
      venue_account_monthly_total_cents: 16000,
    });

    const unlinked = await unlinkLocationFromVenueAccount({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {ownerUid: "owner-1", locationId: "location-2"},
    });

    expect(unlinked).toMatchObject({
      linkedLocationIds: ["location-1"],
      computedMonthlyFeeCents: 8000,
    });
    expect(firestoreStore.get("locations/location-2")).toMatchObject({
      venue_account_id: null,
      venue_account_status: null,
      venue_account_monthly_total_cents: null,
    });
  });

  it("atualiza conta existente preservando campos omitidos e datas comerciais", async () => {
    firestoreStore.set("venue_accounts/owner-1", {
      owner_uid: "owner-1",
      status: "TRIAL",
      billing_scope: "OWNER",
      billing_plan_code: "BASIC",
      billing_plan_label: "Fundador",
      billing_cycle: "MONTHLY",
      billing_base_fee_cents: 12000,
      default_location_fee_cents: 9000,
      price_per_active_field_cents: 4000,
      monthly_fee_override_cents: 18000,
      billing_due_day: 15,
      billing_contact_name: "Financeiro Antigo",
      billing_contact_email: "old@example.com",
      billing_contact_phone: "+5511999999999",
      billing_contact_document: "12345678900",
      billing_starts_at: new Date("2026-07-01T00:00:00.000Z"),
      billing_expires_at: new Date("2026-12-31T00:00:00.000Z"),
      notes: "Observacao antiga",
      admin_notes: "Nota interna antiga",
      linked_location_ids: ["location-1", "location-2"],
    });

    const result = await upsertVenueAccount({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        ownerUid: "owner-1",
        status: "ACTIVE",
        billingScope: "MANUAL_OVERRIDE",
        billingStartsAtIso: "2026-08-01T00:00:00.000Z",
        billingExpiresAtIso: "2026-12-01T00:00:00.000Z",
        billingContactName: " Financeiro Novo ",
        billingContactPhone: " +5511888888888 ",
        billingContactDocument: " 11222333000144 ",
        notes: " Plano migrado ",
        adminNotes: " Revisado pelo admin ",
      },
    });

    expect(result).toMatchObject({
      success: true,
      accountId: "owner-1",
      billingScope: "MANUAL_OVERRIDE",
      computedMonthlyFeeCents: 18000,
      linkedLocationIds: ["location-1", "location-2"],
    });
    expect(firestoreStore.get("venue_accounts/owner-1")).toMatchObject({
      billing_contact_name: "Financeiro Novo",
      billing_contact_email: "old@example.com",
      billing_contact_phone: "+5511888888888",
      billing_contact_document: "11222333000144",
      billing_plan_code: "BASIC",
      billing_plan_label: "Fundador",
      billing_cycle: "MONTHLY",
      billing_base_fee_cents: 12000,
      monthly_fee_override_cents: 18000,
      notes: "Plano migrado",
      admin_notes: "Revisado pelo admin",
    });
    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      venue_account_status: "ACTIVE",
      venue_account_charge_scope: "MANUAL_OVERRIDE",
      venue_account_plan_code: "BASIC",
      venue_account_plan_label: "Fundador",
      venue_account_monthly_total_cents: 18000,
    });
  });

  it("rejeita quadra de outro dono ou ja vinculada a outra conta", async () => {
    firestoreStore.set("locations/location-foreign", {
      owner_id: "owner-2",
      venue_account_id: "owner-2",
    });

    await expect(upsertVenueAccount({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        ownerUid: "owner-1",
        linkedLocationIds: ["location-foreign"],
      },
    })).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("rejeita entrada comercial invalida antes de persistir", async () => {
    await expect(upsertVenueAccount({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {ownerUid: "owner-1", billingContactEmail: "email-invalido"},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(upsertVenueAccount({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {ownerUid: "owner-1", billingBaseFeeCents: -1},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(upsertVenueAccount({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {ownerUid: "owner-1", billingDueDay: 40},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(upsertVenueAccount({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        ownerUid: "owner-1",
        billingStartsAtIso: "2026-12-31T00:00:00.000Z",
        billingExpiresAtIso: "2026-01-01T00:00:00.000Z",
      },
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(upsertVenueAccount({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {ownerUid: "owner-1", linkedLocationIds: ["missing-location"]},
    })).rejects.toMatchObject({code: "not-found"});
  });

  it("registra callables admin-only com rate limits dedicados", () => {
    jest.isolateModules(() => {
      require("../src/admin/venue-accounts");
    });

    expect(mockSecureCallableOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        requireAuth: true,
        requiredRole: "ADMIN",
        rateLimit: expect.objectContaining({keyPrefix: "venueAccountUpsert"}),
      }),
      expect.objectContaining({
        requireAuth: true,
        requiredRole: "ADMIN",
        rateLimit: expect.objectContaining({keyPrefix: "venueAccountLinkLocation"}),
      }),
      expect.objectContaining({
        requireAuth: true,
        requiredRole: "ADMIN",
        rateLimit: expect.objectContaining({keyPrefix: "venueAccountUnlinkLocation"}),
      }),
    ]));
  });
});
