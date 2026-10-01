/**
 * SISTEMA DE MONITORAMENTO E ALERTAS - PHASE 3
 *
 * Fornece funções de monitoramento para detectar
 * anomalias e registrar alertas. Trabalha junto
 * com collect-metrics.ts para fornecer
 * observabilidade completa.
 *
 * FUNCIONALIDADES:
 * - Detecção de anomalias em XP processing
 * - Monitoramento de taxa de erros
 * - Alertas para usage excedendo thresholds
 * - Limpeza da dead letter queue
 * - Monitoramento de rate limiting abuso
 * - Health check geral do sistema
 *
 * ALERTAS:
 * Alertas são armazenados na coleção "alerts"
 * no Firestore. Um dashboard ou Cloud Monitoring
 * pode consumir esses dados.
 *
 * @see specs/BACKEND_OPTIMIZATION_SPEC.md
 * @see functions/src/monitoring/collect-metrics.ts
 */

import {logger} from "firebase-functions";
import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import "../types/firestore-count";

const getDb = () => admin.firestore();

// ==========================================
// INTERFACES
// ==========================================

/** Severidade do alerta */
type AlertSeverity =
  "INFO" | "WARNING" | "CRITICAL";

/** Alerta gerado pelo sistema */
interface SystemAlert {
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: FieldValue;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?:
    FieldValue;
}

/** Item de check individual */
interface CheckItem {
  status: string;
  message: string;
  value?: unknown;
}

/** Resultado do health check */
interface HealthCheckResult {
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  checks: Record<string, CheckItem>;
  timestamp: string;
  durationMs: number;
}

/** Alerta parcial (sem campos auto-gerados) */
type PartialAlert = Omit<
  SystemAlert,
  "created_at" | "acknowledged"
>;

// ==========================================
// CONSTANTES - Thresholds de alerta
// ==========================================

const THRESHOLDS = {
  /** Max XP duplicatas tolerado por dia */
  XP_DUPLICATES_PER_DAY: 0,
  /** Max falhas de XP processing por dia */
  XP_FAILURES_PER_DAY: 5,
  /** Max itens na dead letter queue */
  DLQ_MAX_PENDING: 10,
  /** Max rate limiting por hora (ataque) */
  RATE_LIMIT_HITS_PER_HOUR: 50,
  /** Max tokens FCM inválidos por dia */
  INVALID_FCM_TOKENS_PER_DAY: 100,
  /** Max jogos pendentes XP (> 1h) */
  STALE_XP_PROCESSING_MAX: 3,
  /** Max latência do health check em ms */
  HEALTH_CHECK_MAX_DURATION_MS: 10_000,
  /** Max alertas não-acknowledged */
  UNACKNOWLEDGED_ALERTS_MAX: 20,
  /** Tempo máximo (horas) sem acknowledge */
  ALERT_ACKNOWLEDGE_DEADLINE_HOURS: 48,
  /**
   * Idade (ms) do draft expirado mais antigo a partir da qual o janitor de
   * mural é considerado em atraso (issue #3969). 1h = draft preso além de
   * várias execuções do janitor (roda a cada 10min).
   */
  WALL_MEDIA_OLDEST_EXPIRED_AGE_MS: 60 * 60 * 1000,
  /** Falhas de cleanup de draft em uma única execução que indicam draft preso */
  WALL_MEDIA_CLEANUP_FAILURES: 1,
  /** Janela (ms) para considerar a métrica mais recente do janitor de mural */
  WALL_MEDIA_METRIC_WINDOW_MS: 30 * 60 * 1000,
  /**
   * Janela (ms) para considerar a execução mais recente do cron de cobrança
   * de quadras (issue #4111). O cron roda 1x/dia (04:20 BRT); 48h cobre
   * uma execução perdida sem alertar sobre runs antigos para sempre.
   */
  BILLING_AUTOMATION_RUN_WINDOW_MS: 48 * 60 * 60 * 1000,
};

// ==========================================
// SCHEDULED: Health Check (a cada 15 min)
// ==========================================

