/**
 * EXEMPLOS - P0 SECURITY OPTIMIZATIONS
 *
 * Demonstra como implementar:
 * - P0 #32: Firebase App Check enforcement
 * - P0 #33: FCM token protection (firestore.rules)
 * - P0 #34: Rate limiting (anti-bot)
 * - P0 #35: Budget monitoring
 *
 * Data: 2026-02-05
 * Referência: specs/MASTER_OPTIMIZATION_CHECKLIST.md
 */

import {HttpsError} from "firebase-functions/v2/https";
import {
  secureCallable,
  SECURE_PRESETS,
} from "../middleware/secure-callable-wrapper";
import {RATE_LIMITS, checkRateLimit} from "../middleware/rate-limiter";
import * as admin from "firebase-admin";

const db = admin.firestore();

// ==========================================
// EXEMPLO 1: Admin-only com App Check
// P0 #32 + P0 #34
// ==========================================

/**
 * Apenas ADMIN pode chamar.
 * - App Check obrigatório (bloqueia apps não-verificados)
 * - Rate limit: 5 chamadas/minuto
 * - Audit log habilitado
 */
export const adminSetUserRole = secureCallable(
  {
    // P0 #32: App Check enforcement
    appCheck: true,
    // P0 #34: Rate limiting (anti-bot)
    rateLimit: RATE_LIMITS.GAME_DELETE, // 5/min
    // Verificar role
    requiredRole: "ADMIN",
    // Audit logging
    enableAuditLog: true,
    // Extrair contexto adicional para audit
    auditLogContext: async (request) => ({
      function: "adminSetUserRole",
      targetUserId: request.data?.uid,
      newRole: request.data?.role,
    }),
  },
  async (request) => {
    // Handler logic - já passou por todas as verificações
    const {uid, role} = request.data;

    console.log(`[ADMIN] Setting role=${role} for user=${uid}`);

    // Update Firebase Auth Custom Claims
    await admin.auth().setCustomUserClaims(uid, {role});

    // Sync to Firestore
    await db.collection("users").doc(uid).update({
      role,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      uid,
      role,
      message: "Role updated successfully",
    };
  }
);

// ==========================================
// EXEMPLO 2: Field Owner - Criar Local
// P0 #32 + P0 #34 (rate limit moderado)
// ==========================================

/**
 * FIELD_OWNER ou ADMIN podem criar locais.
 * - App Check obrigatório
 * - Rate limit: 10 por minuto (criação mais lenient)
 * - Validação de input
 */
export const createLocation = secureCallable(
  {
    appCheck: true,
    rateLimit: RATE_LIMITS.GAME_CREATE, // 10/min
    requiredRole: ["ADMIN", "FIELD_OWNER"],
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "createLocation",
      locationName: request.data?.name,
    }),
  },
  async (request) => {
    const {name, address, latitude, longitude} = request.data;
    const userId = request.auth!.uid;

    // Validação de input
    if (!name || name.length < 2 || name.length > 100) {
      throw new HttpsError("invalid-argument", "Name must be 2-100 characters");
    }

    if (!latitude || !longitude) {
      throw new HttpsError(
        "invalid-argument",
        "Coordinates (latitude, longitude) required"
      );
    }

    if (latitude < -90 || latitude > 90) {
      throw new HttpsError("invalid-argument", "Invalid latitude");
    }

    if (longitude < -180 || longitude > 180) {
      throw new HttpsError("invalid-argument", "Invalid longitude");
    }

    console.log(`[LOCATION] Creating location: ${name}`);

    // Criar documento
    const locationRef = await db.collection("locations").add({
      name,
      address,
      latitude,
      longitude,
      owner_id: userId,
      is_active: true,
      is_verified: false, // Admin verifica depois
      rating: 0,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      locationId: locationRef.id,
      message: "Location created successfully",
    };
  }
);

// ==========================================
// EXEMPLO 3: Player - Jogar Jogo
// P0 #32 + P0 #34 (rate limit alto)
// ==========================================

/**
 * Qualquer usuário autenticado pode confirmar em um jogo.
 * - App Check obrigatório
 * - Rate limit: 30 por minuto (ação frequente)
 */
export const confirmGameParticipation = secureCallable(
  {
    appCheck: true,
    rateLimit: RATE_LIMITS.GAME_LIST, // 30/min
    requireAuth: true,
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "confirmGameParticipation",
      gameId: request.data?.gameId,
    }),
  },
  async (request) => {
    const {gameId, position} = request.data;
    const userId = request.auth!.uid;

    console.log(`[GAME] Confirming ${userId} for game ${gameId}`);

    // Verificar se jogo existe
    const gameDoc = await db.collection("games").doc(gameId).get();
    if (!gameDoc.exists) {
      throw new HttpsError("not-found", "Game not found");
    }

    // Criar confirmação
    const confirmationId = `${gameId}_${userId}`;
    await db.collection("confirmations").doc(confirmationId).set({
      game_id: gameId,
      user_id: userId,
      status: "CONFIRMED",
      position,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      confirmationId,
      message: "Game participation confirmed",
    };
  }
);

