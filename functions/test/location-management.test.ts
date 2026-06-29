/**
 * REGRESSAO #1684 — deleteLocation cascade paginado.
 *
 * Tambem cobre os controles comerciais de quadras monetizadas para manter
 * publicacao, mensalidade e pagamentos protegidos por callable admin.
 */

type StoredDoc = Record<string, unknown>;
type ArraySentinel = {
  _op: "arrayUnion" | "arrayRemove";
  values: unknown[];
};

function isArraySentinel(value: unknown): value is ArraySentinel {
  return Boolean(
    value &&
    typeof value === "object" &&
    "_op" in value &&
    "values" in value
  );
}

function applyUpdate(current: StoredDoc, data: StoredDoc) {
  const next = {...current};
  Object.entries(data).forEach(([key, value]) => {
    if (isArraySentinel(value)) {
      const currentArray = Array.isArray(next[key]) ? next[key] as unknown[] : [];
      if (value._op === "arrayUnion") {
        next[key] = Array.from(new Set([...currentArray, ...value.values]));
      } else {
        next[key] = currentArray.filter((item) => !value.values.includes(item));
      }
      return;
    }
    next[key] = value;
  });
  return next;
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
      exists: Boolean(data),
      data: () => data,
    };
  }

  async update(data: StoredDoc) {
    const current = this.store.get(this.path) || {};
    this.store.set(this.path, applyUpdate(current, data));
  }

  async set(data: StoredDoc) {
    this.store.set(this.path, data);
  }

  async delete() {
    this.store.delete(this.path);
  }

  collection(name: string) {
    return new FakeCollectionRef(`${this.path}/${name}`, this.store);
  }
}

class FakeCollectionRef {
  constructor(
    readonly path: string,
    private readonly store: Map<string, StoredDoc>,
    private readonly limitSize?: number,
    private readonly whereFilters: Array<{
      field: string;
      op: "==";
      value: unknown;
    }> = []
  ) {}

  doc(id = `auto-${autoId++}`) {
    return new FakeDocRef(`${this.path}/${id}`, id, this.store);
  }

  async add(data: StoredDoc) {
    const ref = this.doc();
    this.store.set(ref.path, data);
    return ref;
  }

  limit(size: number) {
    return new FakeCollectionRef(
      this.path,
      this.store,
      size,
      this.whereFilters
    );
  }

  where(field: string, op: "==", value: unknown) {
    return new FakeCollectionRef(
      this.path,
      this.store,
      this.limitSize,
      [...this.whereFilters, {field, op, value}]
    );
  }

  async get() {
    const prefix = `${this.path}/`;
    const docs = Array.from(this.store.keys())
      .filter((path) => path.startsWith(prefix))
      .filter((path) => !path.slice(prefix.length).includes("/"))
      .filter((path) => {
        const data = this.store.get(path) || {};
        return this.whereFilters.every((filter) =>
          filter.op === "==" && data[filter.field] === filter.value
        );
      })
      .slice(0, this.limitSize)
      .map((path) => ({
        id: path.split("/").pop() || "",
        ref: new FakeDocRef(path, path.split("/").pop() || "", this.store),
        data: () => this.store.get(path),
      }));
    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
    };
  }
}

