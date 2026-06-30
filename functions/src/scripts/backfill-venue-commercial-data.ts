/* eslint-disable require-jsdoc */
/**
 * Conservative venue commercial backfill for issue #3131.
 *
 * Dry-run is the default. Execute mode only fills safe defaults and field
 * summaries; it never publishes a venue automatically.
 *
 * Usage:
 *   cd functions
 *   npx ts-node src/scripts/backfill-venue-commercial-data.ts
 *   npx ts-node src/scripts/backfill-venue-commercial-data.ts --execute
 */

import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import "../types/firestore-count";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const SOURCE = "backfill-venue-commercial-data";
const FIELD_TYPES = new Set(["SOCIETY", "FUTSAL", "CAMPO", "AREIA", "OUTROS"]);
const PUBLICATION_STATUSES = new Set([
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "SUSPENDED",
  "REJECTED",
]);
const SUBSCRIPTION_STATUSES = new Set([
  "TRIAL",
  "ACTIVE",
  "OVERDUE",
  "SUSPENDED",
  "CANCELLED",
]);
const VENUE_ACCOUNT_SCOPES = new Set([
  "OWNER",
  "LOCATION",
  "FIELD_COUNT",
  "MANUAL_OVERRIDE",
]);
const VENUE_ACCOUNT_PLANS = new Set([
  "TRIAL",
  "BASIC",
  "PRO",
  "ENTERPRISE",
  "CUSTOM",
]);
const VENUE_ACCOUNT_CYCLES = new Set([
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "CUSTOM",
]);

type Data = FirebaseFirestore.DocumentData;
type UpdateData = FirebaseFirestore.UpdateData<Data>;

interface FieldFix {
  ref: FirebaseFirestore.DocumentReference;
  updates: UpdateData;
}

interface LocationFix {
  id: string;
  name: string;
  locationUpdates: UpdateData;
  fieldFixes: FieldFix[];
  fieldsToCreate: number;
  manualReview: string[];
}

interface VenueAccountFix {
  ownerId: string;
  locationIds: string[];
  accountUpdates: UpdateData;
  locationUpdates: Array<{
    id: string;
    ref: FirebaseFirestore.DocumentReference;
    updates: UpdateData;
  }>;
  manualReview: string[];
}

interface Stats {
  scanned: number;
  locationsWithFixes: number;
  locationsUpdated: number;
  fieldsUpdated: number;
  fieldsCreated: number;
  venueAccountsWithFixes: number;
  venueAccountsUpdated: number;
  venueAccountLocationsUpdated: number;
  manualReview: number;
  errors: number;
}

function hasOwn(data: Data, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, field);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function valid(value: unknown, allowed: Set<string>): boolean {
  return typeof value === "string" && allowed.has(value);
}

function positiveInt(value: unknown): number {
  const number = finiteNumber(value);
  return number && Number.isInteger(number) && number > 0 ? number : 0;
}

function cents(value: unknown): number {
  const number = finiteNumber(value);
  return number && Number.isInteger(number) && number > 0 ? number : 0;
}

function inferFieldType(value: unknown, name: string): string {
  const explicit = nonEmptyString(value)?.toUpperCase();
  if (explicit && FIELD_TYPES.has(explicit)) return explicit;
  const lower = name.toLowerCase();
  if (lower.includes("futsal")) return "FUTSAL";
  if (lower.includes("areia") || lower.includes("beach")) return "AREIA";
  if (lower.includes("campo") || lower.includes("grama")) return "CAMPO";
  return "SOCIETY";
}

function fieldPrice(data: Data): number {
  return finiteNumber(data.hourly_price) ??
    finiteNumber(data.price_per_hour) ??
    finiteNumber(data.hourlyPrice) ??
    0;
}

function withAudit(updates: UpdateData): UpdateData {
  if (Object.keys(updates).length === 0) return updates;
  return {
    ...updates,
    updated_at: FieldValue.serverTimestamp(),
    backfill_source: SOURCE,
  };
}

function buildFieldDefaults(params: {
  locationId: string;
  fieldIndex: number;
  totalFields: number;
  ownerId: string | null;
  fieldType: string;
}): Data {
  return {
    name: params.totalFields === 1 ?
      "Quadra Principal" :
      `Quadra ${params.fieldIndex}`,
    location_id: params.locationId,
    type: params.fieldType,
    is_active: true,
    hourly_price: 0,
    amenities: [],
    photos: [],
    managers: params.ownerId ? [params.ownerId] : [],
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    backfill_source: SOURCE,
  };
}

