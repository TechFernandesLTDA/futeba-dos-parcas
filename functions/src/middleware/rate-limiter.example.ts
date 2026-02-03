/**
 * EXEMPLOS DE USO DO RATE LIMITER
 *
 * Este arquivo demonstra diferentes formas de usar o middleware de rate limiting
 * em Cloud Functions callable.
 */

import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  withRateLimit,
  RATE_LIMITS,
  checkRateLimit,
  resetUserRateLimit,
  getUserRateLimitStats,
  cleanupExpiredRateLimits,
} from "./rate-limiter";

// ==========================================
// EXEMPLO 1: CALLABLE FUNCTION COM RATE LIMIT
// ==========================================

/**
 * Cria um jogo com rate limit de 10 requests/minuto
 */
export const createGameWithRateLimit = onCall(
  withRateLimit(RATE_LIMITS.GAME_CREATE, async (request) => {
    const { groupId, date, location } = request.data;

    // Sua lógica de criação de jogo aqui
    const gameId = `game_${Date.now()}`;

    return {
      success: true,
      gameId,
      message: "Jogo criado com sucesso",
    };
  })
);

/**
 * Atualiza um jogo com rate limit de 20 requests/minuto
 */
export const updateGameWithRateLimit = onCall(
  withRateLimit(RATE_LIMITS.GAME_UPDATE, async (request) => {
    const { gameId, updates } = request.data;

    // Sua lógica de atualização aqui

    return {
      success: true,
      gameId,
      message: "Jogo atualizado com sucesso",
    };
  })
);

// ==========================================
// EXEMPLO 2: RATE LIMIT CUSTOMIZADO
// ==========================================

/**
 * Operação sensível com rate limit mais restritivo
 */
export const deleteAccount = onCall(
  withRateLimit(
    {
      maxRequests: 2, // Apenas 2 tentativas
      windowMs: 60 * 60 * 1000, // Por hora
      keyPrefix: "delete_account",
    },
    async (request) => {
      const userId = request.auth!.uid;

      // Lógica de deleção de conta (irreversível)
      // ...

      return {
        success: true,
        message: "Conta deletada com sucesso",
      };
    }
  )
);

// ==========================================
// EXEMPLO 3: RATE LIMIT MANUAL (SEM MIDDLEWARE)
// ==========================================

/**
 * Função com controle manual de rate limit
 * Útil quando você precisa de lógica customizada antes/depois
 */
export const customRateLimitFunction = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("Usuário não autenticado");
  }

  const userId = request.auth.uid;

  // Verificar rate limit manualmente
  const { allowed, remaining, resetAt } = await checkRateLimit(userId, {
    maxRequests: 15,
    windowMs: 60 * 1000,
    keyPrefix: "custom_operation",
  });

  if (!allowed) {
    const resetInSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);

    return {
      success: false,
      error: `Rate limit excedido. Tente novamente em ${resetInSeconds} segundos.`,
      retryAfter: resetInSeconds,
    };
  }

  console.log(`Rate limit OK: ${remaining} requests restantes`);

  // Sua lógica aqui
  // ...

  return {
    success: true,
    remaining,
  };
});

// ==========================================
// EXEMPLO 4: RATE LIMIT PROGRESSIVO
// ==========================================

/**
 * Rate limit que aumenta com base no comportamento do usuário
 */
export const adaptiveRateLimitFunction = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("Usuário não autenticado");
  }

  const userId = request.auth.uid;

  // Buscar stats do usuário
  const stats = await getUserRateLimitStats(userId, "adaptive");

  // Ajustar limite baseado em uso anterior
  let maxRequests = 10; // Padrão
  if (stats.currentRequests > 50) {
    maxRequests = 5; // Reduzir limite para usuários heavy users
  } else if (stats.currentRequests < 5) {
    maxRequests = 20; // Aumentar limite para usuários novos
  }

  const { allowed, remaining } = await checkRateLimit(userId, {
    maxRequests,
    windowMs: 60 * 1000,
    keyPrefix: "adaptive",
  });

  if (!allowed) {
    return {
      success: false,
      error: "Rate limit excedido",
    };
  }

  return {
    success: true,
    remaining,
    limit: maxRequests,
  };
});

// ==========================================
// EXEMPLO 5: ADMIN FUNCTIONS
// ==========================================

/**
 * Reset de rate limit (apenas para admins)
 */
export const adminResetRateLimit = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("Não autenticado");
  }

  // Verificar se é admin (implementar sua lógica)
  const isAdmin = await checkIfUserIsAdmin(request.auth.uid);
  if (!isAdmin) {
    throw new Error("Permissão negada");
  }

  const { targetUserId, keyPrefix } = request.data;

  await resetUserRateLimit(targetUserId, keyPrefix || "default");

  return {
    success: true,
    message: `Rate limit resetado para usuário ${targetUserId}`,
  };
});