/**
 * Health check periódico que verifica o estado
 * do sistema.
 *
 * Verifica:
 * 1. XP duplicatas
 * 2. Jogos pendentes de XP processing (> 1h)
 * 3. Dead letter queue acumulada
 * 4. Taxa de rate limiting (possível abuso)
 * 5. Notificações falhadas na fila
 *
 * Gera alertas automáticos se thresholds forem
 * excedidos. Executa a cada 15 minutos.
 */
export const systemHealthCheck =
  functions.scheduler.onSchedule({
    schedule: "*/15 * * * *",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "512MiB",
    timeoutSeconds: 120,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    const startTime = Date.now();
    const db = getDb();

    logger.info(
      "[HEALTH_CHECK] Iniciando health check"
    );

    const checks:
      HealthCheckResult["checks"] = {};
    const alerts: PartialAlert[] = [];

    // ========================================
    // CHECK 1: Jogos com XP processing > 1h
    // ========================================
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(
        oneHourAgo.getHours() - 1
      );

      const staleSnap = await db
        .collection("games")
        .where("xp_processing", "==", true)
        .where(
          "xp_processing_at",
          "<",
          Timestamp
            .fromDate(oneHourAgo)
        )
        .limit(10)
        .get();

      const staleCount = staleSnap.size;
      checks["stale_xp_processing"] = {
        status:
          staleCount === 0 ? "OK" : "WARNING",
        message:
          `${staleCount} jogos com XP ` +
          "processing travado",
        value: staleCount,
      };

      if (
        staleCount >
          THRESHOLDS.STALE_XP_PROCESSING_MAX
      ) {
        const gameIds = staleSnap.docs.map(
          (d) => d.id
        );
        alerts.push({
          type: "STALE_XP_PROCESSING",
          severity: "CRITICAL",
          title: "Jogos com XP processing " +
            "travado",
          message:
            `${staleCount} jogos com ` +
            "xp_processing=true há >1h. " +
            `IDs: ${gameIds.join(", ")}`,
          metadata: {
            count: staleCount,
            gameIds,
          },
        });

        // Auto-recuperação: resetar flag
        try {
          const resetBatch = db.batch();
          for (const doc of staleSnap.docs) {
            resetBatch.update(doc.ref, {
              xp_processing: false,
              xp_processing_error:
                "Auto-reset: processing " +
                "travado por mais de 1 hora",
            });
          }
          await resetBatch.commit();

          logger.info(
            "[HEALTH_CHECK] Auto-reset de " +
            `${staleCount} jogos com XP ` +
            "processing travado"
          );
        } catch (resetError) {
          logger.error(
            "[HEALTH_CHECK] Falha no auto-reset " +
            "de XP processing travado:",
            resetError
          );
        }
      }
    } catch (error) {
      checks["stale_xp_processing"] = {
        status: "ERROR",
        message: `Erro ao verificar: ${error}`,
      };
    }

    // ========================================
    // CHECK 2: Dead Letter Queue acumulada
    // ========================================
    try {
      const dlqSnap = await db
        .collection("dead_letter_queue")
        .where("status", "==", "PENDING")
        .count()
        .get();

      const dlqCount = dlqSnap.data().count;
      const dlqOk =
        dlqCount <=
          THRESHOLDS.DLQ_MAX_PENDING;
      checks["dead_letter_queue"] = {
        status: dlqOk ? "OK" : "WARNING",
        message:
          `${dlqCount} itens pendentes na DLQ`,
        value: dlqCount,
      };

      if (!dlqOk) {
        alerts.push({
          type: "DLQ_ACCUMULATION",
          severity: "WARNING",
          title: "Dead Letter Queue acumulando",
          message:
            `${dlqCount} operações falhadas ` +
            "pendentes na dead letter queue. " +
            "Verificar manualmente.",
          metadata: {count: dlqCount},
        });
      }
    } catch (error) {
      checks["dead_letter_queue"] = {
        status: "ERROR",
        message: `Erro ao verificar: ${error}`,
      };
    }

    // ========================================
    // CHECK 3: Notificações falhadas na fila
    // ========================================
    try {
      const failedNotifSnap = await db
        .collection("notification_queue")
        .where("status", "==", "FAILED")
        .count()
        .get();

      const failedCount =
        failedNotifSnap.data().count;
      checks["failed_notifications"] = {
        status:
          failedCount < 10 ? "OK" : "WARNING",
        message:
          `${failedCount} notificações ` +
          "falhadas na fila",
        value: failedCount,
      };

      if (failedCount >= 10) {
        alerts.push({
          type: "NOTIFICATION_FAILURES",
          severity: "WARNING",
          title: "Notificações FCM falhando",
          message:
            `${failedCount} notificações com ` +
            "status FAILED. Possível problema " +
            "com tokens FCM.",
          metadata: {count: failedCount},
        });
      }
    } catch (error) {
      checks["failed_notifications"] = {
        status: "ERROR",
        message: `Erro ao verificar: ${error}`,
      };
    }

    // ========================================
    // CHECK 4: Rate limiting excessivo
    // ========================================
    try {
      const oneHourAgoDate = new Date();
      oneHourAgoDate.setHours(
        oneHourAgoDate.getHours() - 1
      );

      // Contar alertas de rate limit na hora
      const rateLimitSnap = await db
        .collection("audit_logs")
        .where(
          "type", "==", "RATE_LIMIT_EXCEEDED"
        )
        .where(
          "timestamp",
          ">=",
          Timestamp
            .fromDate(oneHourAgoDate)
        )
        .count()
        .get();

      const rlCount =
        rateLimitSnap.data().count;
      const rlMax =
        THRESHOLDS.RATE_LIMIT_HITS_PER_HOUR;
      checks["rate_limit_abuse"] = {
        status:
          rlCount < rlMax ? "OK" : "WARNING",
        message:
          `${rlCount} rate limit hits na ` +
          "última hora",
        value: rlCount,
      };

      if (rlCount >= rlMax) {
        alerts.push({
          type: "RATE_LIMIT_ABUSE",
          severity: "WARNING",
          title: "Rate limiting excessivo",
          message:
            `${rlCount} hits de rate ` +
            "limiting na última hora. " +
            "Possível abuso ou bot.",
          metadata: {count: rlCount},
        });
      }
    } catch (error) {
      checks["rate_limit_abuse"] = {
        status: "ERROR",
        message: `Erro ao verificar: ${error}`,
      };
    }

    // ========================================
    // CHECK 5: XP duplicatas (últimas 24h)
    // ========================================
    try {
      // FIX #993: adicionar filtro temporal — antes pegava TODOS os
      // jogos com erro historicamente (alertas perpétuos de erros antigos).
      const dayAgo = Timestamp.fromMillis(
        Date.now() - 24 * 60 * 60 * 1000
      );
      const errorGamesSnap = await db
        .collection("games")
        .where(
          "xp_processing_error", "!=", null
        )
        .where("updated_at", ">=", dayAgo)
        .limit(10)
        .get();

      const errorCount = errorGamesSnap.size;
      const xpOk = errorCount <=
        THRESHOLDS.XP_FAILURES_PER_DAY;
      checks["xp_processing_errors"] = {
        status: xpOk ? "OK" : "WARNING",
        message:
          `${errorCount} jogos com erros ` +
          "de XP processing",
        value: errorCount,
      };

      if (!xpOk) {
        const gameIds =
          errorGamesSnap.docs.map(
            (d) => d.id
          );
        alerts.push({
          type: "XP_PROCESSING_FAILURES",
          severity: "CRITICAL",
          title: "Muitas falhas de XP",
          message:
            `${errorCount} jogos com erros ` +
            "de XP processing. IDs: " +
            gameIds.join(", "),
          metadata: {
            count: errorCount,
            gameIds,
          },
        });
      }
    } catch (error) {
      checks["xp_processing_errors"] = {
        status: "ERROR",
        message: `Erro ao verificar: ${error}`,
      };
    }

    // ========================================
    // CHECK 8: Janitor de mural saturado (issue #3969)
    // ========================================
    // O janitor (cleanupExpiredGroupWallMediaDrafts) já gravava
    // backlog_possible / cleanup_failures / oldest_expired_age_ms nas métricas,
    // mas NADA lia esses campos. Aqui consumimos a métrica mais recente para
    // acionar alertas quando o janitor não dá conta do backlog ou um draft
    // fica preso em retentativa infinita.
    try {
      const windowStart = Timestamp.fromMillis(
        Date.now() - THRESHOLDS.WALL_MEDIA_METRIC_WINDOW_MS
      );
      const janitorSnap = await db
        .collection("metrics")
        .where("type", "==", "group_wall_media_pipeline")
        .where("event", "==", "DRAFT_EXPIRED")
        .where("timestamp", ">=", windowStart)
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();

      if (!janitorSnap.empty) {
        const latest =
          janitorSnap.docs[0].data() as {
            backlog_possible?: boolean;
            cleanup_failures?: number;
            oldest_expired_age_ms?: number | null;
            scanned?: number;
            orphan_count?: number;
          };
        const backlogPossible =
          latest.backlog_possible === true;
        const cleanupFailures =
          typeof latest.cleanup_failures === "number" ?
            latest.cleanup_failures : 0;
        const oldestAgeMs =
          typeof latest.oldest_expired_age_ms === "number" ?
            latest.oldest_expired_age_ms : null;
        const oldestStale =
          oldestAgeMs != null &&
          oldestAgeMs >
            THRESHOLDS.WALL_MEDIA_OLDEST_EXPIRED_AGE_MS;
        const failuresStuck =
          cleanupFailures >=
            THRESHOLDS.WALL_MEDIA_CLEANUP_FAILURES;

        const ok = !backlogPossible && !oldestStale && !failuresStuck;
        checks["wall_media_janitor"] = {
          status: ok ? "OK" : "WARNING",
          message:
            `janitor mural backlog=${backlogPossible}, ` +
            `falhas=${cleanupFailures}, ` +
            `oldest_age_ms=${oldestAgeMs}`,
          value: {
            backlogPossible,
            cleanupFailures,
            oldestExpiredAgeMs: oldestAgeMs,
          },
        };

        if (backlogPossible) {
          alerts.push({
            type: "WALL_MEDIA_JANITOR_BACKLOG",
            severity: "WARNING",
            title:
              "Janitor de mural com backlog (limite de varredura)",
            message:
              "O janitor de mídia do mural não drenou " +
              "todos os drafts expirados na última execução. " +
              `Idade do mais antigo: ${oldestAgeMs}ms. ` +
              "Possível acúmulo de staging órfão.",
            metadata: {
              backlog_possible: true,
              oldest_expired_age_ms: oldestAgeMs,
              scanned: latest.scanned ?? null,
              cleaned: latest.orphan_count ?? null,
            },
          });
        }

        if (oldestStale) {
          alerts.push({
            type: "WALL_MEDIA_DRAFT_STUCK",
            severity: "WARNING",
            title: "Draft de mural preso há muito tempo",
            message:
              "Existe draft expirado há " +
              `${Math.round((oldestAgeMs ?? 0) / 60000)}min ` +
              "(limite 60min). Provável objeto preso em " +
              "retentativa infinita sem dead-letter.",
            metadata: {
              oldest_expired_age_ms: oldestAgeMs,
              threshold_ms:
                THRESHOLDS.WALL_MEDIA_OLDEST_EXPIRED_AGE_MS,
            },
          });
        }

        if (failuresStuck) {
          alerts.push({
            type: "WALL_MEDIA_CLEANUP_FAILURES",
            severity: "WARNING",
            title: "Falhas de cleanup de draft de mural",
            message:
              `${cleanupFailures} draft(s) retornaram ` +
              "FAILED no último ciclo do janitor e seguem " +
              "EXPIRED (retentativa infinita).",
            metadata: {
              cleanup_failures: cleanupFailures,
            },
          });
        }
      }
    } catch (error) {
      checks["wall_media_janitor"] = {
        status: "ERROR",
        message: `Erro ao verificar: ${error}`,
      };
    }

    // ========================================
    // CHECK 9: Cron de cobrança de quadras com quadras impossíveis de
    // cobrar (issue #4111)
    // ========================================
    // processLocationBillingCycles grava um doc por execução em
    // `billing_automation_runs` com contadores + listas de IDs. Antes os
    // contadores morriam num logger.info. `inconsistent_locations > 0`
    // significa quadra publicada e impossível de cobrar (sem dono, sem
    // mensalidade ou sem vencimento): incidente, não estatística.
    // Dedupe: um alerta por run (metadata.run_id), não um a cada 15min.
    try {
      const windowStart = Timestamp.fromMillis(
        Date.now() - THRESHOLDS.BILLING_AUTOMATION_RUN_WINDOW_MS
      );
      const runsSnap = await db
        .collection("billing_automation_runs")
        .where("started_at", ">=", windowStart)
        .orderBy("started_at", "desc")
        .limit(1)
        .get();

      if (!runsSnap.empty) {
        const latestRun = runsSnap.docs[0].data() as {
          run_id?: string;
          period_key?: string;
          inconsistent_locations?: number;
          inconsistent_location_ids?: string[];
          expired_locations?: number;
          aged_trial_locations?: number;
          aged_trial_location_ids?: string[];
        };
        const runId = typeof latestRun.run_id === "string" ?
          latestRun.run_id :
          runsSnap.docs[0].id;
        const inconsistentCount =
          typeof latestRun.inconsistent_locations === "number" ?
            latestRun.inconsistent_locations : 0;
        const inconsistentIds = Array.isArray(latestRun.inconsistent_location_ids) ?
          latestRun.inconsistent_location_ids.filter(
            (id): id is string => typeof id === "string"
          ) :
          [];
        const agedTrialCount =
          typeof latestRun.aged_trial_locations === "number" ?
            latestRun.aged_trial_locations : 0;

        const ok = inconsistentCount === 0;
        checks["billing_automation_inconsistent"] = {
          status: ok ? "OK" : "WARNING",
          message:
            `run ${runId}: ${inconsistentCount} quadra(s) impossível(is) ` +
            `de cobrar, ${agedTrialCount} trial(s) envelhecido(s)`,
          value: {
            runId,
            inconsistentLocations: inconsistentCount,
            agedTrialLocations: agedTrialCount,
          },
        };

        if (!ok) {
          const alreadyAlertedSnap = await db
            .collection("alerts")
            .where("type", "==", "BILLING_AUTOMATION_INCONSISTENT_LOCATIONS")
            .where("metadata.run_id", "==", runId)
            .limit(1)
            .get();

          if (alreadyAlertedSnap.empty) {
            alerts.push({
              type: "BILLING_AUTOMATION_INCONSISTENT_LOCATIONS",
              severity: "CRITICAL",
              title: "Quadras impossíveis de cobrar no cron de cobrança",
              message:
                `${inconsistentCount} quadra(s) sem dono, mensalidade ou ` +
                "dia de vencimento foram descartadas pelo cron de cobrança " +
                `(run ${runId}, período ${latestRun.period_key ?? "?"}). ` +
                `IDs: ${inconsistentIds.join(", ") || "(sem IDs)"}`,
              metadata: {
                run_id: runId,
                period_key: latestRun.period_key ?? null,
                count: inconsistentCount,
                locationIds: inconsistentIds,
                expired_locations: latestRun.expired_locations ?? 0,
                aged_trial_locations: agedTrialCount,
                aged_trial_location_ids: Array.isArray(
                  latestRun.aged_trial_location_ids
                ) ?
                  latestRun.aged_trial_location_ids :
                  [],
              },
            });
          }
        }
      }
    } catch (error) {
      checks["billing_automation_inconsistent"] = {
        status: "ERROR",
        message: `Erro ao verificar: ${error}`,
      };
    }

    // ========================================
    // FINALIZAR: Status geral e salvar
    // ========================================
    const hasWarning = Object.values(checks)
      .some((c) => c.status === "WARNING");
    const hasError = Object.values(checks)
      .some((c) => c.status === "ERROR");
    const hasCritical = alerts.some(
      (a) => a.severity === "CRITICAL"
    );

    let overallStatus:
      HealthCheckResult["status"] = "HEALTHY";
    if (hasWarning || hasError) {
      overallStatus = "DEGRADED";
    }
    if (hasCritical) {
      overallStatus = "CRITICAL";
    }

    const durationMs = Date.now() - startTime;

    // Salvar resultado do health check
    await db.collection("metrics").add({
      type: "health_check",
      timestamp:
        FieldValue
          .serverTimestamp(),
      status: overallStatus,
      checks,
      duration_ms: durationMs,
      alerts_generated: alerts.length,
    });

    // FIX #754: CHECK 6 e CHECK 7 movidos para ANTES do saveAlertsWithRetry
    // (antes ficavam APÓS o save → nunca eram persistidos ao Firestore)

    // CHECK 6: Latência do health check
    const maxDuration =
      THRESHOLDS.HEALTH_CHECK_MAX_DURATION_MS;
    if (durationMs > maxDuration) {
      alerts.push({
        type: "SLOW_HEALTH_CHECK",
        severity: "WARNING",
        title: "Health check lento",
        message:
          `Health check levou ${durationMs}ms ` +
          `(limite: ${maxDuration}ms). ` +
          "Possível degradação no Firestore.",
        metadata: {
          durationMs,
          thresholdMs: maxDuration,
        },
      });
    }

    // CHECK 7: Alertas não-acknowledged
    try {
      const unackedSnap = await db
        .collection("alerts")
        .where("acknowledged", "==", false)
        .count()
        .get();

      const unackedCount =
        unackedSnap.data().count;
      const maxUnacked =
        THRESHOLDS.UNACKNOWLEDGED_ALERTS_MAX;
      checks["unacknowledged_alerts"] = {
        status:
          unackedCount < maxUnacked ?
            "OK" :
            "WARNING",
        message:
          `${unackedCount} alertas ` +
          "não reconhecidos",
        value: unackedCount,
      };

      if (unackedCount >= maxUnacked) {
        alerts.push({
          type: "ALERT_OVERFLOW",
          severity: "CRITICAL",
          title: "Alertas acumulando",
          message:
            `${unackedCount} alertas ` +
            "pendentes. Possível falta de " +
            "monitoramento ativo.",
          metadata: {count: unackedCount},
        });
      }
    } catch (error) {
      checks["unacknowledged_alerts"] = {
        status: "ERROR",
        message: `Erro ao verificar: ${error}`,
      };
    }

    // Salvar alertas (cobre todos os 7 CHECKs agora)
    if (alerts.length > 0) {
      // FIX #654-B4: retry logic para evitar alertas silenciosamente
      // perdidos por falha transitória de rede ou batch.
      const saveAlertsWithRetry = async (
        alertsList: PartialAlert[],
        maxRetries = 3,
      ): Promise<void> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const alertBatch = db.batch();
            for (const alert of alertsList) {
              const alertRef =
                db.collection("alerts").doc();
              alertBatch.set(alertRef, {
                ...alert,
                created_at:
                  FieldValue
                    .serverTimestamp(),
                acknowledged: false,
              });
            }
            await alertBatch.commit();
            return;
          } catch (err) {
            if (attempt < maxRetries) {
              logger.warn(
                "[HEALTH_CHECK] Alert batch commit failed " +
                `(attempt ${attempt}/${maxRetries}), retrying...`,
                err
              );
              await new Promise((r) => setTimeout(r, 1000 * attempt));
            } else {
              logger.error(
                "[HEALTH_CHECK] Alert batch commit failed " +
                `after ${maxRetries} attempts, alerts dropped:`,
                err
              );
            }
          }
        }
      };

      await saveAlertsWithRetry(alerts);

      const alertTypes = alerts.map(
        (a) => a.type
      );
      logger.info(
        "[HEALTH_CHECK] " +
        `${alerts.length} alertas gerados: ` +
        alertTypes.join(", ")
      );
    }

    const checkCount =
      Object.keys(checks).length;
    logger.info(
      "[HEALTH_CHECK] Concluído em " +
      `${durationMs}ms. Status: ` +
      `${overallStatus}. ` +
      `Checks: ${checkCount}. ` +
      `Alertas: ${alerts.length}`
    );
  });

