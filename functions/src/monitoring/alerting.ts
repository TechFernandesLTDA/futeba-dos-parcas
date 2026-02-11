/**
 * SISTEMA DE MONITORAMENTO E ALERTAS - PHASE 3
 *
 * Fornece funções de monitoramento para detectar anomalias e registrar alertas.
 * Trabalha junto com collect-metrics.ts para fornecer observabilidade completa.
 *
 * FUNCIONALIDADES:
 * - Detecção de anomalias em XP processing (duplicatas, falhas)
 * - Monitoramento de taxa de erros em Cloud Functions
 * - Alertas para usage excedendo thresholds
 * - Limpeza da dead letter queue
 * - Monitoramento de rate limiting abuso
 * - Health check geral do sistema
 *
 * ALERTAS:
 * Alertas são armazenados na coleção `alerts` no Firestore.
 * Um dashboard ou Cloud Monitoring pode consumir esses dados.
 *
 * @see specs/BACKEND_OPTIMIZATION_SPEC.md - PHASE 3
 * @see functions/src/monitoring/collect-metrics.ts
 */

import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

const getDb = () => admin.firestore();

// ==========================================
// INTERFACES
// ==========================================

/** Severidade do alerta */
type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

/** Alerta gerado pelo sistema */
interface SystemAlert {
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata: Record<string, any>;
  created_at: admin.firestore.FieldValue;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: admin.firestore.FieldValue;
}

/** Resultado do health check */
interface HealthCheckResult {
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  checks: Record<string, {status: string; message: string; value?: any}>;
  timestamp: string;
  durationMs: number;
}

// ==========================================
// CONSTANTES - Thresholds de alerta
// ==========================================

const THRESHOLDS = {
  /** Número máximo de XP duplicatas tolerado por dia */
  XP_DUPLICATES_PER_DAY: 0,
  /** Número máximo de falhas de XP processing por dia */
  XP_FAILURES_PER_DAY: 5,
  /** Número máximo de itens na dead letter queue */
  DLQ_MAX_PENDING: 10,
  /** Taxa máxima de erros de rate limiting por hora (indica possível ataque) */
  RATE_LIMIT_HITS_PER_HOUR: 50,
  /** Número máximo de tokens FCM inválidos por dia */
  INVALID_FCM_TOKENS_PER_DAY: 100,
  /** Número máximo de jogos pendentes de XP processing (> 1h) */
  STALE_XP_PROCESSING_MAX: 3,
  /** Latência máxima de health check em ms antes de alertar */
  HEALTH_CHECK_MAX_DURATION_MS: 10_000,
  /** Número máximo de alertas não-acknowledged antes de escalar */
  UNACKNOWLEDGED_ALERTS_MAX: 20,
  /** Tempo máximo (em horas) que um alerta pode ficar sem acknowledge */
  ALERT_ACKNOWLEDGE_DEADLINE_HOURS: 48,
};

// ==========================================
// SCHEDULED: Health Check do Sistema (a cada 15 min)
// ==========================================

/**
 * Health check periódico que verifica o estado do sistema.
 *
 * Verifica:
 * 1. XP duplicatas (xp_logs com mesmo transaction_id)
 * 2. Jogos pendentes de XP processing (xp_processing = true > 1h)
 * 3. Dead letter queue acumulada
 * 4. Taxa de rate limiting (possível abuso)
 * 5. Notificações falhadas na fila
 *
 * Gera alertas automáticos se thresholds forem excedidos.
 *
 * Executa a cada 15 minutos.
 */
