import {FieldValue} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {db} from "../_db";
import {ERROR_MSGS} from "../error-messages";
import {buildLocationCommercialRequestSnapshot} from "./location-aggregates";
import {
  AcceptLocationManagerInviteRequest,
  assertAdmin,
  assertAdminOrLocationOwner,
  AssignLocationOwnerRequest,
  COMMERCIAL_REQUEST_TYPES,
  DELETE_BATCH_SIZE,
  DeleteLocationRequest,
  getExistingLocation,
  getLocationFields,
  InviteLocationManagerRequest,
  LOCATION_SUBCOLLECTIONS,
  managerInviteExpiresAt,
  normalizeStringArray,
  optionalEmail,
  optionalTrimmed,
  PUBLICATION_STATUSES,
  RemoveLocationManagerRequest,
  RequestLocationCommercialReviewRequest,
  requireEnum,
  requireNonEmptyString,
  ReviewLocationCommercialRequest,
  SetLocationPublicationStatusRequest,
  writeLocationCommercialEvent,
} from "./location-types-helpers";

/**
 * Deletes every document in a location subcollection using paged batches.
 *
 * @param {string} locationId Location document id.
 * @param {string} subcollection Child collection name.
 * @return {Promise<number>} Number of deleted documents.
 */
export async function deleteLocationSubcollection(
  locationId: string,
  subcollection: string
): Promise<number> {
  let deletedCount = 0;

  while (true) {
    const snap = await db()
      .collection("locations")
      .doc(locationId)
      .collection(subcollection)
      .limit(DELETE_BATCH_SIZE)
      .get();

    if (snap.empty) break;

    const batch = db().batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    deletedCount += snap.size;
    if (snap.size < DELETE_BATCH_SIZE) break;
  }

  return deletedCount;
}

export const deleteLocation = secureCallable<DeleteLocationRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 5, windowMs: 60000, keyPrefix: "deleteLoc"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "deleteLocation",
      locationId: req.data?.locationId,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const {locationId} = request.data;
    if (!locationId || typeof locationId !== "string") {
      throw new HttpsError("invalid-argument", "locationId must be a non-empty string");
    }

    const locRef = db().collection("locations").doc(locationId);
    const locDoc = await locRef.get();
    if (!locDoc.exists) {
      throw new HttpsError("not-found", `Location ${locationId} not found`);
    }

    const locData = locDoc.data() || {};
    let deletedCount = 0;

    for (const sub of LOCATION_SUBCOLLECTIONS) {
      deletedCount += await deleteLocationSubcollection(locationId, sub);
    }

    await locRef.delete();
    deletedCount += 1;

    await db().collection("audit_logs").add({
      type: "LOCATION_DELETE",
      target_location_id: locationId,
      actor_user_id: request.auth.uid,
      location_name: locData.name || null,
      deleted_docs_count: deletedCount,
      subcollections: LOCATION_SUBCOLLECTIONS,
      timestamp: FieldValue.serverTimestamp(),
    });

    logger.info(`Location ${locationId} deleted (cascade: ${deletedCount} docs)`);
    return {success: true, deletedCount};
  }
);

export const setLocationPublicationStatus =
secureCallable<SetLocationPublicationStatusRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locPub"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "setLocationPublicationStatus",
      locationId: req.data?.locationId,
      publicationStatus: req.data?.publicationStatus,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const publicationStatus = requireEnum(
      request.data.publicationStatus,
      PUBLICATION_STATUSES,
      "publicationStatus"
    );
    const reason = optionalTrimmed(request.data.reason, 500);
    const {locRef, locData} = await getExistingLocation(locationId);
    const before = {
      publication_status: locData.publication_status ?? null,
      is_verified: locData.is_verified ?? null,
      is_active: locData.is_active ?? null,
      unpublished_reason: locData.unpublished_reason ?? null,
    };
    const isPublished = publicationStatus === "PUBLISHED";
    const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      publication_status: publicationStatus,
      is_verified: isPublished ? true : locData.is_verified ?? false,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
      unpublished_reason: isPublished ? null : reason,
    };

    if (isPublished) {
      const fields = await getLocationFields(locationId);
      const publicationSnapshot = buildLocationCommercialRequestSnapshot(
        {
          ...locData,
          publication_status: "PUBLISHED",
          is_verified: true,
        },
        fields
      );
      if (publicationSnapshot.ready_for_publication_approval !== true) {
        const issueCodes = Array.isArray(publicationSnapshot.commercial_issue_codes) ?
          publicationSnapshot.commercial_issue_codes :
          [];
        throw new HttpsError(
          "failed-precondition",
          `Location is not ready for publication: ${issueCodes.join(", ")}`
        );
      }
      update.published_at = FieldValue.serverTimestamp();
      update.published_by = request.auth.uid;
    }

    await locRef.update(update);
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_PUBLICATION_STATUS_CHANGE",
      before,
      after: {
        publication_status: publicationStatus,
        is_verified: update.is_verified,
        unpublished_reason: update.unpublished_reason,
      },
      reason,
    });

    return {success: true, locationId, publicationStatus};
  }
);

