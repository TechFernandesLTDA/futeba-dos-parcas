import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {db} from "../_db";

type OnboardingStatus =
  "LEAD" |
  "IN_REVIEW" |
  "APPROVED" |
  "REJECTED" |
  "SUSPENDED" |
  "CANCELLED";
type ReviewDecision = "APPROVED" | "REJECTED" | "SUSPENDED" | "CANCELLED";

interface RequestVenueOwnerOnboardingRequest {
  contactName?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  businessName?: string | null;
  commercialDocument?: string | null;
  notes?: string | null;
  locationIds?: unknown;
  termsAccepted?: boolean | null;
}

interface ReviewVenueOwnerOnboardingRequest {
  ownerUid: string;
  decision: ReviewDecision;
  reason?: string | null;
  checklist?: {
    contactReviewed?: boolean;
    locationsReviewed?: boolean;
    termsReviewed?: boolean;
    billingReviewed?: boolean;
  } | null;
}

interface OnboardingResponse {
  success: boolean;
  ownerUid: string;
  status: OnboardingStatus;
  role?: string;
}

const COLLECTION = "venue_owner_onboarding";
const VALID_DECISIONS = new Set(["APPROVED", "REJECTED", "SUSPENDED", "CANCELLED"]);

/**
 * Normaliza texto opcional com limite de tamanho.
 * @param {unknown} value Valor recebido.
 * @param {number} maxLength Tamanho maximo.
 * @return {string | null} Texto trimado ou null.
 */
function optionalTrimmed(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * Normaliza email opcional.
 * @param {unknown} value Valor recebido.
 * @return {string | null} Email normalizado ou null.
 */
function optionalEmail(value: unknown): string | null {
  const email = optionalTrimmed(value, 254)?.toLowerCase() ?? null;
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "contactEmail must be valid");
  }
  return email;
}

/**
 * Normaliza lista limitada de location ids.
 * @param {unknown} value Valor recebido.
 * @return {string[]} IDs seguros.
 */
function normalizeLocationIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20)));
}

/**
 * Valida decisao admin.
 * @param {unknown} value Valor recebido.
 * @return {ReviewDecision} Decisao normalizada.
 */
function requireDecision(value: unknown): ReviewDecision {
  if (typeof value === "string" && VALID_DECISIONS.has(value)) {
    return value as ReviewDecision;
  }
  throw new HttpsError(
    "invalid-argument",
    "decision must be APPROVED, REJECTED, SUSPENDED or CANCELLED"
  );
}

/**
 * Garante checklist obrigatorio para aprovacao comercial.
 * @param {object | null | undefined} checklist Checklist.
 */
function assertApprovalChecklist(
  checklist: ReviewVenueOwnerOnboardingRequest["checklist"]
) {
  const required = [
    "contactReviewed",
    "locationsReviewed",
    "termsReviewed",
    "billingReviewed",
  ] as const;
  const missing = required.filter((field) => checklist?.[field] !== true);
  if (missing.length) {
    throw new HttpsError(
      "failed-precondition",
      `approval checklist incomplete: ${missing.join(", ")}`
    );
  }
}

/**
 * Escreve evento imutavel do onboarding comercial.
 * @param {object} params Dados do evento.
 */
async function writeOnboardingEvent(params: {
  ownerUid: string;
  actorUid: string;
  type: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}) {
  const event = {
    owner_uid: params.ownerUid,
    actor_uid: params.actorUid,
    type: params.type,
    before: params.before ?? null,
    after: params.after ?? null,
    reason: params.reason ?? null,
    created_at: FieldValue.serverTimestamp(),
  };
  await Promise.all([
    db().collection(COLLECTION)
      .doc(params.ownerUid)
      .collection("events")
      .add(event),
    db().collection("audit_logs").add({
      ...event,
      target_user_id: params.ownerUid,
      category: "VENUE_OWNER_ONBOARDING",
    }),
  ]);
}

/**
 * Usuario solicita ou atualiza onboarding comercial para dono de quadra.
 */
export const requestVenueOwnerOnboarding = secureCallable<
  RequestVenueOwnerOnboardingRequest,
  OnboardingResponse