function buildFieldFix(
  fieldDoc: FirebaseFirestore.QueryDocumentSnapshot,
  locationId: string,
  locationName: string,
  ownerId: string | null
): FieldFix | null {
  const data = fieldDoc.data();
  const updates: UpdateData = {};
  const type = inferFieldType(data.type ?? data.field_type, locationName);

  if (data.location_id !== locationId) updates.location_id = locationId;
  if (!nonEmptyString(data.name)) updates.name = "Quadra Principal";
  if (!valid(data.type, FIELD_TYPES)) updates.type = type;
  if (!hasOwn(data, "is_active")) updates.is_active = true;
  if (!hasOwn(data, "hourly_price")) updates.hourly_price = fieldPrice(data);
  if (!Array.isArray(data.photos)) updates.photos = [];
  if (!Array.isArray(data.amenities)) updates.amenities = [];
  if (!Array.isArray(data.managers)) {
    updates.managers = ownerId ? [ownerId] : [];
  }

  const audited = withAudit(updates);
  return Object.keys(audited).length > 0 ?
    {ref: fieldDoc.ref, updates: audited} :
    null;
}

function buildLocationUpdates(params: {
  data: Data;
  fieldCount: number;
  activeFieldCount: number;
  fieldType: string;
}): {updates: UpdateData; manualReview: string[]} {
  const updates: UpdateData = {};
  const review: string[] = [];
  const data = params.data;

  if (!valid(data.publication_status, PUBLICATION_STATUSES)) {
    updates.publication_status = "PENDING_REVIEW";
    review.push("publication_status defaulted to PENDING_REVIEW");
  }
  if (!valid(data.subscription_status, SUBSCRIPTION_STATUSES)) {
    updates.subscription_status = "TRIAL";
  }
  if (!valid(data.commercial_status, SUBSCRIPTION_STATUSES)) {
    updates.commercial_status = updates.subscription_status ??
      data.subscription_status ??
      "TRIAL";
  }
  if (!hasOwn(data, "monthly_fee_cents")) {
    updates.monthly_fee_cents = null;
    review.push("monthly_fee_cents undefined");
  }
  if (!hasOwn(data, "billing_due_day")) updates.billing_due_day = null;
  if (!hasOwn(data, "field_count") ||
      data.field_count !== params.fieldCount) {
    updates.field_count = params.fieldCount;
  }
  if (!hasOwn(data, "has_active_fields") ||
      data.has_active_fields !== (params.activeFieldCount > 0)) {
    updates.has_active_fields = params.activeFieldCount > 0;
  }
  if (params.fieldCount > 0 &&
      !valid(data.primary_field_type, FIELD_TYPES)) {
    updates.primary_field_type = params.fieldType;
  }
  if (params.fieldCount > 0 && !valid(data.field_type, FIELD_TYPES)) {
    updates.field_type = params.fieldType;
  }
  if (params.fieldCount === 0) review.push("no playable fields found");
  if (!nonEmptyString(data.owner_id)) review.push("missing owner_id");
  if (!nonEmptyString(data.address) && !nonEmptyString(data.street)) {
    review.push("missing structured/public address");
  }
  if (!Array.isArray(data.photos) && !nonEmptyString(data.photo_url)) {
    review.push("missing venue photos");
  }

  return {updates: withAudit(updates), manualReview: review};
}

function inferVenueAccountStatus(locations: Data[]): string {
  const statuses = locations
    .map((location) => location.subscription_status)
    .filter((status): status is string => valid(status, SUBSCRIPTION_STATUSES));
  if (statuses.includes("SUSPENDED")) return "SUSPENDED";
  if (statuses.includes("OVERDUE")) return "OVERDUE";
  if (statuses.includes("ACTIVE")) return "ACTIVE";
  if (statuses.includes("CANCELLED")) return "CANCELLED";
  return "TRIAL";
}

function computeVenueAccountTotals(locations: Data[]) {
  const activeFieldCount = locations.reduce(
    (sum, location) => sum + (
      positiveInt(location.active_field_count) ||
      (location.has_active_fields === false ? 0 : positiveInt(location.field_count))
    ),
    0
  );
  const legacyMonthlyFeeTotalCents = locations.reduce(
    (sum, location) => sum + cents(location.monthly_fee_cents),
    0
  );
  const publishedLocationsCount = locations.filter((location) =>
    location.publication_status === "PUBLISHED" || location.is_verified === true
  ).length;
  const positiveFees = locations
    .map((location) => cents(location.monthly_fee_cents))
    .filter((fee) => fee > 0);
  const uniqueFees = Array.from(new Set(positiveFees));

  return {
    activeFieldCount,
    legacyMonthlyFeeTotalCents,
    publishedLocationsCount,
    defaultLocationFeeCents:
      uniqueFees.length === 1 && positiveFees.length === locations.length ?
        uniqueFees[0] :
        null,
  };
}

