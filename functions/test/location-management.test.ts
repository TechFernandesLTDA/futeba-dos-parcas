/**
 * REGRESSAO #1684 — deleteLocation cascade paginado.
 *
 * Tambem cobre os controles comerciais de quadras monetizadas para manter
 * publicacao, mensalidade e pagamentos protegidos por callable admin.
 */

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

  async update(data: StoredDoc) {
    const current = this.store.get(this.path) || {};
    this.store.set(this.path, {...current, ...data});
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
    private readonly limitSize?: number
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
    return new FakeCollectionRef(this.path, this.store, size);
  }

  async get() {
    const prefix = `${this.path}/`;
    const docs = Array.from(this.store.keys())
      .filter((path) => path.startsWith(prefix))
      .filter((path) => !path.slice(prefix.length).includes("/"))
      .slice(0, this.limitSize)
      .map((path) => ({
        ref: new FakeDocRef(path, path.split("/").pop() || "", this.store),
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
  deleteLocationSubcollection,
  registerLocationSubscriptionPayment,
  setLocationPublicationStatus,
  setLocationSubscription,
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

  it("expõe contexto de auditoria para publicação, assinatura e pagamento", async () => {
    const publicationOptions = mockSecureCallableOptions[1];
    const subscriptionOptions = mockSecureCallableOptions[2];
    const paymentOptions = mockSecureCallableOptions[3];

    await expect(publicationOptions.auditLogContext({
      data: {locationId: "location-1", publicationStatus: "PUBLISHED"},
    })).resolves.toEqual({
      function: "setLocationPublicationStatus",
      locationId: "location-1",
      publicationStatus: "PUBLISHED",
    });
    await expect(subscriptionOptions.auditLogContext({
      data: {locationId: "location-1", subscriptionStatus: "OVERDUE"},
    })).resolves.toEqual({
      function: "setLocationSubscription",
      locationId: "location-1",
      subscriptionStatus: "OVERDUE",
    });
    await expect(paymentOptions.auditLogContext({
      data: {locationId: "location-1", periodKey: "2026-07"},
    })).resolves.toEqual({
      function: "registerLocationSubscriptionPayment",
      locationId: "location-1",
      periodKey: "2026-07",
    });
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
    expect(collectionSize("locations/location-1/commercial_events")).toBe(1);
    expect(collectionSize("audit_logs")).toBe(1);
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

function totalDeleteCalls() {
  return batchInstances.reduce(
    (total, batch) => total + batch.delete.mock.calls.length,
    0
  );
}
