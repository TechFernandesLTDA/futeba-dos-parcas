process.env.FUNCTIONS_EMULATOR = "true";

type FakeDoc = {
  id: string;
  data: () => Record<string, unknown>;
};

const mockUsersGet = jest.fn();
const mockLocationsGet = jest.fn();
const mockOnboardingGet = jest.fn();
const mockVenueAccountsGet = jest.fn();
const mockSecureCallable = jest.fn((_options, handler) => handler);

function queryRef(get: jest.Mock) {
  return {
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get,
  };
}

jest.mock("../src/_db", () => ({
  db: () => ({
    collection: (name: string) => {
      if (name === "users") return queryRef(mockUsersGet);
      if (name === "locations") return queryRef(mockLocationsGet);
      if (name === "venue_owner_onboarding") return queryRef(mockOnboardingGet);
      if (name === "venue_accounts") return queryRef(mockVenueAccountsGet);
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
}));

jest.mock("../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: (...args: unknown[]) => mockSecureCallable(...args),
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

function userDoc(id: string, data: Record<string, unknown>): FakeDoc {
  return {id, data: () => data};
}

function timestamp(date: string) {
  return {toDate: () => new Date(date)};
}

describe("searchAdminUsers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVenueAccountsGet.mockResolvedValue({docs: []});
  });

  it("busca usuario alem dos 50 primeiros e agrega resumo comercial", async () => {
    const users = Array.from({length: 55}, (_, index) => userDoc(`user-${index}`, {
      name: `Jogador ${index}`,
      email: `jogador${index}@test.com`,
      role: "PLAYER",
      created_at: timestamp("2026-01-01T00:00:00.000Z"),
    }));
    users.push(userDoc("owner-old", {
      name: "Dono Antigo",
      email: "dono.antigo@test.com",
      role: "FIELD_OWNER",
      games_played: 7,
      level: 3,
      created_at: timestamp("2025-01-01T00:00:00.000Z"),
      updated_at: timestamp("2026-06-27T10:15:00.000Z"),
      last_login_at: timestamp("2026-06-28T12:30:00.000Z"),
    }));

    mockUsersGet.mockResolvedValue({docs: users});
    mockLocationsGet.mockResolvedValue({
      docs: [
        userDoc("loc-1", {
          owner_id: "owner-old",
          publication_status: "PUBLISHED",
          subscription_status: "OVERDUE",
          monthly_fee_cents: 12000,
          billing_due_day: 10,
        }),
        userDoc("loc-2", {
          owner_id: "owner-old",
          publication_status: "PENDING_REVIEW",
          subscription_status: "TRIAL",
        }),
      ],
    });
    mockOnboardingGet.mockResolvedValue({
      docs: [
        userDoc("owner-old", {
          status: "IN_REVIEW",
          contact_name: "Dono Antigo",
          contact_email: "dono.antigo@test.com",
          business_name: "Arena Antiga",
          notes: "Quero publicar a quadra principal.",
        }),
      ],
    });
    mockVenueAccountsGet.mockResolvedValue({
      docs: [
        userDoc("owner-old", {
          status: "ACTIVE",
          billing_scope: "OWNER",
          billing_plan_code: "PRO",
          billing_plan_label: "Pro Dono",
          billing_cycle: "MONTHLY",
          billing_base_fee_cents: 18900,
          billing_due_day: 10,
          billing_contact_name: "Financeiro Arena",
          billing_contact_email: "financeiro@arenaantiga.com",
          linked_location_ids: ["loc-1", "loc-2"],
          updated_at: timestamp("2026-06-28T08:00:00.000Z"),
        }),
      ],
    });

    let searchAdminUsers: (request: unknown) => Promise<unknown>;
    jest.isolateModules(() => {
      searchAdminUsers = require("../src/admin/user-crm").searchAdminUsers;
    });

    const result = await searchAdminUsers!({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {search: "antigo", role: "ALL", ownerFilter: "ALL", pageSize: 10},
    }) as {
      users: Array<{
        id: string;
        updatedAtIso: string | null;
        lastLoginAtIso: string | null;
        ownerSummary: {
          totalLocations: number;
          overdueLocations: number;
          incompleteLocations: number;
          monthlyFeeTotalCents: number;
          managersTotal: number;
        };
        ownerLocations: Array<{
          id: string;
          name: string;
          monthlyFeeCents: number | null;
          managersCount: number;
        }>;
        ownerOnboarding: {
          status: string;
          businessName: string | null;
        } | null;
        venueAccount: {
          status: string;
          billingScope: string;
          billingPlanLabel: string | null;
          computedMonthlyFeeCents: number;
          linkedLocationsCount: number;
        } | null;
      }>;
      totalMatched: number;
    };

    expect(result.totalMatched).toBe(1);
    expect(result.users[0].id).toBe("owner-old");
    expect(result.users[0].updatedAtIso).toBe("2026-06-27T10:15:00.000Z");
    expect(result.users[0].lastLoginAtIso).toBe("2026-06-28T12:30:00.000Z");
    expect(result.users[0].ownerSummary).toMatchObject({
      totalLocations: 2,
      overdueLocations: 1,
      incompleteLocations: 1,
      monthlyFeeTotalCents: 18900,
      managersTotal: 0,
    });
    expect(result.users[0].ownerLocations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "loc-1",
        name: "Quadra sem nome",
        monthlyFeeCents: 12000,
        managersCount: 0,
      }),
    ]));
    expect(result.users[0].ownerOnboarding).toMatchObject({
      status: "IN_REVIEW",
      businessName: "Arena Antiga",
    });
    expect(result.users[0].venueAccount).toMatchObject({
      status: "ACTIVE",
      billingScope: "OWNER",
      billingPlanLabel: "Pro Dono",
      computedMonthlyFeeCents: 18900,
      linkedLocationsCount: 2,
    });
  });

  it("registra callable admin-only com rate limit dedicado", () => {
    jest.isolateModules(() => {
      require("../src/admin/user-crm");
    });

    expect(mockSecureCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        appCheck: false,
        consumeAppCheckToken: false,
        requireAuth: true,
        requiredRole: "ADMIN",
        rateLimit: expect.objectContaining({keyPrefix: "adminUserCrm"}),
      }),
      expect.any(Function)
    );
  });

  it("normaliza onboarding comercial legado com aliases camelCase", async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc("owner-legacy", {
          name: "Dono Legacy",
          email: "legacy@test.com",
          role: "PLAYER",
          created_at: timestamp("2026-01-01T00:00:00.000Z"),
        }),
      ],
    });
    mockLocationsGet.mockResolvedValue({docs: []});
    mockOnboardingGet.mockResolvedValue({
      docs: [
        userDoc("owner-legacy", {
          submittedAt: timestamp("2026-02-01T00:00:00.000Z"),
          reviewedAt: timestamp("2026-02-02T00:00:00.000Z"),
          contactName: "Responsavel Legacy",
          contactEmail: "responsavel@test.com",
          businessName: "Arena Legacy",
          notes: "Migrado de formato antigo",
          reviewReason: "Aguardando documentos",
        }),
      ],
    });
    mockVenueAccountsGet.mockResolvedValue({docs: []});

    let searchAdminUsers: (request: unknown) => Promise<unknown>;
    jest.isolateModules(() => {
      searchAdminUsers = require("../src/admin/user-crm").searchAdminUsers;
    });

    const result = await searchAdminUsers!({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {search: "legacy", role: "ALL", ownerFilter: "ALL", pageSize: 10},
    }) as {
      users: Array<{
        ownerOnboarding: {
          status: string;
          contactName: string | null;
          contactEmail: string | null;
          businessName: string | null;
          notes: string | null;
          reviewReason: string | null;
          submittedAtIso: string | null;
          reviewedAtIso: string | null;
        } | null;
      }>;
    };

    expect(result.users[0].ownerOnboarding).toMatchObject({
      status: "LEAD",
      contactName: "Responsavel Legacy",
      contactEmail: "responsavel@test.com",
      businessName: "Arena Legacy",
      notes: "Migrado de formato antigo",
      reviewReason: "Aguardando documentos",
      submittedAtIso: "2026-02-01T00:00:00.000Z",
      reviewedAtIso: "2026-02-02T00:00:00.000Z",
    });
  });

  it("permite buscar por campos da conta comercial agregada", async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc("owner-commercial", {
          name: "Arena Comercial",
          email: "owner@test.com",
          role: "FIELD_OWNER",
          created_at: timestamp("2026-01-01T00:00:00.000Z"),
        }),
      ],
    });
    mockLocationsGet.mockResolvedValue({
      docs: [
        userDoc("loc-commercial", {
          owner_id: "owner-commercial",
          publication_status: "PUBLISHED",
          subscription_status: "ACTIVE",
          monthly_fee_cents: 9000,
          field_count: 2,
        }),
      ],
    });
    mockOnboardingGet.mockResolvedValue({docs: []});
    mockVenueAccountsGet.mockResolvedValue({
      docs: [
        userDoc("owner-commercial", {
          status: "OVERDUE",
          billing_scope: "FIELD_COUNT",
          billing_plan_code: "CUSTOM",
          billing_plan_label: "Plano Premium Custom",
          price_per_active_field_cents: 5000,
          linked_location_ids: ["loc-commercial"],
        }),
      ],
    });

    let searchAdminUsers: (request: unknown) => Promise<unknown>;
    jest.isolateModules(() => {
      searchAdminUsers = require("../src/admin/user-crm").searchAdminUsers;
    });

    const result = await searchAdminUsers!({
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {search: "premium custom", role: "ALL", ownerFilter: "ALL", pageSize: 10},
    }) as {
      totalMatched: number;
      users: Array<{
        id: string;
        venueAccount: {
          status: string;
          computedMonthlyFeeCents: number;
        } | null;
      }>;
    };

    expect(result.totalMatched).toBe(1);
    expect(result.users[0]).toMatchObject({
      id: "owner-commercial",
      venueAccount: {
        status: "OVERDUE",
        computedMonthlyFeeCents: 10000,
      },
    });
  });
});