class FakeBatch {
  readonly delete = jest.fn((ref: FakeDocRef) => {
    this.operations.push(() => ref.delete());
  });
  readonly set = jest.fn((ref: FakeDocRef, data: StoredDoc) => {
    this.operations.push(() => {
      firestoreStore.set(ref.path, data);
      return Promise.resolve();
    });
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
const mockSecureCallableOptions: Array<{
  auditLogContext?: (request: {data?: Record<string, unknown>}) => Promise<unknown>;
}> = [];
let autoId = 1;

const mockBatch = jest.fn().mockImplementation(() => {
  const batch = new FakeBatch();
  batchInstances.push(batch);
  return batch;
});

const fakeDb = {
  collection: jest.fn((name: string) => (
    new FakeCollectionRef(name, firestoreStore)
  )),
  batch: mockBatch,
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
    arrayUnion: jest.fn((...values: unknown[]) => ({_op: "arrayUnion", values})),
    arrayRemove: jest.fn((...values: unknown[]) => ({_op: "arrayRemove", values})),
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

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config, handler) => handler),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  acceptLocationManagerInvite,
  assignLocationOwner,
  deleteLocation,
  deleteLocationSubcollection,
  getAdminLocationBillingSummary,
  inviteLocationManager,
  processLocationBillingAutomation,
  processLocationBillingCycles,
  registerLocationSubscriptionPayment,
  reviewLocationSubscriptionReceipt,
  removeLocationManager,
  runLocationBillingAutomation,
  setLocationPublicationStatus,
  setLocationSubscription,
  submitLocationSubscriptionReceipt,
} = require("../src/locations/location-management");

describe("deleteLocationSubcollection", () => {
  beforeEach(() => {
    resetFirestore();
  });

  it("deleta subcolecao em paginas de ate 500 docs", async () => {
    seedSubcollection("locations/location-1/reviews", 1200);

    await expect(
      deleteLocationSubcollection("location-1", "reviews")
    ).resolves.toBe(1200);

    expect(batchInstances).toHaveLength(3);
    expect(totalDeleteCalls()).toBe(1200);
    expect(batchInstances.every((batch) => batch.commit.mock.calls.length === 1))
      .toBe(true);
    expect(collectionSize("locations/location-1/reviews")).toBe(0);
  });
});

describe("location commercial admin callables", () => {
  beforeEach(() => {
    resetFirestore();
    firestoreStore.set("locations/location-1", {
      name: "Arena Parcas",
      owner_id: "owner-1",
      managers: ["manager-existing"],
      publication_status: "PENDING_REVIEW",
      subscription_status: "TRIAL",
      commercial_status: "TRIAL",
      is_active: true,
      is_verified: false,
    });
  });

  it("publica uma quadra e registra auditoria comercial", async () => {
    await expect(setLocationPublicationStatus({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        publicationStatus: "PUBLISHED",
        reason: "Cadastro validado",
      },
    })).resolves.toEqual({
      success: true,
      locationId: "location-1",
      publicationStatus: "PUBLISHED",
    });

    const location = firestoreStore.get("locations/location-1");
    expect(location).toMatchObject({
      publication_status: "PUBLISHED",
      is_verified: true,
      unpublished_reason: null,
      published_by: "admin-1",
      updated_by: "admin-1",
    });
    expect(collectionSize("locations/location-1/commercial_events")).toBe(1);
    expect(collectionSize("audit_logs")).toBe(1);
  });

  it("deleta quadra com subcolecoes comerciais e registra auditoria", async () => {
    seedSubcollection("locations/location-1/reviews", 2);
    seedSubcollection("locations/location-1/fields", 1);
    seedSubcollection("locations/location-1/subscription_payments", 1);
    seedSubcollection("locations/location-1/subscription_ledger", 1);

    await expect(deleteLocation({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {locationId: "location-1"},
    })).resolves.toEqual({
      success: true,
      deletedCount: 6,
    });

    expect(firestoreStore.has("locations/location-1")).toBe(false);
    expect(collectionSize("locations/location-1/reviews")).toBe(0);
    expect(collectionSize("locations/location-1/fields")).toBe(0);
    expect(collectionSize("locations/location-1/subscription_payments")).toBe(0);
    expect(collectionSize("locations/location-1/subscription_ledger")).toBe(0);
    const [, auditLog] = findFirstDoc("audit_logs");
    expect(auditLog).toMatchObject({
      type: "LOCATION_DELETE",
      target_location_id: "location-1",
      actor_user_id: "admin-1",
      location_name: "Arena Parcas",
      deleted_docs_count: 6,
    });
  });

  it("rejeita exclusao de quadra sem auth, locationId valido ou doc existente", async () => {
    await expect(deleteLocation({
      data: {locationId: "location-1"},
    })).rejects.toMatchObject({code: "unauthenticated"});

    await expect(deleteLocation({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {locationId: ""},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(deleteLocation({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {locationId: "missing"},
    })).rejects.toMatchObject({code: "not-found"});
  });

  it("expõe contexto de auditoria para publicação, assinatura e pagamento", async () => {
    const cases = [
      {
        data: {locationId: "location-1"},
        expected: {function: "deleteLocation", locationId: "location-1"},
      },
      {
        data: {periodKey: "2026-07"},
        expected: {
          function: "runLocationBillingAutomation",
          periodKey: "2026-07",
        },
      },
      {
        data: {periodKey: "2026-07"},
        expected: {
          function: "getAdminLocationBillingSummary",
          periodKey: "2026-07",
        },
      },
      {
        data: {locationId: "location-1", publicationStatus: "PUBLISHED"},
        expected: {
          function: "setLocationPublicationStatus",
          locationId: "location-1",
          publicationStatus: "PUBLISHED",
        },
      },
      {
        data: {locationId: "location-1", subscriptionStatus: "OVERDUE"},
        expected: {
          function: "setLocationSubscription",
          locationId: "location-1",
          subscriptionStatus: "OVERDUE",
        },
      },
      {
        data: {locationId: "location-1", periodKey: "2026-07"},
        expected: {
          function: "registerLocationSubscriptionPayment",
          locationId: "location-1",
          periodKey: "2026-07",
        },
      },
      {
        data: {locationId: "location-1", periodKey: "2026-07"},
        expected: {
          function: "submitLocationSubscriptionReceipt",
          locationId: "location-1",
          periodKey: "2026-07",
        },
      },
      {
        data: {
          locationId: "location-1",
          paymentId: "payment-1",
          decision: "APPROVED",
        },
        expected: {
          function: "reviewLocationSubscriptionReceipt",
          locationId: "location-1",
          paymentId: "payment-1",
          decision: "APPROVED",
        },
      },
      {
        data: {locationId: "location-1", newOwnerId: "owner-2"},
        expected: {
          function: "assignLocationOwner",
          locationId: "location-1",
          newOwnerId: "owner-2",
        },
      },
      {
        data: {
          locationId: "location-1",
          managerUid: "manager-2",
          managerEmail: "manager@example.com",
        },
        expected: {
          function: "inviteLocationManager",
          locationId: "location-1",
          managerUid: "manager-2",
          managerEmail: "manager@example.com",
        },
      },
      {
        data: {locationId: "location-1", inviteId: "invite-1"},
        expected: {
          function: "acceptLocationManagerInvite",
          locationId: "location-1",
          inviteId: "invite-1",
        },
      },
      {
        data: {locationId: "location-1", managerUid: "manager-2"},
        expected: {
          function: "removeLocationManager",
          locationId: "location-1",
          managerUid: "manager-2",
        },
      },
    ];

    const contexts = [];
    for (const options of mockSecureCallableOptions) {
      if (!options.auditLogContext) continue;
      for (const testCase of cases) {
        contexts.push(await options.auditLogContext({data: testCase.data}));
      }
    }
    for (const testCase of cases) {
      expect(contexts).toContainEqual(testCase.expected);
    }
  });

  it("calcula painel financeiro admin por periodo sem expor calculo ao client", async () => {
    firestoreStore.set("locations/location-1", {
      ...firestoreStore.get("locations/location-1"),
      name: "Arena Ativa",
      city: "São Paulo",
      state: "SP",
      publication_status: "PUBLISHED",
      subscription_status: "ACTIVE",
      monthly_fee_cents: 20000,
      billing_due_day: 10,
      updated_at: new Date("2026-07-02T10:00:00.000Z"),
    });
    firestoreStore.set("locations/location-2", {
      name: "Arena Vencida",
      owner_id: "owner-2",
      city: "Santos",
      state: "SP",
      publication_status: "PUBLISHED",
      subscription_status: "OVERDUE",
      monthly_fee_cents: 15000,
      billing_due_day: 5,
    });
    firestoreStore.set("locations/location-3", {
      name: "Arena Trial",
      owner_id: "owner-3",
      city: "Campinas",
      state: "SP",
      publication_status: "PENDING_REVIEW",
      subscription_status: "TRIAL",
      monthly_fee_cents: 9900,
    });
    firestoreStore.set("locations/location-4", {
      name: "Arena Suspensa",
      owner_id: "owner-4",
      city: "Rio de Janeiro",
      state: "RJ",
      publication_status: "SUSPENDED",
      subscription_status: "SUSPENDED",
      monthly_fee_cents: 30000,
    });
    firestoreStore.set("locations/location-1/subscription_payments/payment-1", {
      amount_cents: 20000,
      period_key: "2026-07",
      review_status: "APPROVED",
      paid_at: new Date("2026-07-03T12:00:00.000Z"),
    });
    firestoreStore.set("locations/location-1/subscription_payments/payment-2", {
      amount_cents: 20000,
      period_key: "2026-06",
      review_status: "APPROVED",
      paid_at: new Date("2026-06-03T12:00:00.000Z"),
    });
    firestoreStore.set("locations/location-2/subscription_payments/payment-3", {
      amount_cents: 5000,
      period_key: "2026-07",
      review_status: "PENDING_REVIEW",
    });

    await expect(getAdminLocationBillingSummary({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {periodKey: "2026-07"},
    })).resolves.toMatchObject({
      periodKey: "2026-07",
      scannedLocations: 4,
      scanComplete: true,
      summary: {
        expectedMrrCents: 35000,
        receivedCents: 20000,
        overdueCents: 15000,
        trialCents: 9900,
        suspendedCents: 30000,
        activeLocations: 1,
        trialLocations: 1,
        overdueLocations: 1,
        suspendedLocations: 1,
        pendingReceiptLocations: 1,
      },
      locations: expect.arrayContaining([
        expect.objectContaining({
          id: "location-1",
          expectedCents: 20000,
          receivedCents: 20000,
          openBalanceCents: 0,
          lastPaymentAtIso: "2026-07-03T12:00:00.000Z",
        }),
        expect.objectContaining({
          id: "location-2",
          expectedCents: 15000,
          receivedCents: 0,
          openBalanceCents: 15000,
          pendingReceiptCount: 1,
        }),
      ]),
    });
  });

  it("processa ciclos de cobranca e muda status de forma idempotente", async () => {
    firestoreStore.delete("locations/location-1");
    firestoreStore.set("locations/paid", {
      name: "Arena Quitada",
      owner_id: "owner-paid",
      subscription_status: "OVERDUE",
      commercial_status: "OVERDUE",
      monthly_fee_cents: 10000,
      billing_due_day: 10,
    });
    firestoreStore.set("locations/paid/subscription_payments/payment-1", {
      amount_cents: 10000,
      period_key: "2026-07",
      review_status: "APPROVED",
    });
    firestoreStore.set("locations/overdue", {
      name: "Arena Vencida",
      owner_id: "owner-overdue",
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
      monthly_fee_cents: 20000,
      billing_due_day: 10,
    });
    firestoreStore.set("locations/suspended", {
      name: "Arena Suspensa",
      owner_id: "owner-suspended",
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
      monthly_fee_cents: 30000,
      billing_due_day: 1,
    });
    firestoreStore.set("locations/partial", {
      name: "Arena Parcial",
      owner_id: "owner-partial",
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
      monthly_fee_cents: 40000,
      billing_due_day: 25,
    });
    firestoreStore.set("locations/partial/subscription_payments/payment-2", {
      amount_cents: 15000,
      period_key: "2026-07",
      review_status: "APPROVED",
    });
    firestoreStore.set("locations/cancelled", {
      owner_id: "owner-cancelled",
      subscription_status: "CANCELLED",
      monthly_fee_cents: 10000,
      billing_due_day: 5,
    });
    firestoreStore.set("locations/future-trial", {
      owner_id: "owner-future",
      subscription_status: "TRIAL",
      monthly_fee_cents: 10000,
      billing_due_day: 5,
      billing_starts_at: new Date("2026-08-01T00:00:00.000Z"),
    });
    firestoreStore.set("locations/inconsistent", {
      owner_id: "owner-broken",
      subscription_status: "ACTIVE",
      billing_due_day: 5,
    });

    const result = await processLocationBillingAutomation({
      periodKey: "2026-07",
      now: new Date("2026-07-20T12:00:00.000Z"),
      actorUserId: "system-test",
    });

    expect(result).toMatchObject({
      processedLocations: 4,
      skippedLocations: 2,
      paidLocations: 1,
      partialLocations: 1,
      overdueLocations: 1,
      suspendedLocations: 1,
      reactivatedLocations: 1,
      inconsistentLocations: 1,
      ledgerEntriesCreated: 3,
    });
    expect(firestoreStore.get("locations/paid")).toMatchObject({
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
      current_billing_cycle_status: "PAID",
      current_billing_paid_cents: 10000,
      current_billing_open_balance_cents: 0,
    });
    expect(firestoreStore.get("locations/overdue")).toMatchObject({
      subscription_status: "OVERDUE",
      commercial_status: "OVERDUE",
      current_billing_cycle_status: "OVERDUE",
      current_billing_open_balance_cents: 20000,
    });
    expect(firestoreStore.get("locations/suspended")).toMatchObject({
      subscription_status: "SUSPENDED",
      commercial_status: "SUSPENDED",
      current_billing_cycle_status: "SUSPENDED",
      current_billing_open_balance_cents: 30000,
    });
    expect(firestoreStore.get("locations/partial")).toMatchObject({
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
      current_billing_cycle_status: "PARTIAL",
      current_billing_paid_cents: 15000,
      current_billing_open_balance_cents: 25000,
    });
    expect(collectionSize("locations/paid/subscription_cycles")).toBe(1);
    expect(collectionSize("locations/overdue/subscription_cycles")).toBe(1);
    expect(collectionSize("locations/suspended/subscription_cycles")).toBe(1);
    expect(collectionSize("locations/partial/subscription_cycles")).toBe(1);
    expect(collectionSize("locations/paid/subscription_ledger")).toBe(1);
    expect(collectionSize("locations/overdue/subscription_ledger")).toBe(1);
    expect(collectionSize("locations/suspended/subscription_ledger")).toBe(1);

    const secondRun = await processLocationBillingAutomation({
      periodKey: "2026-07",
      now: new Date("2026-07-20T12:00:00.000Z"),
      actorUserId: "system-test",
    });
    expect(secondRun.ledgerEntriesCreated).toBe(0);
    expect(collectionSize("locations/paid/subscription_ledger")).toBe(1);
    expect(collectionSize("locations/overdue/subscription_ledger")).toBe(1);
    expect(collectionSize("locations/suspended/subscription_ledger")).toBe(1);
  });

  it("permite disparo admin manual e registra handler agendado", async () => {
    firestoreStore.set("locations/location-1", {
      owner_id: "owner-1",
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
      monthly_fee_cents: 10000,
      billing_due_day: 1,
    });

    await expect(runLocationBillingAutomation({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {periodKey: "2026-06"},
    })).resolves.toMatchObject({
      periodKey: "2026-06",
      processedLocations: 1,
      suspendedLocations: 1,
    });
    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      subscription_status: "SUSPENDED",
      current_billing_cycle_status: "SUSPENDED",
    });
    expect(typeof processLocationBillingCycles).toBe("function");
  });

  it("rejeita automacao manual sem admin ou periodo invalido", async () => {
    await expect(runLocationBillingAutomation({
      data: {periodKey: "2026-07"},
    })).rejects.toMatchObject({code: "unauthenticated"});

    await expect(runLocationBillingAutomation({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {periodKey: "2026-13"},
    })).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("rejeita painel financeiro sem auth ou periodo invalido", async () => {
    await expect(getAdminLocationBillingSummary({
      data: {periodKey: "2026-07"},
    })).rejects.toMatchObject({code: "unauthenticated"});

    await expect(getAdminLocationBillingSummary({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {periodKey: "2026-13"},
    })).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("transfere owner como admin e remove novo owner da lista de managers", async () => {
    firestoreStore.set("users/owner-2", {
      name: "Novo dono",
      role: "FIELD_OWNER",
    });
    firestoreStore.set("locations/location-1", {
      ...firestoreStore.get("locations/location-1"),
      managers: ["owner-2", "manager-existing"],
    });

    await expect(assignLocationOwner({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        locationId: "location-1",
        newOwnerId: "owner-2",
        reason: "Contrato transferido",
      },
    })).resolves.toEqual({
      success: true,
      locationId: "location-1",
      ownerId: "owner-2",
      changed: true,
    });

    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      owner_id: "owner-2",
      managers: ["manager-existing"],
      updated_by: "admin-1",
    });
    expect(collectionSize("locations/location-1/commercial_events")).toBe(1);
    expect(collectionSize("audit_logs")).toBe(1);
  });

  it("rejeita transferencia de owner para usuario inexistente", async () => {
    await expect(assignLocationOwner({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {locationId: "location-1", newOwnerId: "missing"},
    })).rejects.toMatchObject({code: "not-found"});
  });

  it("nao altera owner quando o novo dono ja e o atual", async () => {
    firestoreStore.set("users/owner-1", {
      name: "Dono atual",
      role: "FIELD_OWNER",
    });

    await expect(assignLocationOwner({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {locationId: "location-1", newOwnerId: "owner-1"},
    })).resolves.toEqual({
      success: true,
      locationId: "location-1",
      ownerId: "owner-1",
      changed: false,
    });

    expect(collectionSize("locations/location-1/commercial_events")).toBe(0);
  });

  it("rejeita transferencia de owner sem auth", async () => {
    await expect(assignLocationOwner({
      data: {locationId: "location-1", newOwnerId: "owner-1"},
    })).rejects.toMatchObject({code: "unauthenticated"});
  });

  it("cria convite pendente de manager sem conceder acesso imediato", async () => {
    await expect(inviteLocationManager({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {
        locationId: "location-1",
        managerUid: "manager-2",
        managerEmail: "Manager2@Example.com",
        message: "Ajude a operar a quadra",
      },
    })).resolves.toMatchObject({
      success: true,
      locationId: "location-1",
      inviteId: expect.any(String),
      alreadyManager: false,
    });

    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      managers: ["manager-existing"],
    });
    const [, invite] = findFirstDoc("locations/location-1/manager_invites");
    expect(invite).toMatchObject({
      manager_uid: "manager-2",
      manager_email: "manager2@example.com",
      status: "PENDING",
      created_by: "owner-1",
    });
    expect(invite?.expires_at).toBeInstanceOf(Date);
    expect(collectionSize("locations/location-1/commercial_events")).toBe(1);
  });

  it("bloqueia convite de manager por usuario que nao e owner/admin", async () => {
    await expect(inviteLocationManager({
      auth: {uid: "manager-existing", token: {role: "FIELD_OWNER"}},
      data: {locationId: "location-1", managerUid: "manager-2"},
    })).rejects.toMatchObject({code: "permission-denied"});
  });

  it("cria convite somente por email e normaliza managerUid ausente", async () => {
    await expect(inviteLocationManager({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        locationId: "location-1",
        managerEmail: "Novo.Gerente@Example.com",
      },
    })).resolves.toMatchObject({
      success: true,
      alreadyManager: false,
    });

    const [, invite] = findFirstDoc("locations/location-1/manager_invites");
    expect(invite).toMatchObject({
      manager_uid: null,
      manager_email: "novo.gerente@example.com",
      message: null,
    });
  });

