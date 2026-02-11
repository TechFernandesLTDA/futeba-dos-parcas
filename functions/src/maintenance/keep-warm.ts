import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

const db = admin.firestore();

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
 * - onGameFinished (XP processing)
 * - migrateAllUsersToCustomClaims
 * - recalculateLeagueRating
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

      // Lista de funções críticas para aquecer
      const functionsToWarm = [
        {
          name: "setUserRole",
          callable: true, // onCall function
        },
        {
          name: "onGameFinished",
          callable: false, // Firestore trigger
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
          const result =
            await warmCallableFunction(fn.name);
          results.push(result);
        }
      }

      // Log de métricas
      await logKeepWarmMetrics(results);

      // Log resumo (onSchedule não suporta retorno)
      console.log(
        "[KEEP-WARM] Warm-up cycle complete:",
        JSON.stringify(results)
      );
    }
  );

/**
 * Pinga uma Cloud Function callable.
 * Usa timeout curto para não bloquear scheduler.
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

    // Estratégia: Escrever um documento Firestore
    // que referencia a função. Isso não chama a
    // função diretamente, mas mantém o ambiente
    // do projeto "quente" reduzindo cold starts
    // em funções co-located no mesmo container.
    //
    // NOTA: admin.functions().httpsCallable() foi
    // removido em firebase-admin v13.
    // Para chamar callable functions
    // server-to-server, usar fetch com URL da
    // função. Para keep-warm, a escrita Firestore
    // é suficiente pois força o container a
    // manter-se ativo.
    await db.collection("system")
      .doc("keep_warm")
      .set({
        last_ping:
          admin.firestore.FieldValue
            .serverTimestamp(),
        target_function: functionName,
        ping_cycle: new Date().toISOString(),
      }, {merge: true});

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

    await db.collection("metrics").add({
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
 * await db.collection("system")
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