// ==========================================
// EXEMPLO 4: Preset - Apenas Autenticado
// ==========================================

/**
 * Simples: apenas exigir autenticação, sem rate limit
 */
export const getUserProfile = secureCallable(
  SECURE_PRESETS.authenticated,
  async (request) => {
    const userId = request.auth!.uid;

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }

    return {
      success: true,
      profile: userDoc.data(),
    };
  }
);

// ==========================================
// EXEMPLO 5: Integração Manual de Rate Limit
// P0 #34 (customização avançada)
// ==========================================

/**
 * Exemplo de rate limiting customizado.
 * Útil quando você precisa de lógica adicional.
 */
export const advancedRateLimitExample = secureCallable(
  {
    appCheck: true,
    requireAuth: true,
    enableAuditLog: true,
  },
  async (request) => {
    const userId = request.auth!.uid;
    const action = request.data?.action || "unknown";

    // ============================================
    // RATE LIMITING CUSTOMIZADO
    // ============================================

    // Rate limit variável conforme o role do usuário
    let rateLimitConfig = RATE_LIMITS.DEFAULT;

    const userDoc = await db.collection("users").doc(userId).get();
    const userRole = userDoc.data()?.role;

    if (userRole === "ADMIN") {
      // Admins têm limite mais alto
      rateLimitConfig = {maxRequests: 100, windowMs: 60 * 1000}; // 100/min
    } else if (userRole === "FIELD_OWNER") {
      // Field owners têm limite moderado
      rateLimitConfig = {maxRequests: 50, windowMs: 60 * 1000}; // 50/min
    }

    // Verificar rate limit
    const {allowed, remaining} = await checkRateLimit(userId, rateLimitConfig);

    if (!allowed) {
      throw new HttpsError(
        "resource-exhausted",
        "You're making too many requests. Please slow down."
      );
    }

    console.log(
      `[ADVANCED] User ${userId} (${userRole}): ${remaining} requests remaining`
    );

    // Lógica da função
    return {
      success: true,
      remaining,
      message: `Action '${action}' processed successfully`,
    };
  }
);

// ==========================================
// EXEMPLO 6: Zero Rate Limit (Public Endpoint)
// P0 #32 apenas
// ==========================================

/**
 * Endpoint público com App Check, mas sem rate limit.
 * Útil para operações leves que qualquer um pode fazer.
 */
export const getPublicLeaderboard = secureCallable(
  {
    appCheck: true, // App Check apenas
    requireAuth: false, // Não requer autenticação
    enableAuditLog: false, // Desabilitar audit para endpoints públicos
  },
  async (request) => {
    console.log("[PUBLIC] Fetching leaderboard");

    // Buscar top 10 jogadores
    const topPlayers = await db
      .collection("rankings")
      .orderBy("rating", "desc")
      .limit(10)
      .get();

    const leaderboard = topPlayers.docs.map((doc) => ({
      userId: doc.id,
      rating: doc.data().rating,
      level: doc.data().level,
      wins: doc.data().wins,
    }));

    return {
      success: true,
      leaderboard,
      timestamp: new Date().toISOString(),
    };
  }
);

// ==========================================
// OBSERVAÇÕES IMPORTANTES
// ==========================================

/**
 * P0 #32 - Firebase App Check
 * =============================
 * ✅ Implementado em FutebaApplication.kt
 * ✅ Exemplos acima usam enforceAppCheck: true
 * ✅ Próximo: Habilitar consumeAppCheckToken: true em produção
 *
 * P0 #33 - FCM Token Protection
 * ==============================
 * ✅ Implementado em firestore.rules (linha 273)
 * ✅ FCM token é readable apenas pelo proprietário
 * ✅ Cloud Functions atualizam via Admin SDK
 * ✅ Nenhuma mudança necessária em código cliente
 *
 * P0 #34 - Rate Limiting
 * ======================
 * ✅ Middleware implementado em rate-limiter.ts
 * ✅ Exemplos acima mostram como usar
 * ✅ Rate limits configuráveis por endpoint
 * ✅ Storage em Firestore com TTL automático
 *
 * P0 #35 - Budget Monitoring
 * ==========================
 * ✅ Documentação em docs/FIREBASE_BUDGET_SETUP.md
 * ✅ Alertas manuais via Firebase Console
 * ✅ Daily budget check pronto em monitoring/daily-budget-check.ts
 * ✅ Cloud Scheduler para execução automática
 */
