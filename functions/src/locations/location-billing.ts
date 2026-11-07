import {FieldPath, FieldValue} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {db} from "../_db";
import {ERROR_MSGS} from "../error-messages";
import {
  isContractExpired,
  isTrialAged,
  resolveSubscriptionStatusOrDefault,
} from "./venue-account-shared";
import {
  assertAdmin,
  assertAdminOrLocationOwnerForReceipt,
  BILLING_AUTOMATION_ID_LIST_CAP,
  BILLING_AUTOMATION_MAX_RUN_MS,
  BILLING_AUTOMATION_RUNS_COLLECTION,
  BILLING_CYCLES,
  BILLING_PLAN_CODES,
  BILLING_SUMMARY_PAGE_SIZE,
  BILLING_SUMMARY_PAYMENT_CONCURRENCY,
  billingPeriodKeyForDate,
  buildBillingCycleDates,
  chunkArray,
  createSubscriptionLedgerRef,
  currentBillingPeriodKey,
  GetAdminLocationBillingSummaryRequest,
  getExistingLocation,
  LocationBillingAutomationResult,
  optionalTrimmed,
  parseOptionalIsoDate,
  positiveCents,
  pushBoundedLocationId,
  RegisterLocationSubscriptionPaymentRequest,
  requireEnum,
  requireLocationReceiptStoragePath,
  requireNonEmptyString,
  requirePeriodKey,
  ReviewLocationSubscriptionReceiptRequest,
  RunLocationBillingAutomationRequest,
  SetLocationSubscriptionRequest,
  SubmitLocationSubscriptionReceiptRequest,
  SUBSCRIPTION_STATUSES,
  toIsoString,
  VenueAccountRowProjection,
  writeLocationCommercialEvent,
} from "./location-types-helpers";

/**
 * Soma pagamentos aprovados de uma quadra para o periodo.
 * @param {string} locationId ID da location.
 * @param {string} periodKey Periodo AAAA-MM.
 * @return {Promise<number>} Total aprovado em centavos.
 */
async function sumApprovedSubscriptionPayments(
  locationId: string,
  periodKey: string
): Promise<number> {
  const paymentsSnapshot = await db()
    .collection("locations")
    .doc(locationId)
    .collection("subscription_payments")
    .where("period_key", "==", periodKey)
    .get();
  let paidCents = 0;
  for (const paymentDoc of paymentsSnapshot.docs) {
    const payment = paymentDoc.data() || {};
    const reviewStatus = payment.review_status || payment.status;
    if (reviewStatus === "APPROVED") {
      paidCents += positiveCents(payment.amount_cents);
    }
  }
  return paidCents;
}

/**
 * Calcula status da assinatura apos registrar/aprovar pagamento.
 * @param {object} params Dados do periodo e da location.
 * @return {Promise<object>} Status e saldo recomputados.
 */
async function resolveSubscriptionStatusAfterApprovedPayment(params: {
  locationId: string;
  periodKey: string | null;
  monthlyFeeCents: number;
  newlyApprovedAmountCents: number;
  currentSubscriptionStatus: unknown;
  currentCommercialStatus: unknown;
  billingExpiresAt?: unknown;
  alreadyApprovedCents?: number;
  now?: Date;
}): Promise<{
  paidCents: number | null;
  openBalanceCents: number | null;
  subscriptionStatus: string | null;
  commercialStatus: string | null;
}> {
  const currentSubscriptionStatus =
    typeof params.currentSubscriptionStatus === "string" ?
      params.currentSubscriptionStatus :
      null;
  const currentCommercialStatus =
    typeof params.currentCommercialStatus === "string" ?
      params.currentCommercialStatus :
      currentSubscriptionStatus;
  // #4107: pagamento aprovado NAO reativa contrato vencido. O estado
  // consistente com o cron (que encerra contratos expirados como CANCELLED)
  // e devolver CANCELLED: o valor pago fica registrado no ledger/pagamentos,
  // mas a quadra nao volta a ACTIVE ate um admin renovar `billing_expires_at`.
  const contractExpired = isContractExpired(
    params.billingExpiresAt,
    params.now || new Date()
  );
  const reactivatedStatus = contractExpired ? "CANCELLED" : "ACTIVE";
  if (!params.periodKey || params.monthlyFeeCents <= 0) {
    return {
      paidCents: null,
      openBalanceCents: null,
      subscriptionStatus: reactivatedStatus,
      commercialStatus: reactivatedStatus,
    };
  }

  const alreadyApprovedCents = typeof params.alreadyApprovedCents === "number" ?
    params.alreadyApprovedCents :
    await sumApprovedSubscriptionPayments(
      params.locationId,
      params.periodKey
    );
  const paidCents = alreadyApprovedCents + params.newlyApprovedAmountCents;
  const openBalanceCents = Math.max(params.monthlyFeeCents - paidCents, 0);
  if (openBalanceCents <= 0) {
    return {
      paidCents,
      openBalanceCents,
      subscriptionStatus: reactivatedStatus,
      commercialStatus: reactivatedStatus,
    };
  }

  return {
    paidCents,
    openBalanceCents,
    subscriptionStatus: contractExpired ? "CANCELLED" : currentSubscriptionStatus,
    commercialStatus: contractExpired ? "CANCELLED" : currentCommercialStatus,
  };
}

/**
 * Carrega todas as quadras paginando por documentId para nao truncar MRR.
 * @return {Promise<Array<FirebaseFirestore.QueryDocumentSnapshot>>} Docs.
 */
