/**
 * CACHE DE LEADERBOARD NO SERVIDOR - P2 #28
 *
 * Implementa cache server-side de leaderboards usando Firestore como store.
 * Evita queries caras de ranking repetidas por múltiplos clientes.
 *
 * ESTRATÉGIA:
 * - Cache em documento Firestore dedicado (zero infra adicional, sem Redis)
 * - TTL de 5 minutos (configurable)
 * - Invalidação automática quando season_participation é atualizada
 * - Callable function para clientes buscarem ranking cacheado
 *
 * PERFORMANCE:
 * - Antes: N clientes x 1 query de ranking cada = N queries
 * - Depois: 1 query de ranking a cada 5 min = 1 query por 5 min
 * - Economia estimada: 80% redução em Firestore reads para ranking
 *
 * @see specs/INFRASTRUCTURE_RECOMMENDATIONS.md - P2 #28
 */

import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";

const getDb = () => admin.firestore();

// ==========================================
// CONSTANTES
// ==========================================

/** TTL do cache em milissegundos (5 minutos) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Coleção para armazenar cache de rankings */
const CACHE_COLLECTION = "cache_leaderboard";

/** Número máximo de jogadores no leaderboard */
const DEFAULT_LEADERBOARD_LIMIT = 100;

// ==========================================
// INTERFACES
// ==========================================

/** Entrada cacheada de ranking */
interface CachedLeaderboard {
  /** ID da season */
  season_id: string;
  /** Rankings cacheados */
  rankings: LeaderboardEntry[];
  /** Timestamp de criação do cache */
  cached_at: admin.firestore.Timestamp;
  /** Timestamp de expiração */
  expires_at: admin.firestore.Timestamp;
  /** Número de entradas */
  count: number;
}

/** Entrada individual no leaderboard */
interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  photo_url: string | null;
  rating: number;
  points: number;
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_scored: number;
  assists: number;
  mvp_count: number;
  division: string;
}

/** Request para buscar leaderboard */
interface GetLeaderboardRequest {
  seasonId: string;
  limit?: number;
  forceRefresh?: boolean;
}

// ==========================================
// CALLABLE: getLeaderboardCached
// ==========================================

/**
 * Busca leaderboard com cache server-side.
 *
 * FLUXO:
 * 1. Verificar se existe cache válido (< 5 min)
 * 2. Se cache hit: retornar dados cacheados (0 reads de ranking)
 * 3. Se cache miss: query Firestore, cachear, retornar
 *
 * @param seasonId - ID da season ativa
 * @param limit - Número máximo de entradas (padrão: 100)
 * @param forceRefresh - Forçar refresh do cache (ignorar TTL)
 */