// ==========================================
// SCHEDULED: Cleanup DLQ (semanal)
// ==========================================

/**
 * Remove itens resolvidos/ignorados da DLQ com
 * mais de 30 dias. Executa semanalmente às
 * segundas-feiras 03:00 BRT.
 */
export const cleanupDeadLetterQueue =
  functions.scheduler.onSchedule({
    schedule: "0 3 * * 1", // Segunda às 03:00
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "256MiB",
    timeoutSeconds: 120,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    const db = getDb();

    logger.info(
      "[DLQ_CLEANUP] Iniciando limpeza " +
      "da dead letter queue"
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(
      thirtyDaysAgo.getDate() - 30
    );
    const cutoff =
      Timestamp.fromDate(
        thirtyDaysAgo
      );

    let totalDeleted = 0;

    try {
      // FIX #2646: cursor+loop pattern — iterar todas as páginas,
      // não apenas a primeira de 500.
      const resolvedBaseQuery = db
        .collection("dead_letter_queue")
        .where(
          "status", "in",
          ["RESOLVED", "IGNORED"]
        )
        .where("created_at", "<", cutoff)
        .orderBy("created_at")
        .limit(500);

      let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
      let hasMore = true;

      while (hasMore) {
        const pageQuery = lastDoc ?
          resolvedBaseQuery.startAfter(lastDoc) :
          resolvedBaseQuery;
        const resolvedSnap = await pageQuery.get();

        if (resolvedSnap.empty) {
          hasMore = false;
          break;
        }

        const batch = db.batch();
        resolvedSnap.docs.forEach(
          (doc) => batch.delete(doc.ref)
        );
        await batch.commit();
        totalDeleted += resolvedSnap.size;

        if (resolvedSnap.size < 500) {
          hasMore = false;
        } else {
          lastDoc = resolvedSnap.docs[resolvedSnap.docs.length - 1];
        }
      }

      // Marcar PENDING antigos como IGNORED (cursor+loop)
      const pendingBaseQuery = db
        .collection("dead_letter_queue")
        .where("status", "==", "PENDING")
        .where("created_at", "<", cutoff)
        .orderBy("created_at")
        .limit(100);

      let pendingLastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
      let pendingHasMore = true;

      while (pendingHasMore) {
        const pendingPageQuery: FirebaseFirestore.Query = pendingLastDoc ?
          pendingBaseQuery.startAfter(pendingLastDoc) :
          pendingBaseQuery;
        const stalePendingSnap = await pendingPageQuery.get();

        if (stalePendingSnap.empty) {
          pendingHasMore = false;
          break;
        }

        const batch = db.batch();
        stalePendingSnap.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
          batch.update(doc.ref, {
            status: "IGNORED",
            resolved_at:
              FieldValue
                .serverTimestamp(),
            resolved_by: "auto_cleanup",
          });
        });
        await batch.commit();

        logger.info(
          "[DLQ_CLEANUP] " +
          `${stalePendingSnap.size} itens ` +
          "pendentes antigos marcados IGNORED"
        );

        if (stalePendingSnap.size < 100) {
          pendingHasMore = false;
        } else {
          pendingLastDoc = stalePendingSnap.docs[stalePendingSnap.docs.length - 1];
        }
      }

      logger.info(
        "[DLQ_CLEANUP] Limpeza concluída. " +
        `${totalDeleted} itens removidos.`
      );
    } catch (error) {
      logger.error(
        "[DLQ_CLEANUP] Erro:", error
      );
      throw error;
    }
  });

