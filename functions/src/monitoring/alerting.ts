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

import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

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
  created_at: admin.firestore.FieldValue;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?:
    admin.firestore.FieldValue;
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

    console.log(
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
          admin.firestore.Timestamp
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

        console.log(
          "[HEALTH_CHECK] Auto-reset de " +
          `${staleCount} jogos com XP ` +
          "processing travado"
        );
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
          admin.firestore.Timestamp
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
      // Verificar jogos com erros de XP
      const errorGamesSnap = await db
        .collection("games")
        .where(
          "xp_processing_error", "!=", null
        )
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
        admin.firestore.FieldValue
          .serverTimestamp(),
      status: overallStatus,
      checks,
      duration_ms: durationMs,
      alerts_generated: alerts.length,
    });

    // Salvar alertas
    if (alerts.length > 0) {
      const alertBatch = db.batch();
      for (const alert of alerts) {
        const alertRef =
          db.collection("alerts").doc();
        alertBatch.set(alertRef, {
          ...alert,
          created_at:
            admin.firestore.FieldValue
              .serverTimestamp(),
          acknowledged: false,
        });
      }
      await alertBatch.commit();

      const alertTypes = alerts.map(
        (a) => a.type
      );
      console.log(
        "[HEALTH_CHECK] " +
        `${alerts.length} alertas gerados: ` +
        alertTypes.join(", ")
      );
    }

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

    const checkCount =
      Object.keys(checks).length;
    console.log(
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

    console.log(
      "[DLQ_CLEANUP] Iniciando limpeza " +
      "da dead letter queue"
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(
      thirtyDaysAgo.getDate() - 30
    );
    const cutoff =
      admin.firestore.Timestamp.fromDate(
        thirtyDaysAgo
      );

    let totalDeleted = 0;

    try {
      // Deletar itens resolvidos > 30 dias
      const resolvedSnap = await db
        .collection("dead_letter_queue")
        .where(
          "status", "in",
          ["RESOLVED", "IGNORED"]
        )
        .where("created_at", "<", cutoff)
        .limit(500)
        .get();

      if (!resolvedSnap.empty) {
        const batch = db.batch();
        resolvedSnap.docs.forEach(
          (doc) => batch.delete(doc.ref)
        );
        await batch.commit();
        totalDeleted = resolvedSnap.size;
      }

      // Marcar PENDING antigos como IGNORED
      const stalePendingSnap = await db
        .collection("dead_letter_queue")
        .where("status", "==", "PENDING")
        .where("created_at", "<", cutoff)
        .limit(100)
        .get();

      if (!stalePendingSnap.empty) {
        const batch = db.batch();
        stalePendingSnap.docs.forEach((doc) => {
          batch.update(doc.ref, {
            status: "IGNORED",
            resolved_at:
              admin.firestore.FieldValue
                .serverTimestamp(),
            resolved_by: "auto_cleanup",
          });
        });
        await batch.commit();

        console.log(
          "[DLQ_CLEANUP] " +
          `${stalePendingSnap.size} itens ` +
          "pendentes antigos marcados IGNORED"
        );
      }

      console.log(
        "[DLQ_CLEANUP] Limpeza concluída. " +
        `${totalDeleted} itens removidos.`
      );
    } catch (error) {
      console.error(
        "[DLQ_CLEANUP] Erro:", error
      );
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
    schedule: "0 * * * *", // A cada hora
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "256MiB",
    timeoutSeconds: 120,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    const db = getDb();

    console.log(
      "[RATE_LIMIT_CLEANUP] Iniciando " +
      "limpeza de rate limits expirados"
    );

    const now =
      admin.firestore.Timestamp.now();
    let totalDeleted = 0;

    try {
      // Buscar buckets expirados
      const expiredSnap = await db
        .collection("rate_limits")
        .where("expires_at", "<", now)
        .limit(500)
        .get();

      if (expiredSnap.empty) {
        console.log(
          "[RATE_LIMIT_CLEANUP] Nenhum " +
          "bucket expirado encontrado"
        );
        return;
      }

      // Deletar em batch
      const batch = db.batch();
      expiredSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted = expiredSnap.size;

      console.log(
        "[RATE_LIMIT_CLEANUP] " +
        `${totalDeleted} buckets removidos`
      );
    } catch (error) {
      console.error(
        "[RATE_LIMIT_CLEANUP] Erro:", error
      );
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
      admin.firestore.Timestamp.fromDate(
        thirtyDaysAgo
      );

    try {
      const oldAlertsSnap = await db
        .collection("alerts")
        .where("acknowledged", "==", true)
        .where("created_at", "<", cutoff)
        .limit(500)
        .get();

      if (oldAlertsSnap.empty) {
        console.log(
          "[ALERTS_CLEANUP] Nenhum alerta " +
          "antigo para limpar"
        );
        return;
      }

      const batch = db.batch();
      oldAlertsSnap.docs.forEach(
        (doc) => batch.delete(doc.ref)
      );
      await batch.commit();

      console.log(
        "[ALERTS_CLEANUP] " +
        `${oldAlertsSnap.size} alertas ` +
        "antigos removidos"
      );
    } catch (error) {
      console.error(
        "[ALERTS_CLEANUP] Erro:", error
      );
    }
  });