  it("rejeita convite sem destinatario, email invalido ou owner como manager", async () => {
    await expect(inviteLocationManager({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {locationId: "location-1"},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(inviteLocationManager({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {locationId: "location-1", managerEmail: "email-invalido"},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(inviteLocationManager({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {locationId: "location-1", managerUid: "owner-1"},
    })).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("retorna alreadyManager sem criar novo convite", async () => {
    await expect(inviteLocationManager({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {locationId: "location-1", managerUid: "manager-existing"},
    })).resolves.toEqual({
      success: true,
      locationId: "location-1",
      inviteId: null,
      alreadyManager: true,
    });

    expect(collectionSize("locations/location-1/manager_invites")).toBe(0);
  });

  it("rejeita convite de manager sem auth", async () => {
    await expect(inviteLocationManager({
      data: {locationId: "location-1", managerUid: "manager-2"},
    })).rejects.toMatchObject({code: "unauthenticated"});
  });

  it("aceita convite e adiciona manager somente para o destinatario correto", async () => {
    firestoreStore.set("locations/location-1/manager_invites/invite-1", {
      manager_uid: "manager-2",
      manager_email: "manager2@example.com",
      status: "PENDING",
    });

    await expect(acceptLocationManagerInvite({
      auth: {
        uid: "manager-2",
        token: {email: "manager2@example.com", role: "PLAYER"},
      },
      data: {locationId: "location-1", inviteId: "invite-1"},
    })).resolves.toEqual({
      success: true,
      locationId: "location-1",
      managerUid: "manager-2",
    });

    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      managers: ["manager-existing", "manager-2"],
      updated_by: "manager-2",
    });
    expect(firestoreStore.get("locations/location-1/manager_invites/invite-1"))
      .toMatchObject({
        status: "ACCEPTED",
        accepted_by: "manager-2",
      });
  });

  it("rejeita aceite de convite por outro usuario", async () => {
    firestoreStore.set("locations/location-1/manager_invites/invite-1", {
      manager_uid: "manager-2",
      manager_email: "manager2@example.com",
      status: "PENDING",
    });

    await expect(acceptLocationManagerInvite({
      auth: {
        uid: "attacker",
        token: {email: "attacker@example.com", role: "PLAYER"},
      },
      data: {locationId: "location-1", inviteId: "invite-1"},
    })).rejects.toMatchObject({code: "permission-denied"});
  });

  it("aceita convite quando apenas o email autenticado corresponde", async () => {
    firestoreStore.set("locations/location-1/manager_invites/invite-email", {
      manager_uid: null,
      manager_email: "manager-email@example.com",
      status: "PENDING",
    });

    await expect(acceptLocationManagerInvite({
      auth: {
        uid: "manager-email-uid",
        token: {email: "MANAGER-EMAIL@example.com", role: "PLAYER"},
      },
      data: {locationId: "location-1", inviteId: "invite-email"},
    })).resolves.toEqual({
      success: true,
      locationId: "location-1",
      managerUid: "manager-email-uid",
    });
  });

  it("rejeita aceite de convite ausente, nao pendente, owner ou sem auth", async () => {
    await expect(acceptLocationManagerInvite({
      data: {locationId: "location-1", inviteId: "invite-1"},
    })).rejects.toMatchObject({code: "unauthenticated"});

    await expect(acceptLocationManagerInvite({
      auth: {uid: "manager-2", token: {email: "manager2@example.com"}},
      data: {locationId: "location-1", inviteId: "missing"},
    })).rejects.toMatchObject({code: "not-found"});

    firestoreStore.set("locations/location-1/manager_invites/invite-used", {
      manager_uid: "manager-2",
      status: "ACCEPTED",
    });
    await expect(acceptLocationManagerInvite({
      auth: {uid: "manager-2", token: {email: "manager2@example.com"}},
      data: {locationId: "location-1", inviteId: "invite-used"},
    })).rejects.toMatchObject({code: "failed-precondition"});

    firestoreStore.set("locations/location-1/manager_invites/invite-owner", {
      manager_uid: "owner-1",
      status: "PENDING",
    });
    await expect(acceptLocationManagerInvite({
      auth: {uid: "owner-1", token: {email: "owner@example.com"}},
      data: {locationId: "location-1", inviteId: "invite-owner"},
    })).rejects.toMatchObject({code: "failed-precondition"});
  });

  it("remove manager como owner e registra auditoria", async () => {
    await expect(removeLocationManager({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {
        locationId: "location-1",
        managerUid: "manager-existing",
        reason: "Saiu da operacao",
      },
    })).resolves.toEqual({
      success: true,
      locationId: "location-1",
      managerUid: "manager-existing",
    });

    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      managers: [],
      updated_by: "owner-1",
    });
    expect(collectionSize("locations/location-1/commercial_events")).toBe(1);
    expect(collectionSize("audit_logs")).toBe(1);
  });

  it("rejeita remocao de manager sem auth ou tentando remover owner", async () => {
    await expect(removeLocationManager({
      data: {locationId: "location-1", managerUid: "manager-existing"},
    })).rejects.toMatchObject({code: "unauthenticated"});

    await expect(removeLocationManager({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {locationId: "location-1", managerUid: "owner-1"},
    })).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("suspende publicacao com motivo sem desativar historico comercial", async () => {
    await setLocationPublicationStatus({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        publicationStatus: "SUSPENDED",
        reason: "Mensalidade em atraso",
      },
    });

    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      publication_status: "SUSPENDED",
      is_verified: false,
      unpublished_reason: "Mensalidade em atraso",
    });
  });

  it("rejeita publicacao sem auth, enum invalido ou quadra inexistente", async () => {
    await expect(setLocationPublicationStatus({
      data: {locationId: "location-1", publicationStatus: "PUBLISHED"},
    })).rejects.toMatchObject({code: "unauthenticated"});

    await expect(setLocationPublicationStatus({
      auth: {uid: "admin-1"},
      data: {locationId: "location-1", publicationStatus: "PUBLIC"},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(setLocationPublicationStatus({
      auth: {uid: "admin-1"},
      data: {locationId: "missing", publicationStatus: "PUBLISHED"},
    })).rejects.toMatchObject({code: "not-found"});
  });

  it("atualiza assinatura, mensalidade e janela de cobranca", async () => {
    await expect(setLocationSubscription({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        subscriptionStatus: "ACTIVE",
        monthlyFeeCents: 12990,
        billingDueDay: 10,
        billingStartsAtIso: "2026-07-01T00:00:00.000Z",
        billingExpiresAtIso: "2026-07-31T23:59:59.000Z",
        adminNotes: "Plano fundador",
      },
    })).resolves.toEqual({
      success: true,
      locationId: "location-1",
      subscriptionStatus: "ACTIVE",
    });

    const location = firestoreStore.get("locations/location-1");
    expect(location).toMatchObject({
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
      monthly_fee_cents: 12990,
      billing_due_day: 10,
      admin_notes: "Plano fundador",
      updated_by: "admin-1",
    });
    expect(location?.billing_starts_at).toBeInstanceOf(Date);
    expect(location?.billing_expires_at).toBeInstanceOf(Date);
    expect(collectionSize("locations/location-1/commercial_events")).toBe(1);
    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "SUBSCRIPTION_STATUS_CHANGED",
      actor_user_id: "admin-1",
      previous_subscription_status: "TRIAL",
      previous_commercial_status: "TRIAL",
      next_subscription_status: "ACTIVE",
      next_commercial_status: "ACTIVE",
      monthly_fee_cents: 12990,
      billing_due_day: 10,
      reason: "Plano fundador",
    });
  });

  it("preserva status anterior no ledger ao alterar assinatura suspensa", async () => {
    firestoreStore.set("locations/location-1", {
      ...firestoreStore.get("locations/location-1"),
      subscription_status: "OVERDUE",
      commercial_status: "SUSPENDED",
    });

    await setLocationSubscription({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        subscriptionStatus: "CANCELLED",
        monthlyFeeCents: 0,
        billingDueDay: null,
        adminNotes: "Contrato encerrado",
      },
    });

    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "SUBSCRIPTION_STATUS_CHANGED",
      previous_subscription_status: "OVERDUE",
      next_subscription_status: "CANCELLED",
      previous_commercial_status: "SUSPENDED",
      next_commercial_status: "CANCELLED",
      monthly_fee_cents: 0,
      billing_due_day: null,
      reason: "Contrato encerrado",
    });
  });