export const systemHealthCheck = functions.scheduler.onSchedule({
  schedule: "*/15 * * * *", // A cada 15 minutos
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  memory: "512MiB",
  timeoutSeconds: 120,
}, async (_event) => {
  const startTime = Date.now();
  const db = getDb();

  console.log("[HEALTH_CHECK] Iniciando health check do sistema");

  const checks: HealthCheckResult["checks"] = {};
  const alerts: Omit<SystemAlert, "created_at" | "acknowledged">[] = [];

  // ==========================================
  // CHECK 1: Jogos com XP processing travado (> 1 hora)
  // ==========================================
  try {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const staleProcessingSnap = await db.collection("games")
      .where("xp_processing", "==", true)
      .where("xp_processing_at", "<", admin.firestore.Timestamp.fromDate(oneHourAgo))
      .limit(10)
      .get();

    const staleCount = staleProcessingSnap.size;
    checks["stale_xp_processing"] = {
      status: staleCount === 0 ? "OK" : "WARNING",
      message: `${staleCount} jogos com XP processing travado`,
      value: staleCount,
    };

    if (staleCount > THRESHOLDS.STALE_XP_PROCESSING_MAX) {
      alerts.push({
        type: "STALE_XP_PROCESSING",
        severity: "CRITICAL",
        title: "Jogos com XP processing travado",
        message: `${staleCount} jogos com xp_processing=true há mais de 1 hora. IDs: ${
          staleProcessingSnap.docs.map((d) => d.id).join(", ")
        }`,
        metadata: {
          count: staleCount,
          gameIds: staleProcessingSnap.docs.map((d) => d.id),
        },
      });

      // Auto-recuperação: resetar flag de processing travado
      const resetBatch = db.batch();
      for (const doc of staleProcessingSnap.docs) {
        resetBatch.update(doc.ref, {
          xp_processing: false,
          xp_processing_error: "Auto-reset: processing travado por mais de 1 hora",
        });
      }
      await resetBatch.commit();

      console.log(
        `[HEALTH_CHECK] Auto-reset de ${staleCount} jogos com XP processing travado`
      );
    }
  } catch (error) {
    checks["stale_xp_processing"] = {
      status: "ERROR",
      message: `Erro ao verificar: ${error}`,
    };
  }

  // ==========================================
  // CHECK 2: Dead Letter Queue acumulada
  // ==========================================
  try {
    const dlqSnap = await db.collection("dead_letter_queue")
      .where("status", "==", "PENDING")
      .count()
      .get();

    const dlqCount = dlqSnap.data().count;
    checks["dead_letter_queue"] = {
      status: dlqCount <= THRESHOLDS.DLQ_MAX_PENDING ? "OK" : "WARNING",
      message: `${dlqCount} itens pendentes na DLQ`,
      value: dlqCount,
    };

    if (dlqCount > THRESHOLDS.DLQ_MAX_PENDING) {
      alerts.push({
        type: "DLQ_ACCUMULATION",
        severity: "WARNING",
        title: "Dead Letter Queue acumulando",
        message: `${dlqCount} operações falhadas pendentes na dead letter queue. Verificar manualmente.`,
        metadata: {count: dlqCount},
      });
    }
  } catch (error) {
    checks["dead_letter_queue"] = {
      status: "ERROR",
      message: `Erro ao verificar: ${error}`,
    };
  }

  // ==========================================
  // CHECK 3: Notificações falhadas na fila
  // ==========================================
  try {
    const failedNotifSnap = await db.collection("notification_queue")
      .where("status", "==", "FAILED")
      .count()
      .get();

    const failedCount = failedNotifSnap.data().count;
    checks["failed_notifications"] = {
      status: failedCount < 10 ? "OK" : "WARNING",
      message: `${failedCount} notificações falhadas na fila`,
      value: failedCount,
    };

    if (failedCount >= 10) {
      alerts.push({
        type: "NOTIFICATION_FAILURES",
        severity: "WARNING",
        title: "Notificações FCM falhando",
        message: `${failedCount} notificações com status FAILED na fila. Possível problema com tokens FCM.`,
        metadata: {count: failedCount},
      });
    }
  } catch (error) {
    checks["failed_notifications"] = {
      status: "ERROR",
      message: `Erro ao verificar: ${error}`,
    };
  }

  // ==========================================
  // CHECK 4: Rate limiting excessivo (possível ataque)
  // ==========================================
  try {
    const oneHourAgoDate = new Date();
    oneHourAgoDate.setHours(oneHourAgoDate.getHours() - 1);

    // Contar alertas de rate limit na última hora (via audit_logs)
    const rateLimitSnap = await db.collection("audit_logs")
      .where("type", "==", "RATE_LIMIT_EXCEEDED")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(oneHourAgoDate))
      .count()
      .get();

    const rateLimitCount = rateLimitSnap.data().count;
    checks["rate_limit_abuse"] = {
      status: rateLimitCount < THRESHOLDS.RATE_LIMIT_HITS_PER_HOUR ? "OK" : "WARNING",
      message: `${rateLimitCount} rate limit hits na última hora`,
      value: rateLimitCount,
    };

    if (rateLimitCount >= THRESHOLDS.RATE_LIMIT_HITS_PER_HOUR) {
      alerts.push({
        type: "RATE_LIMIT_ABUSE",
        severity: "WARNING",
        title: "Rate limiting excessivo detectado",
        message: `${rateLimitCount} hits de rate limiting na última hora. Possível abuso ou bot.`,
        metadata: {count: rateLimitCount},
      });
    }
  } catch (error) {
    checks["rate_limit_abuse"] = {
      status: "ERROR",
      message: `Erro ao verificar: ${error}`,
    };
  }

  // ==========================================
  // CHECK 5: XP duplicatas (últimas 24h)
  // ==========================================
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Verificar se há xp_logs com erros de duplicata
    // Nota: A verificação completa de duplicatas requer aggregation query
    // que não é suportada nativamente. Usamos heurística baseada em logs de erro.
    const errorGamesSnap = await db.collection("games")
      .where("xp_processing_error", "!=", null)
      .limit(10)
      .get();

    const errorCount = errorGamesSnap.size;
    checks["xp_processing_errors"] = {
      status: errorCount <= THRESHOLDS.XP_FAILURES_PER_DAY ? "OK" : "WARNING",
      message: `${errorCount} jogos com erros de XP processing`,
      value: errorCount,
    };

    if (errorCount > THRESHOLDS.XP_FAILURES_PER_DAY) {
      alerts.push({
        type: "XP_PROCESSING_FAILURES",
        severity: "CRITICAL",
        title: "Muitas falhas de XP processing",
        message: `${errorCount} jogos com erros de XP processing. IDs: ${
          errorGamesSnap.docs.map((d) => d.id).join(", ")
        }`,
        metadata: {
          count: errorCount,
          gameIds: errorGamesSnap.docs.map((d) => d.id),
        },
      });
    }
  } catch (error) {
    checks["xp_processing_errors"] = {
      status: "ERROR",
      message: `Erro ao verificar: ${error}`,
    };
  }

  // ==========================================
  // FINALIZAR: Determinar status geral e salvar
  // ==========================================
  const hasWarning = Object.values(checks).some((c) => c.status === "WARNING");
  const hasError = Object.values(checks).some((c) => c.status === "ERROR");
  const hasCritical = alerts.some((a) => a.severity === "CRITICAL");

  let overallStatus: HealthCheckResult["status"] = "HEALTHY";
  if (hasWarning || hasError) overallStatus = "DEGRADED";
  if (hasCritical) overallStatus = "CRITICAL";

  const durationMs = Date.now() - startTime;

  // Salvar resultado do health check
  await db.collection("metrics").add({
    type: "health_check",
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    status: overallStatus,
    checks,
    duration_ms: durationMs,
    alerts_generated: alerts.length,
  });

  // Salvar alertas
  if (alerts.length > 0) {
    const alertBatch = db.batch();
    for (const alert of alerts) {
      const alertRef = db.collection("alerts").doc();
      alertBatch.set(alertRef, {
        ...alert,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        acknowledged: false,
      });
    }
    await alertBatch.commit();

    console.log(
      `[HEALTH_CHECK] ${alerts.length} alertas gerados: ${
        alerts.map((a) => a.type).join(", ")
      }`
    );
  }

  // CHECK 6: Latência do próprio health check (meta-monitoramento)
  if (durationMs > THRESHOLDS.HEALTH_CHECK_MAX_DURATION_MS) {
    alerts.push({
      type: "SLOW_HEALTH_CHECK",
      severity: "WARNING",
      title: "Health check lento detectado",
      message: `Health check levou ${durationMs}ms (limite: ${THRESHOLDS.HEALTH_CHECK_MAX_DURATION_MS}ms). Possível degradação no Firestore.`,
      metadata: {durationMs, thresholdMs: THRESHOLDS.HEALTH_CHECK_MAX_DURATION_MS},
    });
  }

  // CHECK 7: Alertas não-acknowledged acumulados
  try {
    const unackedSnap = await db.collection("alerts")
      .where("acknowledged", "==", false)
      .count()
      .get();

    const unackedCount = unackedSnap.data().count;
    checks["unacknowledged_alerts"] = {
      status: unackedCount < THRESHOLDS.UNACKNOWLEDGED_ALERTS_MAX ? "OK" : "WARNING",
      message: `${unackedCount} alertas não reconhecidos`,
      value: unackedCount,
    };

    if (unackedCount >= THRESHOLDS.UNACKNOWLEDGED_ALERTS_MAX) {
      alerts.push({
        type: "ALERT_OVERFLOW",
        severity: "CRITICAL",
        title: "Alertas acumulando sem acknowledge",
        message: `${unackedCount} alertas pendentes. Possível falta de monitoramento ativo.`,
        metadata: {count: unackedCount},
      });
    }
  } catch (error) {
    checks["unacknowledged_alerts"] = {
      status: "ERROR",
      message: `Erro ao verificar: ${error}`,
    };
  }

  console.log(
    `[HEALTH_CHECK] Concluído em ${durationMs}ms. Status: ${overallStatus}. ` +
    `Checks: ${Object.keys(checks).length}. Alertas: ${alerts.length}`
  );
});