>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    rateLimit: {maxRequests: 5, windowMs: 60000, keyPrefix: "venueOwnerOnboarding"},
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "requestVenueOwnerOnboarding",
      ownerUid: request.auth?.uid,
      locationCount: Array.isArray(request.data?.locationIds) ?
        request.data?.locationIds.length :
        0,
    }),
  },
  async (request) => {
    const ownerUid = request.auth?.uid;
    if (!ownerUid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    if (request.data?.termsAccepted !== true) {
      throw new HttpsError(
        "failed-precondition",
        "Commercial terms must be accepted"
      );
    }

    const userSnap = await db().collection("users").doc(ownerUid).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }
    const user = userSnap.data() || {};
    const contactName = optionalTrimmed(request.data?.contactName, 120) ||
      optionalTrimmed(user.name, 120);
    const contactEmail = optionalEmail(request.data?.contactEmail) ||
      optionalEmail(user.email);
    const phone = optionalTrimmed(request.data?.phone, 40) ||
      optionalTrimmed(user.phone || user.phone_number || user.phoneNumber, 40);

    if (!contactName) {
      throw new HttpsError("invalid-argument", "contactName is required");
    }
    if (!contactEmail && !phone) {
      throw new HttpsError(
        "invalid-argument",
        "contactEmail or phone is required"
      );
    }

    const ref = db().collection(COLLECTION).doc(ownerUid);
    const currentSnap = await ref.get();
    const current = currentSnap.data() || null;
    const currentStatus = current?.status as OnboardingStatus | undefined;
    if (currentStatus === "APPROVED") {
      return {success: true, ownerUid, status: "APPROVED", role: user.role as string};
    }
    if (currentStatus === "SUSPENDED" || currentStatus === "CANCELLED") {
      throw new HttpsError(
        "failed-precondition",
        "Onboarding cannot be self-updated in the current status"
      );
    }

    const status: OnboardingStatus = "IN_REVIEW";
    const payload = {
      owner_uid: ownerUid,
      status,
      previous_status: currentStatus || "LEAD",
      contact_name: contactName,
      contact_email: contactEmail,
      phone,
      business_name: optionalTrimmed(request.data?.businessName, 120),
      commercial_document: optionalTrimmed(request.data?.commercialDocument, 64),
      notes: optionalTrimmed(request.data?.notes, 1000),
      location_ids: normalizeLocationIds(request.data?.locationIds),
      terms_accepted: true,
      terms_accepted_at: FieldValue.serverTimestamp(),
      submitted_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      updated_by: ownerUid,
      source: "SELF_SERVICE",
    };

    await ref.set({
      created_at: current?.created_at ?? FieldValue.serverTimestamp(),
      ...payload,
    }, {merge: true});
    await writeOnboardingEvent({
      ownerUid,
      actorUid: ownerUid,
      type: "VENUE_OWNER_ONBOARDING_SUBMITTED",
      before: current ? {status: current.status ?? null} : null,
      after: {status},
    });

    logger.info(`Venue owner onboarding submitted by ${ownerUid}`);
    return {success: true, ownerUid, status};
  }
);

/**
 * Admin revisa onboarding comercial e coordena role FIELD_OWNER.
 */
export const reviewVenueOwnerOnboarding = secureCallable<
  ReviewVenueOwnerOnboardingRequest,
  OnboardingResponse
>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "venueOwnerReview"},
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "reviewVenueOwnerOnboarding",
      ownerUid: request.data?.ownerUid,
      decision: request.data?.decision,
    }),
  },
  async (request) => {
    const adminUid = request.auth?.uid;
    if (!adminUid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const ownerUid = optionalTrimmed(request.data?.ownerUid, 128);
    if (!ownerUid) {
      throw new HttpsError("invalid-argument", "ownerUid is required");
    }
    const decision = requireDecision(request.data?.decision);
    const reason = optionalTrimmed(request.data?.reason, 800);
    if (decision !== "APPROVED" && !reason) {
      throw new HttpsError(
        "invalid-argument",
        "reason is required for non-approval decisions"
      );
    }
    if (decision === "APPROVED") {
      assertApprovalChecklist(request.data?.checklist);
    }

    const onboardingRef = db().collection(COLLECTION).doc(ownerUid);
    const userRef = db().collection("users").doc(ownerUid);
    const [onboardingSnap, userSnap] = await Promise.all([
      onboardingRef.get(),
      userRef.get(),
    ]);
    if (!onboardingSnap.exists) {
      throw new HttpsError("not-found", "Onboarding request not found");
    }
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }

    const before = onboardingSnap.data() || {};
    const update = {
      status: decision as OnboardingStatus,
      reviewed_at: FieldValue.serverTimestamp(),
      reviewed_by: adminUid,
      review_reason: reason,
      review_checklist: request.data?.checklist ?? null,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: adminUid,
    };

    if (decision === "APPROVED") {
      const claims = (await admin.auth().getUser(ownerUid)).customClaims || {};
      await admin.auth().setCustomUserClaims(ownerUid, {
        ...claims,
        role: "FIELD_OWNER",
      });
      await admin.auth().revokeRefreshTokens(ownerUid);
    }

    const batch = db().batch();
    batch.update(onboardingRef, update);
    if (decision === "APPROVED") {
      batch.update(userRef, {
        role: "FIELD_OWNER",
        venue_owner_onboarding_status: "APPROVED",
        venue_owner_approved_at: FieldValue.serverTimestamp(),
        venue_owner_approved_by: adminUid,
        claims_updated_at: FieldValue.serverTimestamp(),
        claims_updated_by: adminUid,
      });
    } else {
      batch.update(userRef, {
        venue_owner_onboarding_status: decision,
        venue_owner_reviewed_at: FieldValue.serverTimestamp(),
        venue_owner_reviewed_by: adminUid,
      });
    }
    await batch.commit();

    await writeOnboardingEvent({
      ownerUid,
      actorUid: adminUid,
      type: `VENUE_OWNER_ONBOARDING_${decision}`,
      before: {status: before.status ?? null},
      after: {status: decision},
      reason,
    });

    logger.info(`Venue owner onboarding ${decision} for ${ownerUid}`);
    return {
      success: true,
      ownerUid,
      status: decision as OnboardingStatus,
      role: decision === "APPROVED" ? "FIELD_OWNER" : userSnap.data()?.role as string,
    };
  }
);