  it("registra assinatura de quadra legada sem status anterior no ledger", async () => {
    firestoreStore.set("locations/location-1", {
      name: "Arena Parcas",
      owner_id: "owner-1",
      managers: [],
    });

    await setLocationSubscription({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        subscriptionStatus: "TRIAL",
      },
    });

    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "SUBSCRIPTION_STATUS_CHANGED",
      previous_subscription_status: null,
      next_subscription_status: "TRIAL",
      previous_commercial_status: null,
      next_commercial_status: "TRIAL",
    });
  });

  it("rejeita valores comerciais invalidos", async () => {
    await expect(setLocationSubscription({
      data: {locationId: "location-1", subscriptionStatus: "ACTIVE"},
    })).rejects.toMatchObject({code: "unauthenticated"});

    await expect(setLocationSubscription({
      auth: {uid: "admin-1"},
      data: {locationId: "location-1", subscriptionStatus: "PAID"},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(setLocationSubscription({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        subscriptionStatus: "ACTIVE",
        monthlyFeeCents: -1,
      },
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(setLocationSubscription({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        subscriptionStatus: "ACTIVE",
        billingDueDay: 32,
      },
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(setLocationSubscription({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        subscriptionStatus: "ACTIVE",
        billingStartsAtIso: 123,
      },
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(setLocationSubscription({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        subscriptionStatus: "ACTIVE",
        billingExpiresAtIso: "not-a-date",
      },
    })).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("aceita assinatura sem datas e normaliza observacoes vazias", async () => {
    await setLocationSubscription({
      auth: {uid: "admin-1"},
      data: {
        locationId: " location-1 ",
        subscriptionStatus: "OVERDUE",
        adminNotes: "   ",
      },
    });

    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      subscription_status: "OVERDUE",
      commercial_status: "OVERDUE",
      billing_starts_at: null,
      billing_expires_at: null,
      admin_notes: null,
    });
  });

  it("registra pagamento e reativa assinatura da quadra", async () => {
    await expect(registerLocationSubscriptionPayment({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        amountCents: 9900,
        periodKey: "2026-07",
        paidAtIso: "2026-07-05T12:00:00.000Z",
        method: "pix",
        receiptUrl: "https://example.com/recibo",
        notes: "Pago antecipado",
      },
    })).resolves.toMatchObject({
      success: true,
      locationId: "location-1",
      paymentId: expect.any(String),
      subscriptionStatus: "ACTIVE",
    });

    const location = firestoreStore.get("locations/location-1");
    expect(location).toMatchObject({
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
      last_payment_amount_cents: 9900,
      last_payment_period_key: "2026-07",
      updated_by: "admin-1",
    });
    expect(location?.last_payment_at).toBeInstanceOf(Date);
    expect(collectionSize("locations/location-1/subscription_payments")).toBe(1);
    expect(collectionSize("locations/location-1/subscription_ledger")).toBe(1);
    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "PAYMENT_REGISTERED",
      actor_user_id: "admin-1",
      amount_cents: 9900,
      period_key: "2026-07",
      review_status: "APPROVED",
      previous_subscription_status: "TRIAL",
      previous_commercial_status: "TRIAL",
      next_subscription_status: "ACTIVE",
      next_commercial_status: "ACTIVE",
      reason: "Pago antecipado",
    });
    expect(collectionSize("locations/location-1/commercial_events")).toBe(1);
    expect(collectionSize("audit_logs")).toBe(1);
  });

  it("registra pagamento com status comercial anterior no ledger", async () => {
    firestoreStore.set("locations/location-1", {
      ...firestoreStore.get("locations/location-1"),
      subscription_status: "OVERDUE",
      commercial_status: "SUSPENDED",
    });

    await registerLocationSubscriptionPayment({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        amountCents: 15000,
        periodKey: "2026-09",
        method: "boleto",
        notes: "Regularizado",
      },
    });

    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "PAYMENT_REGISTERED",
      amount_cents: 15000,
      period_key: "2026-09",
      method: "boleto",
      previous_subscription_status: "OVERDUE",
      next_subscription_status: "ACTIVE",
      previous_commercial_status: "SUSPENDED",
      next_commercial_status: "ACTIVE",
      reason: "Regularizado",
    });
  });

  it("registra pagamento de quadra legada sem status anterior no ledger", async () => {
    firestoreStore.set("locations/location-1", {
      name: "Arena Parcas",
      owner_id: "owner-1",
      managers: [],
    });

    await registerLocationSubscriptionPayment({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        amountCents: 15000,
        periodKey: "2026-10",
      },
    });

    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "PAYMENT_REGISTERED",
      previous_subscription_status: null,
      next_subscription_status: "ACTIVE",
      previous_commercial_status: null,
      next_commercial_status: "ACTIVE",
    });
  });

  it("rejeita pagamento sem auth, periodo, valor ou data valida", async () => {
    await expect(registerLocationSubscriptionPayment({
      data: {locationId: "location-1", amountCents: 9900, periodKey: "2026-07"},
    })).rejects.toMatchObject({code: "unauthenticated"});

    await expect(registerLocationSubscriptionPayment({
      auth: {uid: "admin-1"},
      data: {locationId: "location-1", amountCents: 9900, periodKey: " "},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(registerLocationSubscriptionPayment({
      auth: {uid: "admin-1"},
      data: {locationId: "location-1", amountCents: 9900, periodKey: "2026-13"},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(registerLocationSubscriptionPayment({
      auth: {uid: "admin-1"},
      data: {locationId: "location-1", amountCents: 0, periodKey: "2026-07"},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(registerLocationSubscriptionPayment({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        amountCents: 9900,
        periodKey: "2026-07",
        paidAtIso: "nope",
      },
    })).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("registra pagamento com data atual e opcionais vazios", async () => {
    await registerLocationSubscriptionPayment({
      auth: {uid: "admin-1"},
      data: {
        locationId: "location-1",
        amountCents: 9900,
        periodKey: "2026-08",
        method: 10,
        receiptUrl: "   ",
        notes: "",
      },
    });

    const [paymentPath, payment] = Array.from(firestoreStore.entries())
      .find(([path]) => path.startsWith(
        "locations/location-1/subscription_payments/"
      )) || [];
    expect(paymentPath).toEqual(expect.any(String));
    expect(payment).toMatchObject({
      amount_cents: 9900,
      period_key: "2026-08",
      method: null,
      receipt_url: null,
      notes: null,
    });
  });

  it("owner envia comprovante privado sem ativar assinatura automaticamente", async () => {
    await expect(submitLocationSubscriptionReceipt({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {
        locationId: "location-1",
        amountCents: 12990,
        periodKey: "2026-07",
        paidAtIso: "2026-07-08T12:00:00.000Z",
        method: "pix",
        receiptStoragePath:
          "locations/location-1/subscription_receipts/owner-1/2026-07.pdf",
        notes: "Enviado pelo dono",
      },
    })).resolves.toMatchObject({
      success: true,
      locationId: "location-1",
      paymentId: expect.any(String),
      reviewStatus: "PENDING_REVIEW",
    });

    const location = firestoreStore.get("locations/location-1");
    expect(location).toMatchObject({
      subscription_status: "TRIAL",
      commercial_status: "TRIAL",
    });
    const [, payment] = findFirstDoc("locations/location-1/subscription_payments");
    expect(payment).toMatchObject({
      amount_cents: 12990,
      period_key: "2026-07",
      receipt_storage_path:
        "locations/location-1/subscription_receipts/owner-1/2026-07.pdf",
      receipt_url: null,
      status: "PENDING_REVIEW",
      review_status: "PENDING_REVIEW",
      submitted_by: "owner-1",
    });
    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "PAYMENT_RECEIPT_SUBMITTED",
      actor_user_id: "owner-1",
      amount_cents: 12990,
      period_key: "2026-07",
      review_status: "PENDING_REVIEW",
      previous_subscription_status: "TRIAL",
      next_subscription_status: "TRIAL",
      previous_commercial_status: "TRIAL",
      next_commercial_status: "TRIAL",
      reason: "Enviado pelo dono",
    });
    expect(collectionSize("locations/location-1/commercial_events")).toBe(1);
    expect(collectionSize("audit_logs")).toBe(1);
  });

  it("envio de comprovante mantem assinatura ativa no ledger sem reativar nada", async () => {
    firestoreStore.set("locations/location-1", {
      ...firestoreStore.get("locations/location-1"),
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
    });

    await submitLocationSubscriptionReceipt({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {
        locationId: "location-1",
        amountCents: 12990,
        periodKey: "2026-08",
        receiptStoragePath:
          "locations/location-1/subscription_receipts/owner-1/2026-08.pdf",
      },
    });

    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "PAYMENT_RECEIPT_SUBMITTED",
      previous_subscription_status: "ACTIVE",
      next_subscription_status: "ACTIVE",
      previous_commercial_status: "ACTIVE",
      next_commercial_status: "ACTIVE",
      review_status: "PENDING_REVIEW",
    });
  });

  it("envio de comprovante de quadra legada mantem status nulo no ledger", async () => {
    firestoreStore.set("locations/location-1", {
      name: "Arena Parcas",
      owner_id: "owner-1",
      managers: [],
    });

    await submitLocationSubscriptionReceipt({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {
        locationId: "location-1",
        amountCents: 12990,
        periodKey: "2026-09",
        receiptStoragePath:
          "locations/location-1/subscription_receipts/owner-1/2026-09.pdf",
      },
    });

    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "PAYMENT_RECEIPT_SUBMITTED",
      previous_subscription_status: null,
      next_subscription_status: null,
      previous_commercial_status: null,
      next_commercial_status: null,
    });
  });

  it("bloqueia comprovante de manager, path fora do owner e valores invalidos", async () => {
    await expect(submitLocationSubscriptionReceipt({
      data: {
        locationId: "location-1",
        amountCents: 12990,
        periodKey: "2026-07",
        receiptStoragePath:
          "locations/location-1/subscription_receipts/owner-1/2026-07.pdf",
      },
    })).rejects.toMatchObject({code: "unauthenticated"});

    await expect(submitLocationSubscriptionReceipt({
      auth: {uid: "manager-existing", token: {role: "FIELD_OWNER"}},
      data: {
        locationId: "location-1",
        amountCents: 12990,
        periodKey: "2026-07",
        receiptStoragePath:
          "locations/location-1/subscription_receipts/owner-1/2026-07.pdf",
      },
    })).rejects.toMatchObject({code: "permission-denied"});

    await expect(submitLocationSubscriptionReceipt({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {
        locationId: "location-1",
        amountCents: 0,
        periodKey: "2026-07",
        receiptStoragePath:
          "locations/location-1/subscription_receipts/owner-1/2026-07.pdf",
      },
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(submitLocationSubscriptionReceipt({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {
        locationId: "location-1",
        amountCents: 12990,
        periodKey: "2026-07",
        receiptStoragePath:
          "locations/location-1/subscription_receipts/other-owner/2026-07.pdf",
      },
    })).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("admin aprova comprovante pendente e ativa assinatura", async () => {
    firestoreStore.set("locations/location-1/subscription_payments/payment-1", {
      amount_cents: 12990,
      period_key: "2026-07",
      paid_at: new Date("2026-07-08T12:00:00.000Z"),
      receipt_storage_path:
        "locations/location-1/subscription_receipts/owner-1/2026-07.pdf",
      status: "PENDING_REVIEW",
      review_status: "PENDING_REVIEW",
      submitted_by: "owner-1",
    });

    await expect(reviewLocationSubscriptionReceipt({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        locationId: "location-1",
        paymentId: "payment-1",
        decision: "APPROVED",
        notes: "Conferido no banco",
      },
    })).resolves.toEqual({
      success: true,
      locationId: "location-1",
      paymentId: "payment-1",
      reviewStatus: "APPROVED",
      subscriptionStatus: "ACTIVE",
    });

    expect(firestoreStore.get("locations/location-1/subscription_payments/payment-1"))
      .toMatchObject({
        status: "APPROVED",
        review_status: "APPROVED",
        reviewed_by: "admin-1",
        review_notes: "Conferido no banco",
      });
    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
      last_payment_amount_cents: 12990,
      last_payment_period_key: "2026-07",
      last_payment_id: "payment-1",
      updated_by: "admin-1",
    });
    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "PAYMENT_RECEIPT_APPROVED",
      actor_user_id: "admin-1",
      amount_cents: 12990,
      period_key: "2026-07",
      payment_id: "payment-1",
      review_status: "APPROVED",
      previous_subscription_status: "TRIAL",
      next_subscription_status: "ACTIVE",
      previous_commercial_status: "TRIAL",
      next_commercial_status: "ACTIVE",
      reason: "Conferido no banco",
    });
    expect(collectionSize("locations/location-1/commercial_events")).toBe(1);
  });

  it("aprova comprovante atrasado e registra metodo e status anterior no ledger", async () => {
    firestoreStore.set("locations/location-1", {
      ...firestoreStore.get("locations/location-1"),
      subscription_status: "OVERDUE",
      commercial_status: "SUSPENDED",
    });
    firestoreStore.set("locations/location-1/subscription_payments/payment-1", {
      amount_cents: 15990,
      period_key: "2026-08",
      method: "pix",
      paid_at: new Date("2026-08-08T12:00:00.000Z"),
      receipt_storage_path:
        "locations/location-1/subscription_receipts/owner-1/2026-08.pdf",
      status: "PENDING_REVIEW",
      review_status: "PENDING_REVIEW",
    });

    await reviewLocationSubscriptionReceipt({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        locationId: "location-1",
        paymentId: "payment-1",
        decision: "APPROVED",
      },
    });

    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "PAYMENT_RECEIPT_APPROVED",
      amount_cents: 15990,
      period_key: "2026-08",
      method: "pix",
      previous_subscription_status: "OVERDUE",
      next_subscription_status: "ACTIVE",
      previous_commercial_status: "SUSPENDED",
      next_commercial_status: "ACTIVE",
    });
  });

  it("admin rejeita comprovante pendente sem alterar assinatura", async () => {
    firestoreStore.set("locations/location-1/subscription_payments/payment-1", {
      amount_cents: 12990,
      period_key: "2026-07",
      receipt_storage_path:
        "locations/location-1/subscription_receipts/owner-1/2026-07.pdf",
      status: "PENDING_REVIEW",
      review_status: "PENDING_REVIEW",
    });

    await expect(reviewLocationSubscriptionReceipt({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        locationId: "location-1",
        paymentId: "payment-1",
        decision: "REJECTED",
        notes: "Valor divergente",
      },
    })).resolves.toMatchObject({
      reviewStatus: "REJECTED",
      subscriptionStatus: "TRIAL",
    });

    expect(firestoreStore.get("locations/location-1/subscription_payments/payment-1"))
      .toMatchObject({
        status: "REJECTED",
        review_status: "REJECTED",
        review_notes: "Valor divergente",
      });
    expect(firestoreStore.get("locations/location-1")).toMatchObject({
      subscription_status: "TRIAL",
      commercial_status: "TRIAL",
    });
    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "PAYMENT_RECEIPT_REJECTED",
      actor_user_id: "admin-1",
      amount_cents: 12990,
      period_key: "2026-07",
      payment_id: "payment-1",
      review_status: "REJECTED",
      previous_subscription_status: "TRIAL",
      next_subscription_status: "TRIAL",
      previous_commercial_status: "TRIAL",
      next_commercial_status: "TRIAL",
      reason: "Valor divergente",
    });
  });

  it("rejeita comprovante legado malformado sem fabricar dados no ledger", async () => {
    firestoreStore.set("locations/location-1", {
      ...firestoreStore.get("locations/location-1"),
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
    });
    firestoreStore.set("locations/location-1/subscription_payments/payment-1", {
      amount_cents: "15990",
      period_key: 202608,
      method: 42,
      receipt_storage_path:
        "locations/location-1/subscription_receipts/owner-1/legacy.pdf",
      status: "PENDING_REVIEW",
      review_status: "PENDING_REVIEW",
    });

    await reviewLocationSubscriptionReceipt({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        locationId: "location-1",
        paymentId: "payment-1",
        decision: "REJECTED",
      },
    });

    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "PAYMENT_RECEIPT_REJECTED",
      amount_cents: null,
      period_key: null,
      method: null,
      previous_subscription_status: "ACTIVE",
      next_subscription_status: "ACTIVE",
      previous_commercial_status: "ACTIVE",
      next_commercial_status: "ACTIVE",
      effective_at: {_type: "ServerTimestamp"},
    });
  });

  it("rejeita comprovante de quadra legada sem fabricar status no ledger", async () => {
    firestoreStore.set("locations/location-1", {
      name: "Arena Parcas",
      owner_id: "owner-1",
      managers: [],
    });
    firestoreStore.set("locations/location-1/subscription_payments/payment-1", {
      amount_cents: 12990,
      period_key: "2026-09",
      receipt_storage_path:
        "locations/location-1/subscription_receipts/owner-1/2026-09.pdf",
      status: "PENDING_REVIEW",
      review_status: "PENDING_REVIEW",
    });

    await reviewLocationSubscriptionReceipt({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        locationId: "location-1",
        paymentId: "payment-1",
        decision: "REJECTED",
      },
    });

    const [, ledger] = findFirstDoc("locations/location-1/subscription_ledger");
    expect(ledger).toMatchObject({
      type: "PAYMENT_RECEIPT_REJECTED",
      previous_subscription_status: null,
      next_subscription_status: null,
      previous_commercial_status: null,
      next_commercial_status: null,
    });
  });

  it("bloqueia revisao sem admin, pagamento ausente ou nao pendente", async () => {
    await expect(reviewLocationSubscriptionReceipt({
      data: {
        locationId: "location-1",
        paymentId: "payment-1",
        decision: "APPROVED",
      },
    })).rejects.toMatchObject({code: "unauthenticated"});

    await expect(reviewLocationSubscriptionReceipt({
      auth: {uid: "owner-1", token: {role: "FIELD_OWNER"}},
      data: {
        locationId: "location-1",
        paymentId: "payment-1",
        decision: "APPROVED",
      },
    })).rejects.toMatchObject({code: "permission-denied"});

    await expect(reviewLocationSubscriptionReceipt({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        locationId: "location-1",
        paymentId: "missing",
        decision: "APPROVED",
      },
    })).rejects.toMatchObject({code: "not-found"});

    firestoreStore.set("locations/location-1/subscription_payments/payment-1", {
      receipt_storage_path:
        "locations/location-1/subscription_receipts/owner-1/2026-07.pdf",
      status: "APPROVED",
      review_status: "APPROVED",
    });
    await expect(reviewLocationSubscriptionReceipt({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {
        locationId: "location-1",
        paymentId: "payment-1",
        decision: "REJECTED",
      },
    })).rejects.toMatchObject({code: "failed-precondition"});
  });
});

function resetFirestore() {
  jest.clearAllMocks();
  firestoreStore.clear();
  batchInstances.length = 0;
  autoId = 1;
}

function seedSubcollection(path: string, count: number) {
  for (let index = 0; index < count; index += 1) {
    firestoreStore.set(`${path}/doc-${index}`, {index});
  }
}

function collectionSize(path: string) {
  const prefix = `${path}/`;
  return Array.from(firestoreStore.keys())
    .filter((docPath) => docPath.startsWith(prefix))
    .filter((docPath) => !docPath.slice(prefix.length).includes("/"))
    .length;
}

function findFirstDoc(path: string) {
  const prefix = `${path}/`;
  return Array.from(firestoreStore.entries())
    .find(([docPath]) =>
      docPath.startsWith(prefix) && !docPath.slice(prefix.length).includes("/")
    ) || [];
}

function totalDeleteCalls() {
  return batchInstances.reduce(
    (total, batch) => total + batch.delete.mock.calls.length,
    0
  );
}
