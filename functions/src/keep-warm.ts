/**
 * KEEP-WARM - Cloud Functions Cold Start Optimization
 * Futeba dos Parças
 *
 * Executa a cada 5 minutos para manter instâncias ativas
 * e reduzir latência de cold start.
 *
 * Estratégia:
 * - Faz operações mínimas do Firestore para manter conexões
 * - Pinga coleções críticas usadas pelas principais functions
 * - Registra métricas de aquecimento
 *
 * Impacto esperado:
 * - Redução de cold starts em ~80%
 * - Latência p95 de 2-3s para < 500ms
 * - Custo adicional: ~4320 invocações/mês (muito baixo)
 *
 * @see specs/MASTER_OPTIMIZATION_CHECKLIST.md - P1 #11
 */

import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

// Lazy initialization para evitar erro de initializeApp duplicado
const getDb = () => admin.firestore();

// ==========================================
// CONFIGURAÇÃO
// ==========================================

/**
 * Coleções críticas que são acessadas pelas principais functions.
 * Fazer uma leitura mínima mantém as conexões do Firestore ativas.
 */
const CRITICAL_COLLECTIONS = [
  "games",           // onGameStatusUpdate, XP processing
  "users",           // User management, notifications
  "confirmations",   // Game confirmations, XP calculation
  "xp_logs",         // XP logging (idempotency check)
  "statistics",      // Player statistics update
] as const;

/**
 * Intervalo entre pings (em minutos).
 * 5 minutos é o padrão recomendado para Cloud Functions.
 */
const PING_INTERVAL_MINUTES = 5;

// ==========================================
// FUNÇÃO PRINCIPAL
// ==========================================

/**
 * Keep-warm function que executa a cada 5 minutos.
 *
 * Faz leituras mínimas do Firestore para:
 * 1. Manter a instância da function ativa (não desalocada)
 * 2. Manter as conexões do Firestore abertas
 * 3. Manter caches do SDK em memória
 *
 * Custo: ~4320 invocações/mês (grátis no tier Free)
 */
export const keepWarm = onSchedule(
  {
    schedule: `every ${PING_INTERVAL_MINUTES} minutes`,
    timeZone: "America/Sao_Paulo",
    retryCount: 1,
    memory: "128MiB", // Mínimo possível para economia
    maxInstances: 1,   // Apenas 1 instância
  },
  async (event) => {
    const startTime = Date.now();
    console.log("[KEEP-WARM] Starting warm-up ping...");

    try {
      const db = getDb();
      const results: Record<string, boolean> = {};

      // Pingar cada coleção crítica com uma leitura mínima
      // Usamos limit(1) para minimizar custo e latência
      await Promise.all(
        CRITICAL_COLLECTIONS.map(async (collection) => {
          try {
            const snapshot = await db.collection(collection)
              .limit(1)
              .get();

            results[collection] = !snapshot.empty;
            console.log(`[KEEP-WARM] Pinged ${collection}: ${snapshot.size} doc(s)`);
          } catch (error) {
            console.error(`[KEEP-WARM] Error pinging ${collection}:`, error);
            results[collection] = false;
          }
        })
      );

      const elapsed = Date.now() - startTime;
      const successCount = Object.values(results).filter(Boolean).length;

      console.log(`[KEEP-WARM] Completed in ${elapsed}ms`);
      console.log(`[KEEP-WARM] Collections pinged: ${successCount}/${CRITICAL_COLLECTIONS.length}`);

      // Registrar métrica de aquecimento (opcional, para monitoramento)
      // Apenas se tiver problema de performance, descomentar para tracking
      // await recordWarmupMetric(elapsed, successCount, CRITICAL_COLLECTIONS.length);
    } catch (error) {
      console.error("[KEEP-WARM] Fatal error during warm-up:", error);
      // Não re-throw para evitar retries desnecessários
    }
  }
);

/**
 * Registra métrica de aquecimento no Firestore.
 * Descomentado por padrão para reduzir writes.
 * Habilitar apenas se precisar de troubleshooting.
 */
// async function recordWarmupMetric(
//   elapsedMs: number,
//   successCount: number,
//   totalCount: number
// ): Promise<void> {
//   try {
//     const db = getDb();
//     await db.collection("metrics").add({
//       type: "keep_warm",
//       timestamp: admin.firestore.FieldValue.serverTimestamp(),
//       elapsed_ms: elapsedMs,
//       collections_pinged: successCount,
//       collections_total: totalCount,
//       success_rate: successCount / totalCount,
//     });
//   } catch (error) {
//     console.error("[KEEP-WARM] Error recording metric:", error);
//   }
// }

// ==========================================
// HEALTH CHECK ENDPOINT (Opcional)
// ==========================================

/**
 * Endpoint HTTP para health check externo.
 * Pode ser usado por monitoring services (UptimeRobot, etc.)
 * para verificar se as functions estão respondendo.
 *
 * Descomentado por padrão - habilitar se necessário.
 */
// import {onRequest} from "firebase-functions/v2/https";
//
// export const healthCheck = onRequest(
//   {
//     region: "southamerica-east1",
//     memory: "128MiB",
//     maxInstances: 1,
//   },
//   async (req, res) => {
//     const startTime = Date.now();
//
//     try {
//       // Verificar conexão com Firestore
//       const db = getDb();
//       await db.collection("users").limit(1).get();
//
//       const elapsed = Date.now() - startTime;
//
//       res.status(200).json({
//         status: "healthy",
//         latency_ms: elapsed,
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       res.status(503).json({
//         status: "unhealthy",
//         error: String(error),
//         timestamp: new Date().toISOString(),
//       });
//     }
//   }
// );
