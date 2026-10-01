jest.mock("firebase-admin", () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: jest.fn(),
    batch: jest.fn(),
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  buildChangedVenueAccountUpdates,
  buildLocationUpdates,
  buildVenueAccountDocument,
  cents,
  hasVenueAccountFixes,
} = require("../src/scripts/backfill-venue-commercial-data");

describe("backfill-venue-commercial-data", () => {
  it("preserva zero como valor valido em centavos", () => {
    expect(cents(0)).toBe(0);
    expect(cents(1500)).toBe(1500);
    expect(cents(-1)).toBe(0);
    expect(cents("1500")).toBe(0);
  });

  it("nao marca conta agregada como alterada quando snapshot ja esta alinhado", () => {
    const existing = {
      owner_uid: "owner-1",
      status: "ACTIVE",
      billing_scope: "LOCATION",
      billing_plan_code: "BASIC",
      billing_plan_label: "Fundador",
      billing_cycle: "MONTHLY",
      default_location_fee_cents: 9000,
      linked_location_ids: ["location-1"],
      linked_locations_count: 1,
      published_locations_count: 1,
      active_fields_count: 2,
      legacy_monthly_fee_total_cents: 9000,
      computed_monthly_fee_cents: 9000,
      created_at: {_type: "CreatedAt"},
      updated_at: {_type: "OldUpdatedAt"},
      backfill_source: "previous-run",
    };
    const candidate = buildVenueAccountDocument({
      ownerId: "owner-1",
      existing,
      locations: [{
        subscription_status: "ACTIVE",
        publication_status: "PUBLISHED",
        field_count: 2,
        has_active_fields: true,
        monthly_fee_cents: 9000,
      }],
      locationIds: ["location-1"],
    });

    const updates = buildChangedVenueAccountUpdates(existing, candidate);

    expect(updates).toEqual({});
    expect(hasVenueAccountFixes({
      ownerId: "owner-1",
      locationIds: ["location-1"],
      accountUpdates: updates,
      locationUpdates: [],
      manualReview: [],
    })).toBe(false);
  });

  it("inclui auditoria somente quando a conta agregada precisa mudar", () => {
    const existing = {
      owner_uid: "owner-1",
      status: "TRIAL",
      billing_scope: "LOCATION",
      linked_location_ids: ["location-1"],
      linked_locations_count: 1,
      published_locations_count: 1,
      active_fields_count: 1,
      legacy_monthly_fee_total_cents: 0,
      computed_monthly_fee_cents: 0,
      created_at: {_type: "CreatedAt"},
    };
    const candidate = buildVenueAccountDocument({
      ownerId: "owner-1",
      existing,
      locations: [{
        subscription_status: "ACTIVE",
        publication_status: "PUBLISHED",
        field_count: 2,
        has_active_fields: true,
        monthly_fee_cents: 0,
      }],
      locationIds: ["location-1"],
    });

    const updates = buildChangedVenueAccountUpdates(existing, candidate);

    expect(updates).toMatchObject({
      active_fields_count: 2,
      backfill_source: "backfill-venue-commercial-data",
    });
    expect(updates.updated_at).toEqual({_type: "ServerTimestamp"});
  });

  it("#4111: subscription_status invalido e billing_due_day ausente entram na revisao manual", () => {
    const {updates, manualReview} = buildLocationUpdates({
      data: {
        owner_id: "owner-1",
        publication_status: "PUBLISHED",
        subscription_status: "PAUSED",
        monthly_fee_cents: 9000,
        address: "Rua A, 1",
        photos: ["a.jpg"],
      },
      fieldCount: 1,
      activeFieldCount: 1,
      fieldType: "SOCIETY",
    });

    expect(updates).toMatchObject({
      subscription_status: "TRIAL",
      commercial_status: "TRIAL",
      trial_started_at: {_type: "ServerTimestamp"},
      billing_due_day: null,
    });
    expect(manualReview).toEqual(expect.arrayContaining([
      "subscription_status invalid/missing, defaulted to TRIAL",
      "billing_due_day undefined",
    ]));
  });

  it("#4111: TRIAL valido sem relogio ganha trial_started_at; status valido nao gera revisao", () => {
    const {updates, manualReview} = buildLocationUpdates({
      data: {
        owner_id: "owner-1",
        publication_status: "PUBLISHED",
        subscription_status: "TRIAL",
        commercial_status: "TRIAL",
        monthly_fee_cents: 9000,
        billing_due_day: 10,
        address: "Rua A, 1",
        photos: ["a.jpg"],
      },
      fieldCount: 1,
      activeFieldCount: 1,
      fieldType: "SOCIETY",
    });

    expect(updates).toMatchObject({trial_started_at: {_type: "ServerTimestamp"}});
    expect(updates).not.toHaveProperty("subscription_status");
    expect(manualReview).not.toEqual(expect.arrayContaining([
      expect.stringContaining("subscription_status"),
    ]));
    expect(manualReview).not.toContain("billing_due_day undefined");
  });
});
