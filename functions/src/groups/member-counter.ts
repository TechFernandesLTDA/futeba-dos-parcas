/**
 * Mantém `groups/{groupId}.member_count` por delta idempotente.
 *
 * O trigger é entregue at-least-once. Cada transição semântica grava, na mesma
 * transação do contador, um marcador determinístico pelo CloudEvent id. Assim,
 * retries não reaplicam o delta e eventos concorrentes serializam pelo group doc.
 */
import {logger} from "firebase-functions";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {FieldPath, FieldValue} from "firebase-admin/firestore";
import {db} from "../_db";

const ACTIVE_STATUSES = new Set(["ACTIVE"]);
const DEFAULT_RECONCILE_PAGE_SIZE = 250;
const MAX_RECONCILE_PAGE_SIZE = 500;
const EVENT_MARKER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface ReconcileOptions {
  dryRun?: boolean;
  pageSize?: number;
}

export interface MemberCountReconcileResult {
  groupId: string;
  groupExists: boolean;
  dryRun: boolean;
  pageSize: number;
  pages: number;
  scannedMembers: number;
  activeMembers: number;
  previousCount: number;
  drift: number;
  updated: boolean;
}

/**
 * Legacy member docs without status are active. Explicit non-ACTIVE statuses
 * (INACTIVE, REMOVED, PENDING, BANNED...) do not count.
 *
 * @param {Record<string, unknown> | undefined} data Member data
 * @return {boolean} Whether the member contributes to member_count
 */
export function isActiveMember(
  data: Record<string, unknown> | undefined,
): boolean {
  if (!data) return false;
  const status = data.status as string | undefined;
  return status ? ACTIVE_STATUSES.has(status) : true;
}

/**
 * @param {unknown} value Current denormalized member_count
 * @return {number} Safe non-negative integer
 */
function normalizeMemberCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/**
 * Authoritative, paginated reconciliation path for operational repair.
 * Defaults to dry-run and only writes when drift exists.
 *
 * @param {string} groupId Group id
 * @param {ReconcileOptions} options Reconciliation controls
 * @return {Promise<MemberCountReconcileResult>} Reconciliation report
 */