function buildVenueAccountDocument(params: {
  ownerId: string;
  existing: Data | null;
  locations: Data[];
  locationIds: string[];
}): UpdateData {
  const totals = computeVenueAccountTotals(params.locations);
  const status = valid(params.existing?.status, SUBSCRIPTION_STATUSES) ?
    params.existing?.status :
    inferVenueAccountStatus(params.locations);
  const billingScope = valid(params.existing?.billing_scope, VENUE_ACCOUNT_SCOPES) ?
    params.existing?.billing_scope :
    "LOCATION";
  const computedMonthlyFeeCents = billingScope === "LOCATION" &&
    typeof params.existing?.default_location_fee_cents === "number" ?
    cents(params.existing.default_location_fee_cents) * params.locations.length :
    totals.legacyMonthlyFeeTotalCents;

  return {
    owner_uid: params.ownerId,
    status,
    billing_scope: billingScope,
    billing_plan_code: valid(params.existing?.billing_plan_code, VENUE_ACCOUNT_PLANS) ?
      params.existing?.billing_plan_code :
      null,
    billing_plan_label: nonEmptyString(params.existing?.billing_plan_label),
    billing_cycle: valid(params.existing?.billing_cycle, VENUE_ACCOUNT_CYCLES) ?
      params.existing?.billing_cycle :
      null,
    default_location_fee_cents: typeof params.existing?.default_location_fee_cents === "number" ?
      params.existing?.default_location_fee_cents :
      totals.defaultLocationFeeCents,
    linked_location_ids: params.locationIds,
    linked_locations_count: params.locationIds.length,
    published_locations_count: totals.publishedLocationsCount,
    active_fields_count: totals.activeFieldCount,
    legacy_monthly_fee_total_cents: totals.legacyMonthlyFeeTotalCents,
    computed_monthly_fee_cents: computedMonthlyFeeCents,
    backfill_source: SOURCE,
    updated_at: FieldValue.serverTimestamp(),
    created_at: params.existing?.created_at ?? FieldValue.serverTimestamp(),
  };
}

async function auditLocation(
  locDoc: FirebaseFirestore.QueryDocumentSnapshot
): Promise<LocationFix> {
  const data = locDoc.data();
  const name = nonEmptyString(data.name) ?? "Local sem nome";
  const ownerId = nonEmptyString(data.owner_id);
  const legacyFieldCount = Math.max(
    0,
    Math.floor(finiteNumber(data.field_count) ?? 0)
  );
  const nestedSnap = await locDoc.ref.collection("fields").get();
  const rootSnap = await db
    .collection("fields")
    .where("location_id", "==", locDoc.id)
    .get();
  const allFields = [...nestedSnap.docs, ...rootSnap.docs];
  const activeFieldCount = allFields
    .filter((fieldDoc) => fieldDoc.data().is_active !== false)
    .length;
  const fieldsToCreate = Math.max(0, legacyFieldCount - allFields.length);
  const fieldType = inferFieldType(
    data.field_type ?? data.primary_field_type,
    name
  );
  const fieldFixes = allFields
    .map((fieldDoc) => buildFieldFix(fieldDoc, locDoc.id, name, ownerId))
    .filter((fieldFix): fieldFix is FieldFix => fieldFix !== null);
  const {updates, manualReview} = buildLocationUpdates({
    data,
    fieldCount: allFields.length + fieldsToCreate,
    activeFieldCount: activeFieldCount + fieldsToCreate,
    fieldType,
  });

  if (fieldsToCreate > 0) {
    manualReview.push("legacy field_count required missing field creation");
  }
  if (rootSnap.size > 0) {
    manualReview.push(`${rootSnap.size} legacy root field(s) still present`);
  }

  return {
    id: locDoc.id,
    name,
    locationUpdates: updates,
    fieldFixes,
    fieldsToCreate,
    manualReview,
  };
}