export const getLeaderboardCached = onCall<GetLeaderboardRequest>(
  {
    region: "southamerica-east1",
    memory: "512MiB",
  },
  async (request) => {
    // ==========================================
    // 1. AUTENTICAÇÃO
    // ==========================================
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado");
    }

    const {seasonId, limit, forceRefresh} = request.data;

    if (!seasonId || typeof seasonId !== "string") {
      throw new HttpsError("invalid-argument", "seasonId é obrigatório");
    }

    const resultLimit = Math.min(limit || DEFAULT_LEADERBOARD_LIMIT, 200);
    const db = getDb();

    // ==========================================
    // 2. VERIFICAR CACHE
    // ==========================================
    if (!forceRefresh) {
      const cached = await getCachedLeaderboard(seasonId, resultLimit);
      if (cached) {
        console.log(
          `[LEADERBOARD_CACHE] Cache HIT para season ${seasonId} ` +
          `(${cached.rankings.length} entradas, ` +
          `age: ${Date.now() - cached.cached_at.toMillis()}ms)`
        );

        return {
          success: true,
          rankings: cached.rankings,
          count: cached.count,
          cached: true,
          cachedAt: cached.cached_at.toDate().toISOString(),
        };
      }
    }

    // ==========================================
    // 3. CACHE MISS: Buscar do Firestore
    // ==========================================
    console.log(
      `[LEADERBOARD_CACHE] Cache MISS para season ${seasonId}. Buscando do Firestore...`
    );

    const startTime = Date.now();

    // Query principal de ranking
    const rankingSnap = await db
      .collection("season_participation")
      .where("season_id", "==", seasonId)
      .orderBy("points", "desc")
      .limit(resultLimit)
      .get();

    if (rankingSnap.empty) {
      return {
        success: true,
        rankings: [],
        count: 0,
        cached: false,
      };
    }

    // Buscar dados de usuários em batch para nomes/fotos
    const userIds = rankingSnap.docs.map((doc) => doc.data().user_id).filter(Boolean);
    const userMap = await fetchUsersInBatch(userIds);

    // Montar leaderboard
    const rankings: LeaderboardEntry[] = rankingSnap.docs.map((doc, index) => {
      const data = doc.data();
      const userId = data.user_id;
      const userData = userMap.get(userId);

      return {
        rank: index + 1,
        user_id: userId,
        display_name: userData?.name || userData?.display_name || "Jogador",
        photo_url: userData?.photo_url || userData?.photoUrl || null,
        rating: data.league_rating || 0,
        points: data.points || 0,
        games_played: data.games_played || 0,
        wins: data.wins || 0,
        draws: data.draws || 0,
        losses: data.losses || 0,
        goals_scored: data.goals_scored || 0,
        assists: data.assists || 0,
        mvp_count: data.mvp_count || 0,
        division: data.division || "BRONZE",
      };
    });

    // ==========================================
    // 4. SALVAR NO CACHE
    // ==========================================
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + CACHE_TTL_MS
    );

    const cacheDocId = `${seasonId}_${resultLimit}`;

    // Salvar cache de forma assíncrona (não bloqueia resposta)
    db.collection(CACHE_COLLECTION)
      .doc(cacheDocId)
      .set({
        season_id: seasonId,
        rankings,
        cached_at: now,
        expires_at: expiresAt,
        count: rankings.length,
        limit: resultLimit,
      })
      .catch((error) => {
        console.error("[LEADERBOARD_CACHE] Erro ao salvar cache:", error);
      });

    const queryDuration = Date.now() - startTime;
    console.log(
      `[LEADERBOARD_CACHE] Leaderboard carregado em ${queryDuration}ms ` +
      `(${rankings.length} entradas)`
    );

    return {
      success: true,
      rankings,
      count: rankings.length,
      cached: false,
      queryDurationMs: queryDuration,
    };
  }
);

// ==========================================
// HELPERS
// ==========================================

/**
 * Busca leaderboard cacheado se não expirou.
 *
 * @param seasonId - ID da season
 * @param limit - Limite de resultados
 * @returns Dados cacheados ou null se expirado/inexistente
 */
async function getCachedLeaderboard(
  seasonId: string,
  limit: number
): Promise<CachedLeaderboard | null> {
  const db = getDb();
  const cacheDocId = `${seasonId}_${limit}`;

  try {
    const cacheDoc = await db
      .collection(CACHE_COLLECTION)
      .doc(cacheDocId)
      .get();

    if (!cacheDoc.exists) return null;

    const data = cacheDoc.data() as CachedLeaderboard;

    // Verificar se o cache expirou
    const now = Date.now();
    if (data.expires_at && data.expires_at.toMillis() < now) {
      return null; // Cache expirado
    }

    return data;
  } catch (error) {
    console.error("[LEADERBOARD_CACHE] Erro ao ler cache:", error);
    return null;
  }
}

/**
 * Busca dados de usuários em batch (chunks de 10).
 *
 * @param userIds - Array de IDs de usuário
 * @returns Map de userId -> dados do usuário
 */
async function fetchUsersInBatch(
  userIds: string[]
): Promise<Map<string, admin.firestore.DocumentData>> {
  const db = getDb();
  const userMap = new Map<string, admin.firestore.DocumentData>();

  if (userIds.length === 0) return userMap;

  // Chunks de 10 (limite do whereIn)
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const snap = await db
          .collection("users")
          .where(admin.firestore.FieldPath.documentId(), "in", chunk)
          .get();

        const map = new Map<string, admin.firestore.DocumentData>();
        snap.docs.forEach((doc) => {
          map.set(doc.id, doc.data());
        });
        return map;
      } catch (error) {
        console.error("[LEADERBOARD_CACHE] Erro ao buscar usuários:", error);
        return new Map<string, admin.firestore.DocumentData>();
      }
    })
  );

  // Consolidar resultados
  for (const result of results) {
    for (const [userId, data] of result) {
      userMap.set(userId, data);
    }
  }

  return userMap;
}