export async function reconcileGroupMemberCount(
  groupId: string,
  options: ReconcileOptions = {},
): Promise<MemberCountReconcileResult> {
  const dryRun = options.dryRun ?? true;
  const requestedPageSize = Math.trunc(
    options.pageSize ?? DEFAULT_RECONCILE_PAGE_SIZE,
  );
  const pageSize = Math.max(
    1,
    Math.min(MAX_RECONCILE_PAGE_SIZE, requestedPageSize || 1),
  );
  const firestore = db();
  const groupRef = firestore.doc(`groups/${groupId}`);

  try {
    const groupSnap = await groupRef.get();
    const previousCount = groupSnap.exists ?
      normalizeMemberCount(groupSnap.data()?.member_count) : 0;
    let activeMembers = 0;
    let scannedMembers = 0;
    let pages = 0;
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    if (groupSnap.exists) {
      const membersRef = groupRef.collection("members");
      while (true) {
        let pageQuery: FirebaseFirestore.Query = membersRef
          .orderBy(FieldPath.documentId())
          .limit(pageSize);
        if (cursor) pageQuery = pageQuery.startAfter(cursor);

        const page = await pageQuery.get();
        pages += 1;
        scannedMembers += page.size;
        activeMembers += page.docs.reduce((total, memberDoc) => {
          const member = memberDoc.data() as
            Record<string, unknown> | undefined;
          return total + (isActiveMember(member) ? 1 : 0);
        }, 0);

        if (page.size < pageSize) break;
        cursor = page.docs[page.docs.length - 1];
      }
    }

    const drift = activeMembers - previousCount;
    const updated = groupSnap.exists && !dryRun && drift !== 0;
    if (updated) {
      await groupRef.update({
        member_count: activeMembers,
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    const result: MemberCountReconcileResult = {
      groupId,
      groupExists: groupSnap.exists,
      dryRun,
      pageSize,
      pages,
      scannedMembers,
      activeMembers,
      previousCount,
      drift,
      updated,
    };
    logger.info("[MEMBER_COUNTER] reconciliation completed", result);
    return result;
  } catch (error) {
    logger.error("[MEMBER_COUNTER] reconciliation failed", {
      groupId,
      dryRun,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export const onMemberWritten = onDocumentWritten(
  {
    document: "groups/{groupId}/members/{memberId}",
    region: "southamerica-east1",
  },
  async (event) => {
    const groupId = event.params.groupId;
    const memberId = event.params.memberId;
    const eventId = event.id;
    const before = event.data?.before?.data() as
      Record<string, unknown> | undefined;
    const after = event.data?.after?.data() as
      Record<string, unknown> | undefined;
    const wasActive = isActiveMember(before);
    const isActive = isActiveMember(after);

    // join-requests increments the group atomically with member creation and
    // leaves this compatibility marker. Only that CREATE is already counted;
    // later ACTIVE <-> INACTIVE transitions must still apply their deltas.
    if (
      !before &&
      isActive &&
      after?._counted_by_join_request === true
    ) {
      logger.info("[MEMBER_COUNTER] create already counted upstream", {
        eventId,
        groupId,
        memberId,
      });
      return;
    }

    if (wasActive === isActive) {
      logger.debug("[MEMBER_COUNTER] irrelevant member update ignored", {
        eventId,
        groupId,
        memberId,
        active: isActive,
      });
      return;
    }

    if (!eventId) {
      const error = new Error("Member counter event is missing CloudEvent id");
      logger.error("[MEMBER_COUNTER] invalid event", {
        groupId,
        memberId,
        error: error.message,
      });
      throw error;
    }

    const delta = isActive ? 1 : -1;
    const reason = isActive ?
      (before ? "REACTIVATED" : "CREATE_ACTIVE") :
      (after ? "DEACTIVATED" : "DELETE_WAS_ACTIVE");
    const firestore = db();
    const groupRef = firestore.doc(`groups/${groupId}`);
    const markerRef = groupRef
      .collection("member_counter_events")
      .doc(encodeURIComponent(eventId));

    try {
      const outcome = await firestore.runTransaction(async (transaction) => {
        const markerSnap = await transaction.get(markerRef);
        if (markerSnap.exists) return "DUPLICATE" as const;

        const groupSnap = await transaction.get(groupRef);
        if (!groupSnap.exists) return "GROUP_MISSING" as const;

        const currentCount = normalizeMemberCount(
          groupSnap.data()?.member_count,
        );
        const nextCount = Math.max(0, currentCount + delta);
        transaction.update(groupRef, {
          member_count: nextCount,
          updated_at: FieldValue.serverTimestamp(),
        });
        transaction.create(markerRef, {
          event_id: eventId,
          member_id: memberId,
          delta,
          reason,
          processed_at: FieldValue.serverTimestamp(),
          expires_at: new Date(Date.now() + EVENT_MARKER_TTL_MS),
        });
        return {currentCount, nextCount};
      });

      if (outcome === "DUPLICATE") {
        logger.info("[MEMBER_COUNTER] duplicate event ignored", {
          eventId,
          groupId,
          memberId,
          delta,
          reason,
        });
        return;
      }
      if (outcome === "GROUP_MISSING") {
        logger.warn("[MEMBER_COUNTER] group missing; delta skipped", {
          eventId,
          groupId,
          memberId,
          delta,
          reason,
        });
        return;
      }

      logger.info("[MEMBER_COUNTER] delta applied", {
        eventId,
        groupId,
        memberId,
        delta,
        reason,
        previousCount: outcome.currentCount,
        memberCount: outcome.nextCount,
      });
    } catch (error) {
      logger.error("[MEMBER_COUNTER] delta transaction failed", {
        eventId,
        groupId,
        memberId,
        delta,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      // Throwing keeps the Firestore event retriable. Marker and counter are in
      // one transaction, so a retry cannot observe a partial application.
      throw error;
    }
  },
);