async function applyFix(fix: LocationFix): Promise<void> {
  const locRef = db.collection("locations").doc(fix.id);
  const locDoc = await locRef.get();
  const data = locDoc.data() ?? {};
  const ownerId = nonEmptyString(data.owner_id);
  const fieldType = inferFieldType(
    data.field_type ?? data.primary_field_type,
    fix.name
  );
  const batch = db.batch();
  const legacyFieldCount = Math.max(
    1,
    Math.floor(finiteNumber(data.field_count) ?? fix.fieldsToCreate)
  );

  if (Object.keys(fix.locationUpdates).length > 0) {
    batch.update(locRef, fix.locationUpdates);
  }
  for (const fieldFix of fix.fieldFixes) {
    batch.update(fieldFix.ref, fieldFix.updates);
  }
  for (let i = 1; i <= fix.fieldsToCreate; i++) {
    batch.set(locRef.collection("fields").doc(), buildFieldDefaults({
      locationId: fix.id,
      fieldIndex: i,
      totalFields: legacyFieldCount,
      ownerId,
      fieldType,
    }));
  }
  await batch.commit();
}

async function buildVenueAccountFix(
  ownerId: string,
  locationDocs: FirebaseFirestore.QueryDocumentSnapshot[]
): Promise<VenueAccountFix> {
  const accountRef = db.collection("venue_accounts").doc(ownerId);
  const accountSnap = await accountRef.get();
  const existing = accountSnap.data() ?? null;
  const manualReview: string[] = [];
  const eligibleLocationDocs = locationDocs.filter((locationDoc) => {
    const data = locationDoc.data();
    const linkedAccount = nonEmptyString(data.venue_account_id);
    if (linkedAccount && linkedAccount !== ownerId) {
      manualReview.push(
        `${locationDoc.id} already linked to venue account ${linkedAccount}`
      );
      return false;
    }
    return true;
  });
  const locations = eligibleLocationDocs.map((locationDoc) => locationDoc.data());
  const locationIds = eligibleLocationDocs.map((locationDoc) => locationDoc.id);
  const accountUpdates = buildVenueAccountDocument({
    ownerId,
    existing,
    locations,
    locationIds,
  });
  const locationUpdates = eligibleLocationDocs.map((locationDoc) => ({
    id: locationDoc.id,
    ref: locationDoc.ref,
    updates: withAudit({
      venue_account_id: ownerId,
      venue_account_status: accountUpdates.status,
      venue_account_charge_scope: accountUpdates.billing_scope,
      venue_account_plan_code: accountUpdates.billing_plan_code,
      venue_account_plan_label: accountUpdates.billing_plan_label,
      venue_account_monthly_total_cents:
        accountUpdates.computed_monthly_fee_cents,
      venue_account_linked_locations_count:
        accountUpdates.linked_locations_count,
      venue_account_active_fields_count: accountUpdates.active_fields_count,
    }),
  })).filter((locationUpdate) =>
    Object.entries(locationUpdate.updates).some(([key, value]) =>
      key !== "updated_at" &&
      key !== "backfill_source" &&
      locationUpdate.ref &&
      locationDocs.find((doc) => doc.id === locationUpdate.id)?.data()[key] !== value
    )
  );

  return {
    ownerId,
    locationIds,
    accountUpdates,
    locationUpdates,
    manualReview,
  };
}

async function applyVenueAccountFix(fix: VenueAccountFix): Promise<void> {
  const batch = db.batch();
  batch.set(
    db.collection("venue_accounts").doc(fix.ownerId),
    fix.accountUpdates,
    {merge: true}
  );
  for (const locationUpdate of fix.locationUpdates) {
    batch.update(locationUpdate.ref, locationUpdate.updates);
  }
  await batch.commit();
}

function hasFixes(fix: LocationFix): boolean {
  return Object.keys(fix.locationUpdates).length > 0 ||
    fix.fieldFixes.length > 0 ||
    fix.fieldsToCreate > 0;
}

function hasVenueAccountFixes(fix: VenueAccountFix): boolean {
  return Object.keys(fix.accountUpdates).length > 0 ||
    fix.locationUpdates.length > 0;
}

function printFix(fix: LocationFix, execute: boolean): void {
  if (!hasFixes(fix) && fix.manualReview.length === 0) return;
  console.log(`\n${fix.name} (${fix.id})`);
  if (hasFixes(fix)) {
    console.log(`  ${execute ? "fixed" : "would fix"}:`);
    for (const field of Object.keys(fix.locationUpdates)) {
      console.log(`    - location.${field}`);
    }
    for (const fieldFix of fix.fieldFixes) {
      console.log(`    - field.${fieldFix.ref.id}`);
    }
    if (fix.fieldsToCreate > 0) {
      console.log(`    - create ${fix.fieldsToCreate} missing field(s)`);
    }
  }
  if (fix.manualReview.length > 0) {
    console.log("  manual review:");
    for (const item of fix.manualReview) console.log(`    - ${item}`);
  }
}