/**
 * Obter estatísticas de rate limit (apenas para admins)
 */
export const adminGetRateLimitStats = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("Não autenticado");
  }

  const isAdmin = await checkIfUserIsAdmin(request.auth.uid);
  if (!isAdmin) {
    throw new Error("Permissão negada");
  }

  const { targetUserId, keyPrefix } = request.data;

  const stats = await getUserRateLimitStats(targetUserId, keyPrefix || "default");

  return {
    success: true,
    stats: {
      currentRequests: stats.currentRequests,
      oldestRequest: stats.oldestRequest?.toISOString() || null,
    },
  };
});

// ==========================================
// EXEMPLO 6: SCHEDULED CLEANUP
// ==========================================

/**
 * Cleanup automático de rate limits expirados
 * Executa a cada 1 hora
 */
export const scheduledRateLimitCleanup = onSchedule("every 1 hours", async (event) => {
  console.log("[RATE_LIMIT_CLEANUP] Iniciando cleanup...");

  try {
    const deletedCount = await cleanupExpiredRateLimits();

    console.log(`[RATE_LIMIT_CLEANUP] ${deletedCount} buckets removidos`);
  } catch (error) {
    console.error("[RATE_LIMIT_CLEANUP] Erro:", error);
    throw error;
  }
});

// ==========================================
// EXEMPLO 7: RATE LIMIT POR OPERAÇÃO
// ==========================================

/**
 * Diferentes limites para diferentes endpoints
 */
export const gameOperations = {
  create: onCall(
    withRateLimit(RATE_LIMITS.GAME_CREATE, async (request) => {
      // Criar jogo
      return { success: true };
    })
  ),

  update: onCall(
    withRateLimit(RATE_LIMITS.GAME_UPDATE, async (request) => {
      // Atualizar jogo
      return { success: true };
    })
  ),

  delete: onCall(
    withRateLimit(RATE_LIMITS.GAME_DELETE, async (request) => {
      // Deletar jogo
      return { success: true };
    })
  ),

  list: onCall(
    withRateLimit(RATE_LIMITS.GAME_LIST, async (request) => {
      // Listar jogos
      return { success: true, games: [] };
    })
  ),
};

// ==========================================
// EXEMPLO 8: TRATAMENTO DE ERROS
// ==========================================

/**
 * Como lidar com erros de rate limit no cliente
 */
export const exampleClientUsage = `
// Cliente (TypeScript/JavaScript)
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const createGame = httpsCallable(functions, "createGameWithRateLimit");

try {
  const result = await createGame({
    groupId: "abc123",
    date: "2026-02-10",
    location: "Campo A"
  });

  console.log("Jogo criado:", result.data);
} catch (error: any) {
  if (error.code === "functions/resource-exhausted") {
    // Rate limit excedido
    const retryAfter = error.details?.retryAfter || 60;

    alert(\`Você está criando jogos muito rapidamente. Tente novamente em \${retryAfter} segundos.\`);

    // Opcional: Retry automático após o período
    setTimeout(() => {
      createGame(data);
    }, retryAfter * 1000);
  } else {
    console.error("Erro ao criar jogo:", error);
  }
}
`;

// ==========================================
// EXEMPLO 9: MONITORING
// ==========================================

/**
 * Como monitorar rate limits
 */
export const monitoringExample = `
// Logs estruturados para análise
firebase functions:log --only createGameWithRateLimit | grep RATE_LIMIT

// Exemplos de logs:
// [RATE_LIMIT] Usuário abc123: 7/10 requests restantes
// [RATE_LIMIT] Usuário xyz789 excedeu limite (10/60000ms). Reset em 45s
// [RATE_LIMIT_CLEANUP] 127 buckets removidos

// Métricas no Cloud Monitoring
// - Taxa de rate limit hits (resource-exhausted errors)
// - Distribuição de requests por usuário
// - Tempo médio até reset
`;

// ==========================================
// UTILITÁRIOS AUXILIARES
// ==========================================

/**
 * Verifica se usuário é admin
 * (Implementar conforme sua lógica)
 */
async function checkIfUserIsAdmin(userId: string): Promise<boolean> {
  // Exemplo: Verificar custom claims
  const user = await admin.auth().getUser(userId);
  return user.customClaims?.admin === true;
}

/**
 * Lazy import do admin (evitar erro de re-inicialização)
 */
import * as admin from "firebase-admin";