async function fetchAllBillingSummaryLocationDocs(): Promise<
  Array<FirebaseFirestore.QueryDocumentSnapshot>
  > {
  const docs: Array<FirebaseFirestore.QueryDocumentSnapshot> = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let query: FirebaseFirestore.Query = db()
      .collection("locations")
      .orderBy(FieldPath.documentId())
      .limit(BILLING_SUMMARY_PAGE_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snapshot = await query.get();
    docs.push(...snapshot.docs);
    if (snapshot.size < BILLING_SUMMARY_PAGE_SIZE) {
      break;
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    if (!lastDoc) {
      break;
    }
  }

  return docs;
}

/**
 * Soma pagamentos do periodo filtrando no Firestore e limitando ao ciclo.
 * @param {string} locationId ID da quadra.
 * @param {string} periodKey Periodo AAAA-MM.
 * @param {number} monthlyFeeCents Mensalidade esperada.
 * @return {Promise<object>} Totais do periodo.
 */
async function getBillingSummaryPaymentTotals(
  locationId: string,
  periodKey: string,
  monthlyFeeCents: number
) {
  const paymentsSnapshot = await db()
    .collection("locations")
    .doc(locationId)
    .collection("subscription_payments")
    .where("period_key", "==", periodKey)
    .get();

  let approvedCents = 0;
  let pendingReceiptCount = 0;
  let lastPaymentAtIso: string | null = null;
  for (const paymentDoc of paymentsSnapshot.docs) {
    const payment = paymentDoc.data() || {};
    const reviewStatus = payment.review_status || payment.status;
    if (reviewStatus === "APPROVED") {
      approvedCents += positiveCents(payment.amount_cents);
      const paidAtIso = toIsoString(payment.paid_at);
      if (paidAtIso && (!lastPaymentAtIso || paidAtIso > lastPaymentAtIso)) {
        lastPaymentAtIso = paidAtIso;
      }
    } else if (reviewStatus === "PENDING_REVIEW") {
      pendingReceiptCount += 1;
    }
  }

  return {
    receivedCents: monthlyFeeCents > 0 ?
      Math.min(approvedCents, monthlyFeeCents) :
      0,
    pendingReceiptCount,
    lastPaymentAtIso,
  };
}

/**
 * Processa ciclos mensais de cobranca de quadras.
 * @param {object} params Parametros opcionais de execucao.
 * @return {Promise<LocationBillingAutomationResult>} Resultado consolidado.
 */
export async function processLocationBillingAutomation(params?: {
  periodKey?: string | null;
  now?: Date;
  actorUserId?: string;
  maxRunMs?: number;
  clockMs?: () => number;
}): Promise<LocationBillingAutomationResult> {
  const now = params?.now || new Date();
  const periodKey = params?.periodKey ?
    requirePeriodKey(params.periodKey) :
    billingPeriodKeyForDate(now);
  const actorUserId = params?.actorUserId || "system:billing-automation";
  const clockMs = params?.clockMs || (() => Date.now());
  const maxRunMs = Number.isInteger(params?.maxRunMs) &&
    (params?.maxRunMs as number) > 0 ?
    (params!.maxRunMs as number) :
    BILLING_AUTOMATION_MAX_RUN_MS;

  // ID de execucao: sortable e deterministico para o mesmo `now` (testes).
  const runId = `${periodKey}_${now.toISOString().replace(/[:.]/g, "-")}`;
  const result: LocationBillingAutomationResult = {
    runId,
    periodKey,
    processedLocations: 0,
    skippedLocations: 0,
    paidLocations: 0,
    partialLocations: 0,
    pendingLocations: 0,
    overdueLocations: 0,
    suspendedLocations: 0,
    reactivatedLocations: 0,
    inconsistentLocations: 0,
    expiredLocations: 0,
    agedTrialLocations: 0,
    ledgerEntriesCreated: 0,
    skippedLocationIds: [],
    inconsistentLocationIds: [],
    expiredLocationIds: [],
    agedTrialLocationIds: [],
    resumedFromLocationId: null,
    nextCursor: null,
    budgetExhausted: false,
  };

  const cursorRef = db()
    .collection("billing_automation_state")
    .doc(periodKey);
  const cursorDoc = await cursorRef.get();
  const cursorData = (cursorDoc.data && cursorDoc.data()) || {};
  const resumedFromLocationId =
    typeof cursorData.last_location_id === "string" &&
    cursorData.last_location_id ?
      cursorData.last_location_id :
      null;
  result.resumedFromLocationId = resumedFromLocationId;

  const runStartedAt = clockMs();
  let lastVisitedId = resumedFromLocationId;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  paging: while (true) {
    let query: FirebaseFirestore.Query = db()
      .collection("locations")
      .orderBy(FieldPath.documentId())
      .limit(BILLING_SUMMARY_PAGE_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    } else if (resumedFromLocationId) {
      query = query.startAfter(resumedFromLocationId);
    }
    const snapshot = await query.get();
    if (snapshot.size === 0) {
      break;
    }

    for (const doc of snapshot.docs) {
      if (clockMs() - runStartedAt >= maxRunMs) {
        const budgetExhaustedAt = clockMs();
        result.budgetExhausted = true;
        result.nextCursor = lastVisitedId;
        await cursorRef.set({
          period_key: periodKey,
          last_location_id: lastVisitedId,
          updated_at: FieldValue.serverTimestamp(),
        });
        logger.info("Location billing automation budget exhausted", {
          periodKey,
          resumedFromLocationId,
          nextCursor: result.nextCursor,
          budgetExhaustedAt,
          processedLocations: result.processedLocations,
        });
        break paging;
      }

      const locationId = doc.id || doc.ref?.id;
      const locData = doc.data() || {};
      if (!locationId) {
        result.skippedLocations += 1;
        continue;
      }
      lastVisitedId = locationId;

      // #4111: default unico fail-closed compartilhado com resolver/painel.
      const subscriptionStatus = resolveSubscriptionStatusOrDefault(
        locData.subscription_status
      );
      if (subscriptionStatus === "CANCELLED") {
        result.skippedLocations += 1;
        pushBoundedLocationId(result.skippedLocationIds, locationId);
        continue;
      }
      if (subscriptionStatus === "TRIAL") {
        // FIX #3953: TRIAL nao gera ciclo nem suspende. #4111: mas precisa
        // envelhecer — primeira observacao sem `trial_started_at` grava o
        // relogio (backfill = agora) e trials acima de TRIAL_MAX_DAYS sao
        // registrados no doc de execucao para virarem pendencia.
        result.skippedLocations += 1;
        pushBoundedLocationId(result.skippedLocationIds, locationId);
        if (!locData.trial_started_at) {
          await doc.ref.update({
            trial_started_at: now,
            updated_at: FieldValue.serverTimestamp(),
            updated_by: actorUserId,
          });
        } else if (isTrialAged(locData.trial_started_at, now)) {
          result.agedTrialLocations += 1;
          pushBoundedLocationId(result.agedTrialLocationIds, locationId);
        }
        continue;
      }

      const billingStartsAtIso = toIsoString(locData.billing_starts_at);
      if (billingStartsAtIso && new Date(billingStartsAtIso).getTime() > now.getTime()) {
        result.skippedLocations += 1;
        pushBoundedLocationId(result.skippedLocationIds, locationId);
        continue;
      }

      // #4107: guarda simetrica a `billing_starts_at`. Contrato com
      // `billing_expires_at` no passado esta encerrado: nao gera ciclo, nao
      // cobra e transiciona (uma unica vez — CANCELLED ja foi pulado acima)
      // para CANCELLED com ledger e evento proprios.
      if (isContractExpired(locData.billing_expires_at, now)) {
        result.expiredLocations += 1;
        pushBoundedLocationId(result.expiredLocationIds, locationId);
        const expiredBatch = db().batch();
        expiredBatch.update(doc.ref, {
          subscription_status: "CANCELLED",
          commercial_status: "CANCELLED",
          updated_at: FieldValue.serverTimestamp(),
          updated_by: actorUserId,
        });
        const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
          locationId,
          {
            type: "BILLING_AUTOMATION_CONTRACT_EXPIRED",
            actor_user_id: actorUserId,
            period_key: periodKey,
            previous_subscription_status: subscriptionStatus,
            next_subscription_status: "CANCELLED",
            previous_commercial_status: locData.commercial_status ?? null,
            next_commercial_status: "CANCELLED",
            reason: `Automacao mensal ${periodKey}: contrato expirado em ` +
              `${toIsoString(locData.billing_expires_at)}`,
            effective_at: now,
          }
        );
        expiredBatch.set(ledgerRef, ledgerData);
        await expiredBatch.commit();
        result.ledgerEntriesCreated += 1;
        await writeLocationCommercialEvent({
          locationId,
          actorUserId,
          type: "LOCATION_BILLING_AUTOMATION_STATUS_CHANGED",
          before: {
            subscription_status: subscriptionStatus,
            commercial_status: locData.commercial_status ?? null,
          },
          after: {
            subscription_status: "CANCELLED",
            commercial_status: "CANCELLED",
            billing_expires_at_iso: toIsoString(locData.billing_expires_at),
            period_key: periodKey,
          },
          reason: `Automacao mensal ${periodKey}: contrato expirado`,
        });
        continue;
      }

      const ownerId = typeof locData.owner_id === "string" ?
        locData.owner_id :
        null;
      const monthlyFeeCents = positiveCents(locData.monthly_fee_cents);
      const billingDueDay = Number.isInteger(locData.billing_due_day) ?
        Number(locData.billing_due_day) :
        null;
      if (!ownerId || monthlyFeeCents <= 0 || !billingDueDay) {
        // #4111: quadra que nunca entra no laco e impossivel de cobrar.
        // Fica registrada por ID no doc de execucao e gera alerta.
        result.inconsistentLocations += 1;
        pushBoundedLocationId(result.inconsistentLocationIds, locationId);
        continue;
      }

      const paidCents = await sumApprovedSubscriptionPayments(locationId, periodKey);
      const openBalanceCents = Math.max(monthlyFeeCents - paidCents, 0);
      const cycleDates = buildBillingCycleDates(
        periodKey,
        billingDueDay,
        locData.billing_grace_days,
        locData.billing_suspension_days
      );

      let cycleStatus: "PAID" | "PARTIAL" | "PENDING" | "OVERDUE" | "SUSPENDED";
      if (openBalanceCents <= 0) {
        cycleStatus = "PAID";
        result.paidLocations += 1;
      } else if (now.getTime() >= cycleDates.suspendAt.getTime()) {
        cycleStatus = "SUSPENDED";
        result.suspendedLocations += 1;
      } else if (now.getTime() >= cycleDates.graceEndsAt.getTime()) {
        cycleStatus = "OVERDUE";
        result.overdueLocations += 1;
      } else if (paidCents > 0) {
        cycleStatus = "PARTIAL";
        result.partialLocations += 1;
      } else {
        cycleStatus = "PENDING";
        result.pendingLocations += 1;
      }

      let nextSubscriptionStatus = subscriptionStatus;
      if (cycleStatus === "PAID") {
        nextSubscriptionStatus = "ACTIVE";
      } else if (cycleStatus === "OVERDUE") {
        nextSubscriptionStatus = "OVERDUE";
      } else if (cycleStatus === "SUSPENDED") {
        nextSubscriptionStatus = "SUSPENDED";
      }

      const locRef = doc.ref;
      const cycleRef = locRef.collection("subscription_cycles").doc(periodKey);
      const batch = db().batch();
      const statusChanged = nextSubscriptionStatus !== subscriptionStatus ||
        locData.commercial_status !== nextSubscriptionStatus;
      const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        current_billing_period_key: periodKey,
        current_billing_cycle_status: cycleStatus,
        current_billing_paid_cents: paidCents,
        current_billing_open_balance_cents: openBalanceCents,
        billing_due_at: cycleDates.dueAt,
        billing_grace_ends_at: cycleDates.graceEndsAt,
        billing_suspend_at: cycleDates.suspendAt,
        updated_at: FieldValue.serverTimestamp(),
        updated_by: actorUserId,
      };
      if (statusChanged) {
        update.subscription_status = nextSubscriptionStatus;
        update.commercial_status = nextSubscriptionStatus;
      }

      batch.set(cycleRef, {
        period_key: periodKey,
        location_id: locationId,
        owner_id: ownerId,
        amount_cents: monthlyFeeCents,
        paid_cents: paidCents,
        open_balance_cents: openBalanceCents,
        billing_due_day: billingDueDay,
        due_at: cycleDates.dueAt,
        grace_ends_at: cycleDates.graceEndsAt,
        suspend_at: cycleDates.suspendAt,
        grace_days: cycleDates.graceDays,
        suspension_days: cycleDates.suspensionDays,
        status: cycleStatus,
        previous_status: locData.current_billing_cycle_status || null,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        processed_at: FieldValue.serverTimestamp(),
      }, {merge: true});
      batch.update(locRef, update);

      let ledgerType: string | null = null;
      if (statusChanged) {
        if (cycleStatus === "PAID") {
          ledgerType = "BILLING_AUTOMATION_REACTIVATED";
          result.reactivatedLocations += 1;
        } else if (cycleStatus === "OVERDUE") {
          ledgerType = "BILLING_AUTOMATION_OVERDUE";
        } else if (cycleStatus === "SUSPENDED") {
          ledgerType = "BILLING_AUTOMATION_SUSPENDED";
        }
      }

      if (ledgerType) {
        const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
          locationId,
          {
            type: ledgerType,
            actor_user_id: actorUserId,
            amount_cents: openBalanceCents,
            period_key: periodKey,
            previous_subscription_status: subscriptionStatus,
            next_subscription_status: nextSubscriptionStatus,
            previous_commercial_status: locData.commercial_status ?? null,
            next_commercial_status: nextSubscriptionStatus,
            billing_due_day: billingDueDay,
            reason: `Automacao mensal ${periodKey}: ${cycleStatus}`,
            effective_at: now,
          }
        );
        batch.set(ledgerRef, ledgerData);
        result.ledgerEntriesCreated += 1;
      }

      await batch.commit();
      if (statusChanged) {
        await writeLocationCommercialEvent({
          locationId,
          actorUserId,
          type: "LOCATION_BILLING_AUTOMATION_STATUS_CHANGED",
          before: {
            subscription_status: subscriptionStatus,
            commercial_status: locData.commercial_status ?? null,
          },
          after: {
            subscription_status: nextSubscriptionStatus,
            commercial_status: nextSubscriptionStatus,
            billing_cycle_status: cycleStatus,
            open_balance_cents: openBalanceCents,
            period_key: periodKey,
          },
          reason: `Automacao mensal ${periodKey}`,
        });
      }

      result.processedLocations += 1;
    }

    if (snapshot.size < BILLING_SUMMARY_PAGE_SIZE) {
      break;
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    if (!lastDoc) {
      break;
    }
  }

  if (!result.budgetExhausted) {
    await cursorRef.delete();
    logger.info("Location billing automation finished", {
      ...result,
      resumedFromLocationId,
    });
  }

  await persistBillingAutomationRun(result, now, actorUserId);

  return result;
}