function printVenueAccountFix(fix: VenueAccountFix, execute: boolean): void {
  if (!hasVenueAccountFixes(fix) && fix.manualReview.length === 0) return;
  console.log(`\nvenue account ${fix.ownerId}`);
  if (hasVenueAccountFixes(fix)) {
    console.log(`  ${execute ? "synced" : "would sync"}:`);
    console.log(`    - venue_accounts/${fix.ownerId}`);
    console.log(`    - linked locations: ${fix.locationIds.length}`);
    console.log(`    - monthly total: ${fix.accountUpdates.computed_monthly_fee_cents ?? 0}`);
    for (const locationUpdate of fix.locationUpdates) {
      console.log(`    - locations/${locationUpdate.id}.venue_account_*`);
    }
  }
  if (fix.manualReview.length > 0) {
    console.log("  manual review:");
    for (const item of fix.manualReview) console.log(`    - ${item}`);
  }
}

async function backfill(execute: boolean): Promise<void> {
  const stats: Stats = {
    scanned: 0,
    locationsWithFixes: 0,
    locationsUpdated: 0,
    fieldsUpdated: 0,
    fieldsCreated: 0,
    venueAccountsWithFixes: 0,
    venueAccountsUpdated: 0,
    venueAccountLocationsUpdated: 0,
    manualReview: 0,
    errors: 0,
  };

  console.log(`\n${execute ? "EXECUTE" : "DRY-RUN"} venue backfill #3131`);
  console.log("Safety: no venue is published automatically.\n");

  const snap = await db.collection("locations").get();
  stats.scanned = snap.size;
  const locationsByOwner = new Map<
    string,
    FirebaseFirestore.QueryDocumentSnapshot[]
  >();

  for (const locDoc of snap.docs) {
    try {
      const ownerId = nonEmptyString(locDoc.data().owner_id);
      if (ownerId) {
        locationsByOwner.set(ownerId, [
          ...(locationsByOwner.get(ownerId) ?? []),
          locDoc,
        ]);
      }
      const fix = await auditLocation(locDoc);
      if (hasFixes(fix)) stats.locationsWithFixes++;
      if (fix.manualReview.length > 0) stats.manualReview++;
      stats.fieldsUpdated += fix.fieldFixes.length;
      stats.fieldsCreated += fix.fieldsToCreate;
      printFix(fix, execute);
      if (execute && hasFixes(fix)) {
        await applyFix(fix);
        stats.locationsUpdated++;
      }
    } catch (err) {
      stats.errors++;
      console.error(`ERROR ${locDoc.id}: ${String(err)}`);
    }
  }

  for (const [ownerId, ownerLocationDocs] of locationsByOwner.entries()) {
    try {
      const fix = await buildVenueAccountFix(ownerId, ownerLocationDocs);
      if (hasVenueAccountFixes(fix)) stats.venueAccountsWithFixes++;
      if (fix.manualReview.length > 0) stats.manualReview++;
      stats.venueAccountLocationsUpdated += fix.locationUpdates.length;
      printVenueAccountFix(fix, execute);
      if (execute && hasVenueAccountFixes(fix)) {
        await applyVenueAccountFix(fix);
        stats.venueAccountsUpdated++;
      }
    } catch (err) {
      stats.errors++;
      console.error(`ERROR venue account ${ownerId}: ${String(err)}`);
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log(`locations scanned:      ${stats.scanned}`);
  console.log(`locations with fixes:   ${stats.locationsWithFixes}`);
  console.log(`locations updated:      ${execute ? stats.locationsUpdated : 0}`);
  console.log(`field docs needing fix: ${stats.fieldsUpdated}`);
  console.log(`field docs to create:   ${stats.fieldsCreated}`);
  console.log(`venue accounts to sync: ${stats.venueAccountsWithFixes}`);
  console.log(`venue accounts updated: ${execute ? stats.venueAccountsUpdated : 0}`);
  console.log(`venue account locations:${stats.venueAccountLocationsUpdated}`);
  console.log(`manual review required: ${stats.manualReview}`);
  console.log(`errors:                 ${stats.errors}`);
  console.log("=".repeat(72));

  if (!execute) {
    console.log("\nDry-run only. To apply safe backfills:");
    console.log("  npm run backfill:venues:execute");
  }
}

const execute = process.argv.includes("--execute");

backfill(execute)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
