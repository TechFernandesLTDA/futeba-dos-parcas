import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {db} from "../_db";


/**
 * Keep-Warm Function para Cloud Functions
 *
 * Problema: Cloud Functions têm cold start
 * (~3-5s) na primeira invocação após período
 * inativo.
 *
 * Solução: Scheduler que pinga as funções
 * críticas a cada 5 minutos para manter warm.
 *
 * Impacto:
 * - Reduz latência de cold start de 3-5s
 *   para <100ms
 * - Melhora UX em operações críticas
 *   (MVP voting, XP processing)
 * - Custo: ~$2-3/mês (invocações extras)
 *
 * Alternativas:
 * 1. Min instances (Google recomenda):
 *    $0.04/instance/hora (~$30/mês por função)
 * 2. Keep-warm scheduling (esta solução):
 *    ~$3/mês
 * 3. HTTP keep-alive (mais simples mas menos
 *    confiável)
 */

interface KeepWarmResult {
  functionName: string;
  status: "success" | "error";
  latency: number; // ms
  timestamp: string;
}

/**
 * Função agendada que pinga as Cloud Functions
 * críticas. Executada a cada 5 minutos.
 *
 * Funções aquecidas:
 * - setUserRole (custom claims)
 * - migrateAllUsersToCustomClaims
 * - recalculateLeagueRating
 *
 * FIX #1047: onGameFinished removido — é Firestore trigger (não callable),
 * não pode ser pingado via HTTP POST. Pingá-la sempre retornava 404/405,
 * inflando erros no log sem benefício de warm-up.
 */
export const keepWarmFunctions =
  functions.scheduler.onSchedule(
    {
      schedule: "every 5 minutes",
      timeoutSeconds: 60,
      memory: "256MiB",
      region: "southamerica-east1",
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_context) => {
      console.log(
        "[KEEP-WARM] Starting warm-up cycle at",
        new Date().toISOString()
      );

      const results: KeepWarmResult[] = [];

      // Lista de funções críticas para aquecer (apenas callables — triggers
      // Firestore não têm endpoint HTTP e não podem ser aquecidos assim)
      const functionsToWarm = [
        {
          name: "setUserRole",
          callable: true, // onCall function
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

      // Pingar todas as funções callable em paralelo
      // Antes: loop for..of sequencial (~200ms × N)
      // Depois: Promise.all (~200ms total)
      const warmResults = await Promise.all(
        functionsToWarm
          .filter((fn) => fn.callable)
          .map((fn) => warmCallableFunction(fn.name))
      );
      results.push(...warmResults);

      // Log de métricas
      await logKeepWarmMetrics(results);

      // Log resumo (onSchedule não suporta retorno)
      console.log(
        "[KEEP-WARM] Warm-up cycle complete:",
        JSON.stringify(results)
      );
    }
  );

// Região e projeto onde as funções estão deployadas
const REGION = "southamerica-east1";
const PROJECT_ID =
  process.env.GCLOUD_PROJECT || "futeba-dos-parcas";

/**
 * Constrói a URL HTTP de uma Cloud Function
 * callable v2 no projeto/região configurados.
 *
 * @param {string} functionName - Nome da função
 * @return {string} URL completa da função
 */
function buildFunctionUrl(functionName: string): string {
  return (
    `https://${REGION}-${PROJECT_ID}` +
    `.cloudfunctions.net/${functionName}`
  );
}

/**
 * Pinga uma Cloud Function callable via HTTP POST.
 * A escrita Firestore anterior não invocava a
 * função — apenas escrevia um documento, o que não
 * aquecia o container da CF alvo. Esta implementação
 * envia uma requisição HTTP real à URL da função,
 * forçando o Cold Start antes do tráfego real.
 *
 * Usa AbortSignal com timeout de 8 s para não
 * bloquear o scheduler caso a função esteja
 * em inicialização demorada.
 *
 * @param {string} functionName - Nome da função
 * @return {Promise<KeepWarmResult>} Resultado
 */
async function warmCallableFunction(
  functionName: string
): Promise<KeepWarmResult> {
  const startTime = Date.now();

  try {
    console.log(
      `[KEEP-WARM] Warming up ${functionName}...`
    );

    const url = buildFunctionUrl(functionName);

    // Callable functions v2 esperam POST com
    // body JSON {"data": ...}. Uma requisição
    // sem autenticação válida retorna 401/403,
    // mas o container já estará aquecido.
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(), 8000
    );

    try {
      await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({data: {_keepWarm: true}}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const latency = Date.now() - startTime;
    console.log(
      `[KEEP-WARM] ${functionName} ` +
      `pinged in ${latency}ms`
    );

    return {
      functionName,
      status: "success",
      latency,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(
      "[KEEP-WARM] Error warming " +
      `${functionName}:`, error
    );

    return {
      functionName,
      status: "error",
      latency,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Log de métricas de keep-warm para
 * monitoramento.
 *
 * @param {KeepWarmResult[]} results - Resultados
 * @return {Promise<void>} Promessa vazia
 */
async function logKeepWarmMetrics(
  results: KeepWarmResult[]
): Promise<void> {
  try {
    const avgLatency = results.reduce(
      (sum, r) => sum + r.latency, 0
    ) / results.length;
    const successCount = results.filter(
      (r) => r.status === "success"
    ).length;

    await db().collection("metrics").add({
      type: "keep_warm_cycle",
      timestamp:
        admin.firestore.FieldValue
          .serverTimestamp(),
      function_count: results.length,
      success_count: successCount,
      avg_latency_ms: avgLatency,
      results,
    });

    console.log(
      "[KEEP-WARM] Logged metrics: " +
      `${successCount}/${results.length} ` +
      "functions warm"
    );
  } catch (error) {
    console.error(
      "[KEEP-WARM] Error logging metrics:", error
    );
  }
}

/**
 * Alternativa 1: HTTP Keep-Alive (mais simples)
 *
 * Para funções HTTP (não callable), fazer GET:
 *
 * ```typescript
 * const response = await fetch(
 *   "https://southamerica-east1-futebados" +
 *   "-parcas.cloudfunctions.net/myHttpFunction",
 *   {method: "GET", timeout: 5000}
 * );
 * ```
 *
 * Vantagens:
 * - Suporta qualquer função
 * - Mais simples de implementar
 *
 * Desvantagens:
 * - Requer URL pública
 * - Sem autenticação de app check
 */

/**
 * Alternativa 2: Firestore-based Keep-Warm
 *
 * Triggar um Firestore write que ativa os
 * listeners:
 *
 * ```typescript
 * await db().collection("system")
 *   .doc("keep_warm").set({
 *     last_triggered: new Date(),
 *     target_functions: [
 *       "setUserRole",
 *       "onGameFinished"
 *     ]
 *   });
 * ```
 *
 * Listeners em Firestore triggers detectam a
 * escrita e se "aquecem".
 *
 * Desvantagens:
 * - Mais complexo
 * - Requer listeners implementados
 */

/**
 * Alternativa 3: Min Instances (Google Recomenda)
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
 * Mantém 1 instância sempre quente.
 * Custo: $0.04/hora por instância = ~$30/mês.
 *
 * Para projeto atual com 4 funções
 * críticas = ~$120/mês.
 * Keep-warm scheduling = ~$3/mês.
 *
 * Usar keep-warm para MVP, migrar para
 * min-instances em produção.
 */