/**
 * Persiste um doc por execucao do cron em `billing_automation_runs` (#4111)
 * com contadores + listas de IDs, para que quadras descartadas por
 * `continue` deixem rastro consultavel (admin e monitoring/alerting.ts).
 * Falha de persistencia nao derruba o cron: e observabilidade, nao cobranca.
 * @param {LocationBillingAutomationResult} result Resultado consolidado.
 * @param {Date} now Instante de referencia da execucao.
 * @param {string} actorUserId Ator (sistema ou admin).
 * @return {Promise<void>} Promise resolvida apos tentativa de gravacao.
 */
async function persistBillingAutomationRun(
  result: LocationBillingAutomationResult,
  now: Date,
  actorUserId: string
): Promise<void> {
  try {
    await db()
      .collection(BILLING_AUTOMATION_RUNS_COLLECTION)
      .doc(result.runId)
      .set({
        run_id: result.runId,
        period_key: result.periodKey,
        actor_user_id: actorUserId,
        started_at: now,
        finished_at: FieldValue.serverTimestamp(),
        processed_locations: result.processedLocations,
        skipped_locations: result.skippedLocations,
        paid_locations: result.paidLocations,
        partial_locations: result.partialLocations,
        pending_locations: result.pendingLocations,
        overdue_locations: result.overdueLocations,
        suspended_locations: result.suspendedLocations,
        reactivated_locations: result.reactivatedLocations,
        inconsistent_locations: result.inconsistentLocations,
        expired_locations: result.expiredLocations,
        aged_trial_locations: result.agedTrialLocations,
        ledger_entries_created: result.ledgerEntriesCreated,
        skipped_location_ids: result.skippedLocationIds,
        inconsistent_location_ids: result.inconsistentLocationIds,
        expired_location_ids: result.expiredLocationIds,
        aged_trial_location_ids: result.agedTrialLocationIds,
        id_list_cap: BILLING_AUTOMATION_ID_LIST_CAP,
        resumed_from_location_id: result.resumedFromLocationId,
        next_cursor: result.nextCursor,
        budget_exhausted: result.budgetExhausted,
        created_at: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    logger.error("Location billing automation run doc failed", {
      runId: result.runId,
      periodKey: result.periodKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const runLocationBillingAutomation =
secureCallable<RunLocationBillingAutomationRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 5, windowMs: 60000, keyPrefix: "locBillAuto"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "runLocationBillingAutomation",
      periodKey: req.data?.periodKey ?? null,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const periodKey = request.data?.periodKey ?
      requirePeriodKey(request.data.periodKey) :
      null;
    return processLocationBillingAutomation({
      periodKey,
      actorUserId: request.auth.uid,
    });
  }
);

export const processLocationBillingCycles = onSchedule(
  {
    schedule: "every day 04:20",
    timeZone: "America/Sao_Paulo",
    memory: "512MiB",
    timeoutSeconds: 540,
    retryCount: 3,
    maxRetrySeconds: 300,
  },
  async () => {
    const result = await processLocationBillingAutomation();
    logger.info("Location billing automation finished", result);
  }
);

export const getAdminLocationBillingSummary =
secureCallable<GetAdminLocationBillingSummaryRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    consumeAppCheckToken: false,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 30, windowMs: 60000, keyPrefix: "locBillSum"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "getAdminLocationBillingSummary",
      periodKey: req.data?.periodKey ?? null,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const periodKey = request.data?.periodKey ?
      requirePeriodKey(request.data.periodKey) :
      currentBillingPeriodKey();
    const locationDocs = await fetchAllBillingSummaryLocationDocs();
    const summary = {
      expectedMrrCents: 0,
      receivedCents: 0,
      overdueCents: 0,
      trialCents: 0,
      suspendedCents: 0,
      activeLocations: 0,
      trialLocations: 0,
      overdueLocations: 0,
      suspendedLocations: 0,
      cancelledLocations: 0,
      pendingReceiptLocations: 0,
    };
    const rows = [];

    for (const docChunk of chunkArray(
      locationDocs,
      BILLING_SUMMARY_PAYMENT_CONCURRENCY
    )) {
      const chunkRows = await Promise.all(docChunk.map(async (doc) => {
        const locData = doc.data() || {};
        const locationId = doc.id || doc.ref?.id;
        if (!locationId) return null;
        // #4111: default unico fail-closed compartilhado com cron/resolver.
        const subscriptionStatus = resolveSubscriptionStatusOrDefault(
          locData.subscription_status
        );
        const publicationStatus =
          typeof locData.publication_status === "string" ?
            locData.publication_status :
            (locData.is_verified === true ? "PUBLISHED" : "PENDING_REVIEW");
        const monthlyFeeCents = positiveCents(locData.monthly_fee_cents);
        const expectedCents = ["ACTIVE", "OVERDUE"].includes(subscriptionStatus) ?
          monthlyFeeCents :
          0;
        const paymentTotals = await getBillingSummaryPaymentTotals(
          locationId,
          periodKey,
          monthlyFeeCents
        );
        const venueAccountProjection: VenueAccountRowProjection = {
          venueAccountId: typeof locData.venue_account_id === "string" ?
            locData.venue_account_id :
            null,
          venueAccountStatus: typeof locData.venue_account_status === "string" ?
            locData.venue_account_status :
            null,
          venueAccountChargeScope:
            typeof locData.venue_account_charge_scope === "string" ?
              locData.venue_account_charge_scope :
              null,
          venueAccountPlanCode: typeof locData.venue_account_plan_code === "string" ?
            locData.venue_account_plan_code :
            null,
          venueAccountPlanLabel:
            typeof locData.venue_account_plan_label === "string" ?
              locData.venue_account_plan_label :
              null,
          venueAccountMonthlyTotalCents:
            Number.isInteger(locData.venue_account_monthly_total_cents) ?
              Number(locData.venue_account_monthly_total_cents) :
              null,
          venueAccountLinkedLocationsCount:
            Number.isInteger(locData.venue_account_linked_locations_count) ?
              Number(locData.venue_account_linked_locations_count) :
              null,
          venueAccountActiveFieldsCount:
            Number.isInteger(locData.venue_account_active_fields_count) ?
              Number(locData.venue_account_active_fields_count) :
              null,
        };

        return {
          row: {
            id: locationId,
            name: typeof locData.name === "string" ? locData.name : locationId,
            ownerId: typeof locData.owner_id === "string" ?
              locData.owner_id :
              null,
            city: typeof locData.city === "string" ? locData.city : null,
            state: typeof locData.state === "string" ? locData.state : null,
            publicationStatus,
            subscriptionStatus,
            billingPlanCode: typeof locData.billing_plan_code === "string" ?
              locData.billing_plan_code :
              null,
            billingPlanLabel: typeof locData.billing_plan_label === "string" ?
              locData.billing_plan_label :
              null,
            billingCycle: typeof locData.billing_cycle === "string" ?
              locData.billing_cycle :
              null,
            billingBaseFeeCents:
              Number.isInteger(locData.billing_base_fee_cents) &&
              Number(locData.billing_base_fee_cents) >= 0 ?
                Number(locData.billing_base_fee_cents) :
                null,
            monthlyFeeCents,
            billingDueDay: Number.isInteger(locData.billing_due_day) ?
              Number(locData.billing_due_day) :
              null,
            billingStartsAtIso: toIsoString(locData.billing_starts_at),
            billingExpiresAtIso: toIsoString(locData.billing_expires_at),
            trialStartedAtIso: toIsoString(locData.trial_started_at),
            expectedCents,
            receivedCents: paymentTotals.receivedCents,
            openBalanceCents: Math.max(
              monthlyFeeCents - paymentTotals.receivedCents,
              0
            ),
            billingExceptionNote: typeof locData.billing_exception_note === "string" ?
              locData.billing_exception_note :
              null,
            currentBillingCycleStatus:
              typeof locData.current_billing_cycle_status === "string" ?
                locData.current_billing_cycle_status :
                null,
            currentBillingPaidCents: positiveCents(
              locData.current_billing_paid_cents
            ),
            currentBillingOpenBalanceCents: positiveCents(
              locData.current_billing_open_balance_cents
            ),
            billingDueAtIso: toIsoString(locData.billing_due_at),
            billingGraceEndsAtIso: toIsoString(locData.billing_grace_ends_at),
            billingSuspendAtIso: toIsoString(locData.billing_suspend_at),
            pendingReceiptCount: paymentTotals.pendingReceiptCount,
            lastPaymentAtIso: paymentTotals.lastPaymentAtIso,
            updatedAtIso: toIsoString(locData.updated_at),
            ...venueAccountProjection,
          },
          subscriptionStatus,
          monthlyFeeCents,
          receivedCents: paymentTotals.receivedCents,
          pendingReceiptCount: paymentTotals.pendingReceiptCount,
        };
      }));

      for (const item of chunkRows) {
        if (!item) continue;
        const {
          subscriptionStatus,
          monthlyFeeCents,
          receivedCents,
          pendingReceiptCount,
        } = item;
        if (subscriptionStatus === "ACTIVE") {
          summary.activeLocations += 1;
          summary.expectedMrrCents += monthlyFeeCents;
        } else if (subscriptionStatus === "TRIAL") {
          summary.trialLocations += 1;
          summary.trialCents += monthlyFeeCents;
        } else if (subscriptionStatus === "OVERDUE") {
          summary.overdueLocations += 1;
          summary.expectedMrrCents += monthlyFeeCents;
          summary.overdueCents += monthlyFeeCents;
        } else if (subscriptionStatus === "SUSPENDED") {
          summary.suspendedLocations += 1;
          summary.suspendedCents += monthlyFeeCents;
        } else if (subscriptionStatus === "CANCELLED") {
          summary.cancelledLocations += 1;
        }
        summary.receivedCents += receivedCents;
        if (pendingReceiptCount > 0) {
          summary.pendingReceiptLocations += 1;
        }
        rows.push(item.row);
      }
    }

    return {
      periodKey,
      generatedAtIso: new Date().toISOString(),
      scannedLocations: locationDocs.length,
      scanLimit: BILLING_SUMMARY_PAGE_SIZE,
      scanComplete: true,
      summary,
      locations: rows,
    };
  }
);

export const setLocationSubscription =
secureCallable<SetLocationSubscriptionRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locSub"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "setLocationSubscription",
      locationId: req.data?.locationId,
      subscriptionStatus: req.data?.subscriptionStatus,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const subscriptionStatus = requireEnum(
      request.data.subscriptionStatus,
      SUBSCRIPTION_STATUSES,
      "subscriptionStatus"
    );
    const hasBillingPlanCode = request.data.billingPlanCode !== undefined;
    const hasBillingPlanLabel = request.data.billingPlanLabel !== undefined;
    const hasBillingCycle = request.data.billingCycle !== undefined;
    const hasBillingBaseFee = request.data.billingBaseFeeCents !== undefined;
    const hasMonthlyFee = request.data.monthlyFeeCents !== undefined;
    const hasBillingDueDay = request.data.billingDueDay !== undefined;
    const hasBillingStartsAt = request.data.billingStartsAtIso !== undefined;
    const hasBillingExpiresAt = request.data.billingExpiresAtIso !== undefined;
    const hasBillingExceptionNote = request.data.billingExceptionNote !== undefined;
    const hasAdminNotes = request.data.adminNotes !== undefined;
    const {locRef, locData} = await getExistingLocation(locationId);
    const billingPlanCode = hasBillingPlanCode ?
      (request.data.billingPlanCode === null ?
        null :
        requireEnum(
          request.data.billingPlanCode,
          BILLING_PLAN_CODES,
          "billingPlanCode"
        )) :
      (typeof locData.billing_plan_code === "string" ?
        locData.billing_plan_code :
        null);
    const billingPlanLabel = hasBillingPlanLabel ?
      optionalTrimmed(request.data.billingPlanLabel, 120) :
      (typeof locData.billing_plan_label === "string" ?
        locData.billing_plan_label :
        null);
    const billingCycle = hasBillingCycle ?
      (request.data.billingCycle === null ?
        null :
        requireEnum(
          request.data.billingCycle,
          BILLING_CYCLES,
          "billingCycle"
        )) :
      (typeof locData.billing_cycle === "string" ?
        locData.billing_cycle :
        null);
    const billingBaseFeeCents = hasBillingBaseFee ?
      request.data.billingBaseFeeCents ?? null :
      locData.billing_base_fee_cents ?? null;
    const monthlyFeeCents = hasMonthlyFee ?
      request.data.monthlyFeeCents ?? null :
      locData.monthly_fee_cents ?? null;
    const billingDueDay = hasBillingDueDay ?
      request.data.billingDueDay ?? null :
      locData.billing_due_day ?? null;

    if (billingBaseFeeCents !== null &&
      (!Number.isInteger(billingBaseFeeCents) || billingBaseFeeCents < 0)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "billingBaseFeeCents must be >= 0"
      );
    }
    if (monthlyFeeCents !== null &&
      (!Number.isInteger(monthlyFeeCents) || monthlyFeeCents < 0)
    ) {
      throw new HttpsError("invalid-argument", "monthlyFeeCents must be >= 0");
    }
    if (billingDueDay !== null &&
      (!Number.isInteger(billingDueDay) || billingDueDay < 1 || billingDueDay > 31)
    ) {
      throw new HttpsError("invalid-argument", "billingDueDay must be 1-31");
    }

    const billingStartsAt = hasBillingStartsAt ?
      parseOptionalIsoDate(request.data.billingStartsAtIso, "billingStartsAtIso") :
      locData.billing_starts_at ?? null;
    const billingExpiresAt = hasBillingExpiresAt ?
      parseOptionalIsoDate(
        request.data.billingExpiresAtIso,
        "billingExpiresAtIso"
      ) :
      locData.billing_expires_at ?? null;
    if (billingStartsAt && billingExpiresAt && billingStartsAt > billingExpiresAt) {
      throw new HttpsError(
        "invalid-argument",
        "billingStartsAtIso must be <= billingExpiresAtIso"
      );
    }
    const billingExceptionNote = hasBillingExceptionNote ?
      optionalTrimmed(request.data.billingExceptionNote, 1000) :
      (typeof locData.billing_exception_note === "string" ?
        locData.billing_exception_note :
        null);
    const adminNotes = hasAdminNotes ?
      optionalTrimmed(request.data.adminNotes, 2000) :
      null;
    const before = {
      subscription_status: locData.subscription_status ?? null,
      commercial_status: locData.commercial_status ?? null,
      billing_plan_code: locData.billing_plan_code ?? null,
      billing_plan_label: locData.billing_plan_label ?? null,
      billing_cycle: locData.billing_cycle ?? null,
      billing_base_fee_cents: locData.billing_base_fee_cents ?? null,
      monthly_fee_cents: locData.monthly_fee_cents ?? null,
      billing_due_day: locData.billing_due_day ?? null,
      billing_starts_at: locData.billing_starts_at ?? null,
      billing_expires_at: locData.billing_expires_at ?? null,
      billing_exception_note: locData.billing_exception_note ?? null,
      admin_notes: locData.admin_notes ?? null,
      trial_started_at: locData.trial_started_at ?? null,
    };
    const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      subscription_status: subscriptionStatus,
      commercial_status: subscriptionStatus,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    };
    if (hasBillingPlanCode) update.billing_plan_code = billingPlanCode;
    if (hasBillingPlanLabel) update.billing_plan_label = billingPlanLabel;
    if (hasBillingCycle) update.billing_cycle = billingCycle;
    if (hasBillingBaseFee) update.billing_base_fee_cents = billingBaseFeeCents;
    if (hasMonthlyFee) update.monthly_fee_cents = monthlyFeeCents;
    if (hasBillingDueDay) update.billing_due_day = billingDueDay;
    if (hasBillingStartsAt) update.billing_starts_at = billingStartsAt;
    if (hasBillingExpiresAt) update.billing_expires_at = billingExpiresAt;
    if (hasBillingExceptionNote) {
      update.billing_exception_note = billingExceptionNote;
    }
    if (hasAdminNotes) update.admin_notes = adminNotes;
    // #4111: toda entrada em TRIAL inicia o relogio de envelhecimento.
    // Quadra que ja estava em TRIAL com relogio preserva a data original.
    if (subscriptionStatus === "TRIAL" &&
      !(locData.subscription_status === "TRIAL" && locData.trial_started_at)
    ) {
      update.trial_started_at = new Date();
    }

    const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
      locationId,
      {
        type: "SUBSCRIPTION_STATUS_CHANGED",
        actor_user_id: request.auth.uid,
        previous_subscription_status: locData.subscription_status ?? null,
        next_subscription_status: subscriptionStatus,
        previous_commercial_status: locData.commercial_status ?? null,
        next_commercial_status: subscriptionStatus,
        billing_plan_code: billingPlanCode,
        billing_plan_label: billingPlanLabel,
        billing_cycle: billingCycle,
        billing_base_fee_cents: billingBaseFeeCents,
        monthly_fee_cents: monthlyFeeCents,
        billing_due_day: billingDueDay,
        billing_exception_note: billingExceptionNote,
        reason: adminNotes,
        effective_at: FieldValue.serverTimestamp(),
      }
    );
    const batch = db().batch();
    batch.update(locRef, update);
    batch.set(ledgerRef, ledgerData);
    await batch.commit();
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_SUBSCRIPTION_CHANGE",
      before,
      after: update,
      reason: adminNotes,
    });

    return {success: true, locationId, subscriptionStatus};
  }
);

