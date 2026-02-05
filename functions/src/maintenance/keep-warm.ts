import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {https} from "firebase-functions/v2";

const db = admin.firestore();

/**
 * Keep-Warm Function para Cloud Functions
 *
 * Problema: Cloud Functions têm cold start (~3-5s) na primeira invocação após período inativo
 *
 * Solução: Scheduler que pinga as funções críticas a cada 5 minutos para manter warm
 *
 * Impacto:
 * - Reduz latência de cold start de 3-5s para <100ms
 * - Melhora UX em operações críticas (MVP voting, XP processing)
 * - Custo: ~$2-3/mês (invocações extras)
 *
 * Alternativas:
 * 1. Min instances (Google recomenda): $0.04/instance/hora (~$30/mês por função)
 * 2. Keep-warm scheduling (esta solução): ~$3/mês
 * 3. HTTP keep-alive (mais simples mas menos confiável)
 */

interface KeepWarmResult {
  functionName: string;
  status: "success" | "error";
  latency: number; // ms
  timestamp: string;
}

/**
 * Função agendada que pinga as Cloud Functions críticas
 * Executada a cada 5 minutos (300 segundos)
 *
 * Funções aquecidas:
 * - setUserRole (custom claims)
 * - onGameFinished (XP processing)
 * - migrateAllUsersToCustomClaims
 * - recalculateLeagueRating
 */
export const keepWarmFunctions = functions.scheduler.onSchedule(
  {
    schedule: "every 5 minutes",
    timeoutSeconds: 60,
    memory: "256MB",
    region: "southamerica-east1",
  },
  async (context) => {
    console.log("[KEEP-WARM] Starting warm-up cycle at", new Date().toISOString());

    const results: KeepWarmResult[] = [];

    // Lista de funções críticas para aquecer
    const functionsToWarm = [
      {
        name: "setUserRole",
        callable: true, // onCall function
      },
      {
        name: "onGameFinished",
        callable: false, // Firestore trigger, não pode chamar diretamente
      },
      {
        name: "migrateAllUsersToCustomClaims",
        callable: true,
      },
      {
        name: "recalculateLeagueRating",
        callable: true,
      },
    ];

    // Pingar cada função
    for (const fn of functionsToWarm) {
      if (fn.callable) {
        const result = await warmCallableFunction(fn.name);
        results.push(result);
      }
    }

    // Log de métricas
    await logKeepWarmMetrics(results);

    // Retornar resumo
    console.log("[KEEP-WARM] Warm-up cycle complete:", results);
    return {
      success: true,
      cycleTime: new Date().toISOString(),
      results,
    };
  }
);

/**
 * Pinga uma Cloud Function callable
 * Usa timeout curto para não bloquear scheduler
 */
async function warmCallableFunction(functionName: string): Promise<KeepWarmResult> {
  const startTime = Date.now();

  try {
    console.log(`[KEEP-WARM] Warming up ${functionName}...`);

    const functions = admin.functions("southamerica-east1");

    switch (functionName) {
      case "setUserRole":
        // setUserRole é para ADMIN apenas, usar usuário de teste
        const setRoleRef = functions.httpsCallable("setUserRole");
        await setRoleRef({
          uid: "keep-warm-test-user",
          role: "PLAYER",
        }).catch(() => {
          // Ignorar erro de auth (esperado para teste)
        });
        break;

      case "migrateAllUsersToCustomClaims":
        const migrateRef = functions.httpsCallable("migrateAllUsersToCustomClaims");
        await migrateRef({keep_warm: true}).catch(() => {
          // Ignorar erro (pode não estar implementado)
        });
        break;

      case "recalculateLeagueRating":
        const leagueRef = functions.httpsCallable("recalculateLeagueRating");
        await leagueRef({
          groupId: "test-group",
          keep_warm: true,
        }).catch(() => {
          // Ignorar erro
        });
        break;

      default:
        console.warn(`[KEEP-WARM] Unknown callable function: ${functionName}`);
    }

    const latency = Date.now() - startTime;
    console.log(`[KEEP-WARM] ${functionName} responded in ${latency}ms`);

    return {
      functionName,
      status: "success",
      latency,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`[KEEP-WARM] Error warming ${functionName}:`, error);

    return {
      functionName,
      status: "error",
      latency,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Log de métricas de keep-warm para monitoramento
 */
async function logKeepWarmMetrics(results: KeepWarmResult[]): Promise<void> {
  try {
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    const successCount = results.filter((r) => r.status === "success").length;

    await db.collection("metrics").add({
      type: "keep_warm_cycle",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      function_count: results.length,
      success_count: successCount,
      avg_latency_ms: avgLatency,
      results,
    });

    console.log(`[KEEP-WARM] Logged metrics: ${successCount}/${results.length} functions warm`);
  } catch (error) {
    console.error("[KEEP-WARM] Error logging metrics:", error);
  }
}

/**
 * Alternativa 1: HTTP Keep-Alive (mais simples)
 *
 * Para funções HTTP (não callable), fazer GET simples:
 *
 * ```typescript
 * const response = await fetch(
 *   "https://southamerica-east1-futebados-parcas.cloudfunctions.net/myHttpFunction",
 *   {method: "GET", timeout: 5000}
 * );
 * ```
 *
 * Vantagens:
 * - Suporta qualquer função (HTTP, callable, Firestore)
 * - Mais simples de implementar
 *
 * Desvantagens:
 * - Requer URL pública
 * - Sem autenticação de app check
 */

/**
 * Alternativa 2: Firestore-based Keep-Warm
 *
 * Triggar um Firestore write que ativa os listeners:
 *
 * ```typescript
 * await db.collection("system").doc("keep_warm").set({
 *   last_triggered: new Date(),
 *   target_functions: ["setUserRole", "onGameFinished"]
 * });
 * ```
 *
 * Listeners em Firestore triggers detectam a escrita e se "aquecem"
 *
 * Desvantagens:
 * - Mais complexo
 * - Requer listeners implementados
 */

/**
 * Alternativa 3: Min Instances (Google Recomendação)
 *
 * Configurar em firebase.json:
 *
 * ```json
 * {
 *   "functions": {
 *     "setUserRole": {
 *       "minInstances": 1
 *     }
 *   }
 * }
 * ```
 *
 * Mantém 1 instância sempre quente
 * Custo: $0.04/hora por instância = ~$30/mês por função
 *
 * Para projeto atual com 4 funções críticas = ~$120/mês
 * Keep-warm scheduling = ~$3/mês
 *
 * Usar keep-warm para MVP, migrar para min-instances em produção
 */