// ==========================================
// SCHEDULED: Cleanup Rate Limits (a cada hora)
// ==========================================

/**
 * Remove buckets de rate limit expirados.
 * Executa a cada hora para manter a coleção
 * rate_limits limpa.
 */
export const cleanupExpiredRateLimits =
  functions.scheduler.onSchedule({
    schedule: "2 * * * *", // A cada hora (offset 2min para evitar colisao com collect-metrics)
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "256MiB",
    timeoutSeconds: 120,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    const db = getDb();

    logger.info(
      "[RATE_LIMIT_CLEANUP] Iniciando " +
      "limpeza de rate limits expirados"
    );

    const now =
      Timestamp.now();
    let totalDeleted = 0;

    try {
      // FIX #2646: cursor+loop pattern — iterar todas as páginas
      // de buckets expirados, não apenas uma página de 500.
      const baseQuery = db
        .collection("rate_limits")
        .where("expires_at", "<", now)
        .orderBy("expires_at")
        .limit(500);

      let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
      let hasMore = true;

      while (hasMore) {
        const pageQuery = lastDoc ?
          baseQuery.startAfter(lastDoc) :
          baseQuery;
        const expiredSnap = await pageQuery.get();

        if (expiredSnap.empty) {
          hasMore = false;
          break;
        }

        const batch = db.batch();
        expiredSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        totalDeleted += expiredSnap.size;

        if (expiredSnap.size < 500) {
          hasMore = false;
        } else {
          lastDoc = expiredSnap.docs[expiredSnap.docs.length - 1];
        }
      }

      if (totalDeleted === 0) {
        logger.info(
          "[RATE_LIMIT_CLEANUP] Nenhum " +
          "bucket expirado encontrado"
        );
      } else {
        logger.info(
          "[RATE_LIMIT_CLEANUP] " +
          `${totalDeleted} buckets removidos`
        );
      }
    } catch (error) {
      logger.error(
        "[RATE_LIMIT_CLEANUP] Erro:", error
      );
      throw error;
    }
  });