export const registerLocationSubscriptionPayment =
secureCallable<RegisterLocationSubscriptionPaymentRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locPay"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "registerLocationSubscriptionPayment",
      locationId: req.data?.locationId,
      periodKey: req.data?.periodKey,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const periodKey = requirePeriodKey(request.data.periodKey);
    const {amountCents} = request.data;
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new HttpsError("invalid-argument", "amountCents must be > 0");
    }
    const paidAt = parseOptionalIsoDate(request.data.paidAtIso, "paidAtIso") ||
      new Date();
    const method = optionalTrimmed(request.data.method, 80);
    const receiptUrl = optionalTrimmed(request.data.receiptUrl, 2048);
    const notes = optionalTrimmed(request.data.notes, 1000);
    const {locRef, locData} = await getExistingLocation(locationId);
    const paymentRef = locRef.collection("subscription_payments").doc();
    const resolvedStatus = await resolveSubscriptionStatusAfterApprovedPayment({
      locationId,
      periodKey,
      monthlyFeeCents: positiveCents(locData.monthly_fee_cents),
      newlyApprovedAmountCents: amountCents,
      currentSubscriptionStatus: locData.subscription_status,
      currentCommercialStatus: locData.commercial_status,
      billingExpiresAt: locData.billing_expires_at,
    });
    const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
      locationId,
      {
        type: "PAYMENT_REGISTERED",
        actor_user_id: request.auth.uid,
        amount_cents: amountCents,
        period_key: periodKey,
        payment_id: paymentRef.id,
        method,
        review_status: "APPROVED",
        previous_subscription_status: locData.subscription_status ?? null,
        next_subscription_status: resolvedStatus.subscriptionStatus,
        previous_commercial_status: locData.commercial_status ?? null,
        next_commercial_status: resolvedStatus.commercialStatus,
        reason: notes,
        effective_at: paidAt,
      }
    );
    const batch = db().batch();

    batch.set(paymentRef, {
      amount_cents: amountCents,
      period_key: periodKey,
      paid_at: paidAt,
      method,
      receipt_url: receiptUrl,
      notes,
      created_at: FieldValue.serverTimestamp(),
      created_by: request.auth.uid,
      status: "APPROVED",
      review_status: "APPROVED",
      reviewed_at: FieldValue.serverTimestamp(),
      reviewed_by: request.auth.uid,
    });
    batch.update(locRef, {
      subscription_status: resolvedStatus.subscriptionStatus,
      commercial_status: resolvedStatus.commercialStatus,
      last_payment_at: paidAt,
      last_payment_amount_cents: amountCents,
      last_payment_period_key: periodKey,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    });
    batch.set(ledgerRef, ledgerData);
    await batch.commit();

    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_SUBSCRIPTION_PAYMENT_REGISTERED",
      before: {
        subscription_status: locData.subscription_status ?? null,
        commercial_status: locData.commercial_status ?? null,
      },
      after: {
        subscription_status: resolvedStatus.subscriptionStatus,
        commercial_status: resolvedStatus.commercialStatus,
        amount_cents: amountCents,
        period_key: periodKey,
        paid_cents: resolvedStatus.paidCents,
        open_balance_cents: resolvedStatus.openBalanceCents,
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      paymentId: paymentRef.id,
      subscriptionStatus: resolvedStatus.subscriptionStatus,
    };
  }
);