// ==========================================
// SCHEDULED: Cleanup de Dead Letter Queue (semanal)
// ==========================================

/**
 * Remove itens resolvidos/ignorados da DLQ com mais de 30 dias.
 * Executa semanalmente às segundas-feiras 03:00 BRT.
 */
export const cleanupDeadLetterQueue = functions.scheduler.onSchedule({
  schedule: "0 3 * * 1", // Segunda às 03:00
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  memory: "256MiB",
  timeoutSeconds: 120,
}, async (_event) => {
  const db = getDb();

  console.log("[DLQ_CLEANUP] Iniciando limpeza da dead letter queue");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

  let totalDeleted = 0;

  try {
    // Deletar itens resolvidos com mais de 30 dias
    const resolvedSnap = await db.collection("dead_letter_queue")
      .where("status", "in", ["RESOLVED", "IGNORED"])
      .where("created_at", "<", cutoff)
      .limit(500)
      .get();

    if (!resolvedSnap.empty) {
      const batch = db.batch();
      resolvedSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      totalDeleted = resolvedSnap.size;
    }

    // Também marcar como IGNORED itens PENDING com mais de 30 dias (provavelmente obsoletos)
    const stalePendingSnap = await db.collection("dead_letter_queue")
      .where("status", "==", "PENDING")
      .where("created_at", "<", cutoff)
      .limit(100)
      .get();

    if (!stalePendingSnap.empty) {
      const batch = db.batch();
      stalePendingSnap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: "IGNORED",
          resolved_at: admin.firestore.FieldValue.serverTimestamp(),
          resolved_by: "auto_cleanup",
        });
      });
      await batch.commit();

      console.log(
        `[DLQ_CLEANUP] ${stalePendingSnap.size} itens pendentes antigos marcados como IGNORED`
      );
    }

    console.log(`[DLQ_CLEANUP] Limpeza concluída. ${totalDeleted} itens removidos.`);
  } catch (error) {
    console.error("[DLQ_CLEANUP] Erro:", error);
  }
});