export const requestLocationCommercialReview =
secureCallable<RequestLocationCommercialReviewRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    rateLimit: {maxRequests: 10, windowMs: 60000, keyPrefix: "locCommReq"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "requestLocationCommercialReview",
      locationId: req.data?.locationId,
      requestType: req.data?.requestType,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }

    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const requestType = requireEnum(
      request.data.requestType,
      COMMERCIAL_REQUEST_TYPES,
      "requestType"
    );
    const notes = optionalTrimmed(request.data.notes, 2000);
    const requestedSections = normalizeStringArray(
      request.data.requestedSections,
      8,
      60
    );
    const {locRef, locData} = await getExistingLocation(locationId);
    assertAdminOrLocationOwner(request, locData);

    if (locData.latest_commercial_request_status === "PENDING_REVIEW") {
      throw new HttpsError(
        "failed-precondition",
        "There is already a pending commercial request for this location"
      );
    }
    if (requestType === "PUBLICATION" &&
      locData.publication_status === "PUBLISHED"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Published locations should use COMMERCIAL_UPDATE requests"
      );
    }

    const fields = await getLocationFields(locationId);
    const snapshot = buildLocationCommercialRequestSnapshot(locData, fields);
    const pendingItemIds = Array.isArray(snapshot.pending_item_ids) ?
      snapshot.pending_item_ids :
      [];
    if (requestType === "PUBLICATION" &&
      snapshot.owner_ready_for_publication !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Complete the minimum registration before requesting publication: ${pendingItemIds.join(", ")}`
      );
    }

    const requestRef = locRef.collection("publication_requests").doc();
    const publicationStatus = requestType === "PUBLICATION" &&
      locData.publication_status !== "PUBLISHED" ?
      "PENDING_REVIEW" :
      (typeof locData.publication_status === "string" ?
        locData.publication_status :
        "DRAFT");

    const batch = db().batch();
    batch.set(requestRef, {
      location_id: locationId,
      request_type: requestType,
      status: "PENDING_REVIEW",
      requested_sections: requestedSections,
      owner_notes: notes,
      admin_notes: null,
      submitted_by: request.auth.uid,
      reviewer_user_id: null,
      snapshot,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      reviewed_at: null,
      closed_at: null,
    });
    batch.update(locRef, {
      latest_commercial_request_id: requestRef.id,
      latest_commercial_request_type: requestType,
      latest_commercial_request_status: "PENDING_REVIEW",
      latest_commercial_request_requested_sections: requestedSections,
      latest_commercial_request_owner_notes: notes,
      latest_commercial_request_admin_notes: null,
      latest_commercial_request_pending_item_ids: snapshot.pending_item_ids,
      latest_commercial_request_commercial_issue_codes:
        snapshot.commercial_issue_codes,
      latest_commercial_request_checklist_completed:
        snapshot.checklist_completed,
      latest_commercial_request_checklist_total: snapshot.checklist_total,
      latest_commercial_request_active_field_count:
        snapshot.active_field_count,
      latest_commercial_request_photo_count: snapshot.photo_count,
      latest_commercial_request_requested_at: FieldValue.serverTimestamp(),
      latest_commercial_request_updated_at: FieldValue.serverTimestamp(),
      latest_commercial_request_reviewed_at: null,
      owner_notes: notes,
      publication_status: publicationStatus,
      unpublished_reason: null,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    });
    await batch.commit();

    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_COMMERCIAL_REQUEST_SUBMITTED",
      before: {
        latest_commercial_request_status:
          locData.latest_commercial_request_status ?? null,
        publication_status: locData.publication_status ?? null,
      },
      after: {
        request_id: requestRef.id,
        request_type: requestType,
        request_status: "PENDING_REVIEW",
        requested_sections: requestedSections,
        publication_status: publicationStatus,
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      requestId: requestRef.id,
      requestStatus: "PENDING_REVIEW",
      publicationStatus,
    };
  }
);

export const reviewLocationCommercialRequest =
secureCallable<ReviewLocationCommercialRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locCommReview"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "reviewLocationCommercialRequest",
      locationId: req.data?.locationId,
      requestId: req.data?.requestId,
      decision: req.data?.decision,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    assertAdmin(request);

    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const requestId = requireNonEmptyString(request.data.requestId, "requestId");
    const decision = requireEnum(
      request.data.decision,
      ["NEEDS_CHANGES", "APPROVED", "REJECTED"] as const,
      "decision"
    );
    const notes = optionalTrimmed(request.data.notes, 2000);
    const {locRef, locData} = await getExistingLocation(locationId);
    const commercialRequestRef = locRef.collection("publication_requests").doc(requestId);
    const commercialRequestDoc = await commercialRequestRef.get();
    if (!commercialRequestDoc.exists) {
      throw new HttpsError("not-found", `Commercial request ${requestId} not found`);
    }
    const commercialRequestData = commercialRequestDoc.data() || {};
    if (commercialRequestData.status !== "PENDING_REVIEW") {
      throw new HttpsError(
        "failed-precondition",
        "Commercial request is not pending review"
      );
    }

    const requestType = requireEnum(
      commercialRequestData.request_type,
      COMMERCIAL_REQUEST_TYPES,
      "requestType"
    );
    const fields = await getLocationFields(locationId);
    const snapshot = buildLocationCommercialRequestSnapshot(locData, fields);
    let nextPublicationStatus = typeof locData.publication_status === "string" ?
      locData.publication_status :
      "DRAFT";

    if (decision === "APPROVED" && requestType === "PUBLICATION") {
      if (snapshot.ready_for_publication_approval !== true) {
        throw new HttpsError(
          "failed-precondition",
          "Location is not ready for publication approval"
        );
      }
      nextPublicationStatus = "PUBLISHED";
    } else if (requestType === "PUBLICATION" && nextPublicationStatus !== "PUBLISHED") {
      nextPublicationStatus = decision === "REJECTED" ? "REJECTED" : "DRAFT";
    }

    const batch = db().batch();
    batch.update(commercialRequestRef, {
      status: decision,
      admin_notes: notes,
      reviewer_user_id: request.auth.uid,
      snapshot,
      reviewed_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      closed_at: FieldValue.serverTimestamp(),
    });

    const locationUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      latest_commercial_request_id: requestId,
      latest_commercial_request_type: requestType,
      latest_commercial_request_status: decision,
      latest_commercial_request_requested_sections:
        commercialRequestData.requested_sections ?? [],
      latest_commercial_request_owner_notes:
        commercialRequestData.owner_notes ?? null,
      latest_commercial_request_admin_notes: notes,
      latest_commercial_request_pending_item_ids: snapshot.pending_item_ids,
      latest_commercial_request_commercial_issue_codes:
        snapshot.commercial_issue_codes,
      latest_commercial_request_checklist_completed:
        snapshot.checklist_completed,
      latest_commercial_request_checklist_total: snapshot.checklist_total,
      latest_commercial_request_active_field_count:
        snapshot.active_field_count,
      latest_commercial_request_photo_count: snapshot.photo_count,
      latest_commercial_request_updated_at: FieldValue.serverTimestamp(),
      latest_commercial_request_reviewed_at: FieldValue.serverTimestamp(),
      admin_notes: notes,
      publication_status: nextPublicationStatus,
      unpublished_reason: decision === "REJECTED" ? notes : null,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    };

    if (decision === "APPROVED" && requestType === "PUBLICATION") {
      locationUpdate.published_at = FieldValue.serverTimestamp();
      locationUpdate.published_by = request.auth.uid;
      locationUpdate.unpublished_reason = null;
    }

    batch.update(locRef, locationUpdate);
    await batch.commit();

    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_COMMERCIAL_REQUEST_REVIEWED",
      before: {
        request_id: requestId,
        request_status: commercialRequestData.status ?? null,
        publication_status: locData.publication_status ?? null,
      },
      after: {
        request_id: requestId,
        request_type: requestType,
        request_status: decision,
        publication_status: nextPublicationStatus,
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      requestId,
      requestStatus: decision,
      publicationStatus: nextPublicationStatus,
    };
  }
);

export const assignLocationOwner = secureCallable<AssignLocationOwnerRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locOwner"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "assignLocationOwner",
      locationId: req.data?.locationId,
      newOwnerId: req.data?.newOwnerId,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const newOwnerId = requireNonEmptyString(request.data.newOwnerId, "newOwnerId");
    const reason = optionalTrimmed(request.data.reason, 500);
    const {locRef, locData} = await getExistingLocation(locationId);
    const newOwnerDoc = await db().collection("users").doc(newOwnerId).get();
    if (!newOwnerDoc.exists) {
      throw new HttpsError("not-found", `User ${newOwnerId} not found`);
    }

    const previousOwnerId = typeof locData.owner_id === "string" ?
      locData.owner_id :
      null;
    if (previousOwnerId === newOwnerId) {
      return {success: true, locationId, ownerId: newOwnerId, changed: false};
    }

    await locRef.update({
      owner_id: newOwnerId,
      managers: FieldValue.arrayRemove(newOwnerId),
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    });
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_OWNER_ASSIGNED",
      before: {owner_id: previousOwnerId},
      after: {owner_id: newOwnerId},
      reason,
    });

    return {success: true, locationId, ownerId: newOwnerId, changed: true};
  }
);

export const inviteLocationManager =
secureCallable<InviteLocationManagerRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locMgrInvite"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "inviteLocationManager",
      locationId: req.data?.locationId,
      managerUid: req.data?.managerUid,
      managerEmail: req.data?.managerEmail,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const managerUid = optionalTrimmed(request.data.managerUid, 128);
    const managerEmail = optionalEmail(request.data.managerEmail);
    if (!managerUid && !managerEmail) {
      throw new HttpsError(
        "invalid-argument",
        "managerUid or managerEmail is required"
      );
    }
    const {locRef, locData} = await getExistingLocation(locationId);
    assertAdminOrLocationOwner(request, locData);
    if (managerUid && managerUid === locData.owner_id) {
      throw new HttpsError("invalid-argument", "Owner cannot be invited as manager");
    }
    if (managerUid && Array.isArray(locData.managers) &&
      locData.managers.includes(managerUid)
    ) {
      return {success: true, locationId, inviteId: null, alreadyManager: true};
    }

    const inviteRef = locRef.collection("manager_invites").doc();
    await inviteRef.set({
      manager_uid: managerUid ?? null,
      manager_email: managerEmail,
      status: "PENDING",
      message: optionalTrimmed(request.data.message, 500),
      created_at: FieldValue.serverTimestamp(),
      created_by: request.auth.uid,
      expires_at: managerInviteExpiresAt(),
    });
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_MANAGER_INVITED",
      after: {
        invite_id: inviteRef.id,
        manager_uid: managerUid ?? null,
        manager_email: managerEmail,
      },
    });

    return {
      success: true,
      locationId,
      inviteId: inviteRef.id,
      alreadyManager: false,
    };
  }
);

export const acceptLocationManagerInvite =
secureCallable<AcceptLocationManagerInviteRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locMgrAccept"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "acceptLocationManagerInvite",
      locationId: req.data?.locationId,
      inviteId: req.data?.inviteId,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const inviteId = requireNonEmptyString(request.data.inviteId, "inviteId");
    const {locRef, locData} = await getExistingLocation(locationId);
    const inviteRef = locRef.collection("manager_invites").doc(inviteId);
    const inviteDoc = await inviteRef.get();
    if (!inviteDoc.exists) {
      throw new HttpsError("not-found", `Invite ${inviteId} not found`);
    }
    const inviteData = inviteDoc.data() || {};
    if (inviteData.status !== "PENDING") {
      throw new HttpsError("failed-precondition", "Invite is not pending");
    }
    const uidMatches = inviteData.manager_uid === request.auth.uid;
    const authEmail = typeof request.auth.token?.email === "string" ?
      request.auth.token.email.toLowerCase() :
      null;
    const emailMatches = Boolean(
      inviteData.manager_email && authEmail &&
      inviteData.manager_email === authEmail
    );
    if (!uidMatches && !emailMatches) {
      throw new HttpsError(
        "permission-denied",
        "Invite does not belong to this user"
      );
    }
    if (locData.owner_id === request.auth.uid) {
      throw new HttpsError("failed-precondition", "Owner is already the owner");
    }

    const batch = db().batch();
    batch.update(locRef, {
      managers: FieldValue.arrayUnion(request.auth.uid),
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    });
    batch.update(inviteRef, {
      status: "ACCEPTED",
      accepted_at: FieldValue.serverTimestamp(),
      accepted_by: request.auth.uid,
    });
    await batch.commit();
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_MANAGER_INVITE_ACCEPTED",
      after: {manager_uid: request.auth.uid, invite_id: inviteId},
    });

    return {success: true, locationId, managerUid: request.auth.uid};
  }
);

export const removeLocationManager =
secureCallable<RemoveLocationManagerRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locMgrRemove"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "removeLocationManager",
      locationId: req.data?.locationId,
      managerUid: req.data?.managerUid,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const managerUid = requireNonEmptyString(request.data.managerUid, "managerUid");
    const reason = optionalTrimmed(request.data.reason, 500);
    const {locRef, locData} = await getExistingLocation(locationId);
    assertAdminOrLocationOwner(request, locData);
    if (managerUid === locData.owner_id) {
      throw new HttpsError("invalid-argument", "Owner cannot be removed as manager");
    }

    await locRef.update({
      managers: FieldValue.arrayRemove(managerUid),
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    });
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_MANAGER_REMOVED",
      before: {manager_uid: managerUid},
      after: {manager_uid: null},
      reason,
    });

    return {success: true, locationId, managerUid};
  }
);