export const submitLocationSubscriptionReceipt =
secureCallable<SubmitLocationSubscriptionReceiptRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    rateLimit: {maxRequests: 10, windowMs: 60000, keyPrefix: "locPaySubmit"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "submitLocationSubscriptionReceipt",
      locationId: req.data?.locationId,
      periodKey: req.data?.periodKey,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const periodKey = requirePeriodKey(request.data.periodKey);
    const {amountCents} = request.data;
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new HttpsError("invalid-argument", "amountCents must be > 0");
    }
    const paidAt = parseOptionalIsoDate(request.data.paidAtIso, "paidAtIso") ||
      new Date();
    const method = optionalTrimmed(request.data.method, 80);
    const notes = optionalTrimmed(request.data.notes, 1000);
    const {locRef, locData} = await getExistingLocation(locationId);
    assertAdminOrLocationOwnerForReceipt(request, locData);
    const receiptStoragePath = requireLocationReceiptStoragePath(
      request.data.receiptStoragePath,
      locationId,
      locData.owner_id
    );
    const paymentRef = locRef.collection("subscription_payments").doc();
    const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
      locationId,
      {
        type: "PAYMENT_RECEIPT_SUBMITTED",
        actor_user_id: request.auth.uid,
        amount_cents: amountCents,
        period_key: periodKey,
        payment_id: paymentRef.id,
        method,
        review_status: "PENDING_REVIEW",
        previous_subscription_status: locData.subscription_status ?? null,
        next_subscription_status: locData.subscription_status ?? null,
        previous_commercial_status: locData.commercial_status ?? null,
        next_commercial_status: locData.commercial_status ?? null,
        reason: notes,
        effective_at: paidAt,
      }
    );

    const batch = db().batch();
    batch.set(paymentRef, {
      amount_cents: amountCents,
      period_key: periodKey,
      paid_at: paidAt,
      method,
      receipt_storage_path: receiptStoragePath,
      receipt_url: null,
      notes,
      status: "PENDING_REVIEW",
      review_status: "PENDING_REVIEW",
      submitted_at: FieldValue.serverTimestamp(),
      submitted_by: request.auth.uid,
      created_at: FieldValue.serverTimestamp(),
      created_by: request.auth.uid,
    });
    batch.set(ledgerRef, ledgerData);
    await batch.commit();

    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_SUBSCRIPTION_RECEIPT_SUBMITTED",
      after: {
        payment_id: paymentRef.id,
        amount_cents: amountCents,
        period_key: periodKey,
        receipt_storage_path: receiptStoragePath,
        review_status: "PENDING_REVIEW",
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      paymentId: paymentRef.id,
      reviewStatus: "PENDING_REVIEW",
    };
  }
);