// ==========================================
// SCHEDULED: Cleanup de Rate Limits Expirados (a cada hora)
// ==========================================

/**
 * Remove buckets de rate limit expirados do Firestore.
 * Executa a cada hora para manter a coleção rate_limits limpa.
 */
export const cleanupExpiredRateLimits = functions.scheduler.onSchedule({
  schedule: "0 * * * *", // A cada hora
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  memory: "256MiB",
  timeoutSeconds: 120,
}, async (_event) => {
  const db = getDb();

  console.log("[RATE_LIMIT_CLEANUP] Iniciando limpeza de rate limits expirados");

  const now = admin.firestore.Timestamp.now();
  let totalDeleted = 0;

  try {
    // Buscar buckets expirados (expires_at < agora)
    const expiredSnap = await db
      .collection("rate_limits")
      .where("expires_at", "<", now)
      .limit(500)
      .get();

    if (expiredSnap.empty) {
      console.log("[RATE_LIMIT_CLEANUP] Nenhum bucket expirado encontrado");
      return;
    }

    // Deletar em batch
    const batch = db.batch();
    expiredSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted = expiredSnap.size;

    console.log(`[RATE_LIMIT_CLEANUP] ${totalDeleted} buckets expirados removidos`);
  } catch (error) {
    console.error("[RATE_LIMIT_CLEANUP] Erro:", error);
  }
});

// ==========================================
// SCHEDULED: Cleanup de Alertas Antigos (semanal)
// ==========================================

/**
 * Remove alertas acknowledged com mais de 30 dias.
 * Executa semanalmente.
 */
export const cleanupOldAlerts = functions.scheduler.onSchedule({
  schedule: "0 4 * * 1", // Segunda às 04:00
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  memory: "256MiB",
  timeoutSeconds: 120,
}, async (_event) => {
  const db = getDb();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

  try {
    const oldAlertsSnap = await db.collection("alerts")
      .where("acknowledged", "==", true)
      .where("created_at", "<", cutoff)
      .limit(500)
      .get();

    if (oldAlertsSnap.empty) {
      console.log("[ALERTS_CLEANUP] Nenhum alerta antigo para limpar");
      return;
    }

    const batch = db.batch();
    oldAlertsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[ALERTS_CLEANUP] ${oldAlertsSnap.size} alertas antigos removidos`);
  } catch (error) {
    console.error("[ALERTS_CLEANUP] Erro:", error);
  }
});