// ==========================================
// SCHEDULED: Cleanup Alertas Antigos (semanal)
// ==========================================

/**
 * Remove alertas acknowledged com mais de
 * 30 dias. Executa semanalmente.
 */
export const cleanupOldAlerts =
  functions.scheduler.onSchedule({
    schedule: "0 4 * * 1", // Segunda às 04:00
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "256MiB",
    timeoutSeconds: 120,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    const db = getDb();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(
      thirtyDaysAgo.getDate() - 30
    );
    const cutoff =
      Timestamp.fromDate(
        thirtyDaysAgo
      );

    let totalDeleted = 0;

    try {
      // FIX #2646: cursor+loop pattern — iterar todas as paginas
      // de alertas acknowledged antigos, não apenas uma pagina de 500.
      const baseQuery = db
        .collection("alerts")
        .where("acknowledged", "==", true)
        .where("created_at", "<", cutoff)
        .orderBy("created_at")
        .limit(500);

      let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
      let hasMore = true;

      while (hasMore) {
        const pageQuery = lastDoc ?
          baseQuery.startAfter(lastDoc) :
          baseQuery;
        const oldAlertsSnap = await pageQuery.get();

        if (oldAlertsSnap.empty) {
          hasMore = false;
          break;
        }

        const batch = db.batch();
        oldAlertsSnap.docs.forEach(
          (doc) => batch.delete(doc.ref)
        );
        await batch.commit();
        totalDeleted += oldAlertsSnap.size;

        if (oldAlertsSnap.size < 500) {
          hasMore = false;
        } else {
          lastDoc = oldAlertsSnap.docs[oldAlertsSnap.docs.length - 1];
        }
      }

      if (totalDeleted === 0) {
        logger.info(
          "[ALERTS_CLEANUP] Nenhum alerta " +
          "antigo para limpar"
        );
      } else {
        logger.info(
          "[ALERTS_CLEANUP] " +
          `${totalDeleted} alertas ` +
          "antigos removidos"
        );
      }
    } catch (error) {
      logger.error(
        "[ALERTS_CLEANUP] Erro:", error
      );
      throw error;
    }
  });