export const reviewLocationSubscriptionReceipt =
secureCallable<ReviewLocationSubscriptionReceiptRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locPayReview"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "reviewLocationSubscriptionReceipt",
      locationId: req.data?.locationId,
      paymentId: req.data?.paymentId,
      decision: req.data?.decision,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    assertAdmin(request);
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const paymentId = requireNonEmptyString(request.data.paymentId, "paymentId");
    const decision = requireEnum(
      request.data.decision,
      ["APPROVED", "REJECTED"] as const,
      "decision"
    );
    const notes = optionalTrimmed(request.data.notes, 1000);
    const actorUid = request.auth.uid;
    const {locRef} = await getExistingLocation(locationId);
    const paymentRef = locRef.collection("subscription_payments").doc(paymentId);

    const review = await db().runTransaction(async (tx) => {
      const paymentDoc = await tx.get(paymentRef);
      if (!paymentDoc.exists) {
        throw new HttpsError("not-found", `Payment ${paymentId} not found`);
      }
      const paymentData = paymentDoc.data() || {};
      if (paymentData.review_status !== "PENDING_REVIEW" &&
        paymentData.status !== "PENDING_REVIEW"
      ) {
        throw new HttpsError("failed-precondition", "Payment is not pending review");
      }
      if (typeof paymentData.receipt_storage_path !== "string") {
        throw new HttpsError("failed-precondition", "Payment has no private receipt path");
      }

      const paymentUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        review_status: decision,
        status: decision,
        reviewed_at: FieldValue.serverTimestamp(),
        reviewed_by: actorUid,
        review_notes: notes,
        updated_at: FieldValue.serverTimestamp(),
      };
      const paymentAmountCents = positiveCents(paymentData.amount_cents);
      const paymentPeriodKey = typeof paymentData.period_key === "string" ?
        paymentData.period_key :
        null;

      const locDoc = await tx.get(locRef);
      const currentLocData = locDoc.data() || {};

      let alreadyApprovedCents = 0;
      if (decision === "APPROVED" && paymentPeriodKey) {
        const paymentsSnapshot = await tx.get(
          locRef
            .collection("subscription_payments")
            .where("period_key", "==", paymentPeriodKey)
        );
        for (const approvedDoc of paymentsSnapshot.docs) {
          const approved = approvedDoc.data() || {};
          const approvedReviewStatus = approved.review_status || approved.status;
          if (approvedReviewStatus === "APPROVED") {
            alreadyApprovedCents += positiveCents(approved.amount_cents);
          }
        }
      }

      const resolvedStatus = decision === "APPROVED" ?
        await resolveSubscriptionStatusAfterApprovedPayment({
          locationId,
          periodKey: paymentPeriodKey,
          monthlyFeeCents: positiveCents(currentLocData.monthly_fee_cents),
          newlyApprovedAmountCents: paymentAmountCents,
          currentSubscriptionStatus: currentLocData.subscription_status,
          currentCommercialStatus: currentLocData.commercial_status,
          billingExpiresAt: currentLocData.billing_expires_at,
          alreadyApprovedCents,
        }) :
        {
          paidCents: null,
          openBalanceCents: null,
          subscriptionStatus: currentLocData.subscription_status ?? null,
          commercialStatus: currentLocData.commercial_status ?? null,
        };

      if (decision === "APPROVED") {
        tx.update(paymentRef, paymentUpdate);
        tx.update(locRef, {
          subscription_status: resolvedStatus.subscriptionStatus,
          commercial_status: resolvedStatus.commercialStatus,
          last_payment_at: paymentData.paid_at ?? null,
          last_payment_amount_cents: paymentData.amount_cents ?? null,
          last_payment_period_key: paymentData.period_key ?? null,
          last_payment_id: paymentId,
          updated_at: FieldValue.serverTimestamp(),
          updated_by: actorUid,
        });
      } else {
        tx.update(paymentRef, paymentUpdate);
      }

      const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
        locationId,
        {
          type: decision === "APPROVED" ?
            "PAYMENT_RECEIPT_APPROVED" :
            "PAYMENT_RECEIPT_REJECTED",
          actor_user_id: actorUid,
          amount_cents: typeof paymentData.amount_cents === "number" ?
            paymentData.amount_cents : null,
          period_key: typeof paymentData.period_key === "string" ?
            paymentData.period_key : null,
          payment_id: paymentId,
          method: typeof paymentData.method === "string" ? paymentData.method : null,
          review_status: decision,
          previous_subscription_status: currentLocData.subscription_status ?? null,
          next_subscription_status: resolvedStatus.subscriptionStatus,
          previous_commercial_status: currentLocData.commercial_status ?? null,
          next_commercial_status: resolvedStatus.commercialStatus,
          reason: notes,
          effective_at: paymentData.paid_at ?? FieldValue.serverTimestamp(),
        }
      );
      tx.set(ledgerRef, ledgerData);

      return {
        resolvedStatus,
        previousSubscriptionStatus: currentLocData.subscription_status ?? null,
        previousCommercialStatus: currentLocData.commercial_status ?? null,
      };
    });

    await writeLocationCommercialEvent({
      locationId,
      actorUserId: actorUid,
      type: decision === "APPROVED" ?
        "LOCATION_SUBSCRIPTION_RECEIPT_APPROVED" :
        "LOCATION_SUBSCRIPTION_RECEIPT_REJECTED",
      before: {
        subscription_status: review.previousSubscriptionStatus,
        commercial_status: review.previousCommercialStatus,
        payment_id: paymentId,
      },
      after: {
        subscription_status: review.resolvedStatus.subscriptionStatus,
        commercial_status: review.resolvedStatus.commercialStatus,
        payment_id: paymentId,
        review_status: decision,
        paid_cents: review.resolvedStatus.paidCents,
        open_balance_cents: review.resolvedStatus.openBalanceCents,
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      paymentId,
      reviewStatus: decision,
      subscriptionStatus: review.resolvedStatus.subscriptionStatus,
    };
  }
);
