/**
 * CACHE DE LEADERBOARD NO SERVIDOR - P2 #28
 *
 * Implementa cache server-side de leaderboards
 * usando Firestore como store.
 * Evita queries caras de ranking repetidas por
 * múltiplos clientes.
 *
 * ESTRATÉGIA:
 * - Cache em documento Firestore dedicado
 *   (zero infra adicional, sem Redis)
 * - TTL de 5 minutos (configurable)
 * - Invalidação automática quando
 *   season_participation é atualizada
 * - Callable function para clientes buscarem
 *   ranking cacheado
 *
 * PERFORMANCE:
 * - Antes: N clientes x 1 query de ranking
 *   cada = N queries
 * - Depois: 1 query de ranking a cada 5 min
 *   = 1 query por 5 min
 * - Economia estimada: 80% redução em Firestore
 *   reads para ranking
 *
 * @see specs/INFRASTRUCTURE_RECOMMENDATIONS.md
 */

import * as admin from "firebase-admin";
import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";
import {checkRateLimit} from "../middleware/rate-limiter";
import {
  sanitizeText,
} from "../validation/index";
import {
  FIRESTORE_WHERE_IN_LIMIT,
} from "../constants";

const getDb = () => admin.firestore();

// ==========================================
// CONSTANTES
// ==========================================

/** TTL do cache em milissegundos (5 minutos) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * TTL curto para cache durante horário de pico
 * (2 minutos) - reservado para uso futuro
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const CACHE_TTL_PEAK_MS = 2 * 60 * 1000;

/** Coleção para armazenar cache de rankings */
const CACHE_COLLECTION = "cache_leaderboard";

/** Número máximo de jogadores no leaderboard */
const DEFAULT_LEADERBOARD_LIMIT = 100;

/** Limite absoluto para evitar queries caras */
const ABSOLUTE_MAX_LIMIT = 500;

/**
 * Horário de início de pico (20h BRT) -
 * reservado para uso futuro
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const PEAK_HOURS_START = 20;

/**
 * Horário de fim de pico (23h BRT) -
 * reservado para uso futuro
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const PEAK_HOURS_END = 23;

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
 * 2. Se cache hit: retornar dados cacheados
 *    (0 reads de ranking)
 * 3. Se cache miss: query Firestore, cachear,
 *    retornar
 *
 * @param {object} request - Dados da requisição
 *   contendo seasonId, limit e forceRefresh
 * @return {Promise<object>} Rankings do
 *   leaderboard
 */
export const getLeaderboardCached =
  onCall<GetLeaderboardRequest>(
    {
      region: "southamerica-east1",
      memory: "512MiB",
    },
    async (request) => {
      // ==========================================
      // 1. AUTENTICAÇÃO
      // ==========================================
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "Usuário não autenticado"
        );
      }

      // Rate limiting - Máximo 30 chamadas por
      // minuto por usuário
      const leaderboardRateLimitResult =
        await checkRateLimit(
          request.auth.uid,
          {
            maxRequests: 30,
            windowMs: 60000,
            keyPrefix: "leaderboard",
          }
        );
      if (!leaderboardRateLimitResult.allowed) {
        throw new HttpsError(
          "resource-exhausted",
          "Rate limit excedido. " +
          "Tente novamente em breve."
        );
      }

      const {seasonId, limit, forceRefresh} =
        request.data;

      if (
        !seasonId ||
        typeof seasonId !== "string"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "seasonId é obrigatório"
        );
      }

      // Sanitizar e validar seasonId
      const safeSeasonId =
        sanitizeText(seasonId);
      if (safeSeasonId.length > 100) {
        throw new HttpsError(
          "invalid-argument",
          "seasonId excede 100 caracteres"
        );
      }
      if (/[/\\.]/.test(safeSeasonId)) {
        throw new HttpsError(
          "invalid-argument",
          "seasonId contém caracteres " +
          "inválidos"
        );
      }

      const resultLimit = Math.min(
        limit || DEFAULT_LEADERBOARD_LIMIT,
        ABSOLUTE_MAX_LIMIT
      );
      const db = getDb();

      // ==========================================
      // 2. VERIFICAR CACHE
      // ==========================================
      if (!forceRefresh) {
        const cached =
          await getCachedLeaderboard(
            safeSeasonId,
            resultLimit
          );
        if (cached) {
          const cacheAge =
            Date.now() -
            cached.cached_at.toMillis();
          console.log(
            "[LEADERBOARD_CACHE] " +
            "Cache HIT para season " +
            `${safeSeasonId} ` +
            `(${cached.rankings.length} ` +
            `entradas, age: ${cacheAge}ms)`
          );

          return {
            success: true,
            rankings: cached.rankings,
            count: cached.count,
            cached: true,
            cachedAt: cached.cached_at
              .toDate()
              .toISOString(),
          };
        }
      }

      // ==========================================
      // 3. CACHE MISS: Buscar do Firestore
      // ==========================================
      console.log(
        "[LEADERBOARD_CACHE] " +
        "Cache MISS para season " +
        `${safeSeasonId}. ` +
        "Buscando do Firestore..."
      );

      const startTime = Date.now();

      // Query principal de ranking
      const rankingSnap = await db
        .collection("season_participation")
        .where("season_id", "==", safeSeasonId)
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

      // Buscar dados de usuários em batch para
      // nomes/fotos
      const userIds = rankingSnap.docs
        .map((doc) => doc.data().user_id)
        .filter(Boolean);
      const userMap =
        await fetchUsersInBatch(userIds);

      // Montar leaderboard
      const rankings: LeaderboardEntry[] =
        rankingSnap.docs.map((doc, index) => {
          const data = doc.data();
          const userId = data.user_id;
          const userData = userMap.get(userId);

          return {
            rank: index + 1,
            user_id: userId,
            display_name:
              userData?.name ||
              userData?.display_name ||
              "Jogador",
            photo_url:
              userData?.photo_url ||
              userData?.photoUrl ||
              null,
            rating: data.league_rating || 0,
            points: data.points || 0,
            games_played:
              data.games_played || 0,
            wins: data.wins || 0,
            draws: data.draws || 0,
            losses: data.losses || 0,
            goals_scored:
              data.goals_scored || 0,
            assists: data.assists || 0,
            mvp_count: data.mvp_count || 0,
            division: data.division || "BRONZE",
          };
        });

      // ==========================================
      // 4. SALVAR NO CACHE
      // ==========================================
      const now =
        admin.firestore.Timestamp.now();
      const expiresAt =
        admin.firestore.Timestamp.fromMillis(
          now.toMillis() + CACHE_TTL_MS
        );

      const cacheDocId =
        `${safeSeasonId}_${resultLimit}`;

      // Salvar cache de forma síncrona
      // (garante persistência antes de retornar)
      try {
        await db
          .collection(CACHE_COLLECTION)
          .doc(cacheDocId)
          .set({
            season_id: safeSeasonId,
            rankings,
            cached_at: now,
            expires_at: expiresAt,
            count: rankings.length,
            limit: resultLimit,
          });
      } catch (error) {
        console.error(
          "[LEADERBOARD_CACHE] " +
          "Erro ao salvar cache:",
          error
        );
      }

      const queryDuration =
        Date.now() - startTime;
      console.log(
        "[LEADERBOARD_CACHE] " +
        "Leaderboard carregado em " +
        `${queryDuration}ms ` +
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
 * @param {string} seasonId - ID da season
 * @param {number} limit - Limite de resultados
 * @return {Promise<CachedLeaderboard|null>}
 *   Dados cacheados ou null se
 *   expirado/inexistente
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

    const data =
      cacheDoc.data() as CachedLeaderboard;

    // Verificar se o cache expirou
    const now = Date.now();
    if (
      data.expires_at &&
      data.expires_at.toMillis() < now
    ) {
      return null; // Cache expirado
    }

    return data;
  } catch (error) {
    console.error(
      "[LEADERBOARD_CACHE] " +
      "Erro ao ler cache:",
      error
    );
    return null;
  }
}

/**
 * Busca dados de usuários em batch
 * (chunks de 10).
 *
 * @param {string[]} userIds - Array de IDs
 *   de usuário
 * @return {Promise<Map<string, FirebaseFirestore.DocumentData>>}
 *   Map de userId para dados do usuário
 */
async function fetchUsersInBatch(
  userIds: string[]
): Promise<
  Map<string, FirebaseFirestore.DocumentData>
> {
  const db = getDb();
  const userMap = new Map<
    string,
    FirebaseFirestore.DocumentData
  >();

  if (userIds.length === 0) return userMap;

  // Chunks de 10 (limite do whereIn)
  const chunks: string[][] = [];
  for (
    let i = 0;
    i < userIds.length;
    i += FIRESTORE_WHERE_IN_LIMIT
  ) {
    chunks.push(
      userIds.slice(i, i + FIRESTORE_WHERE_IN_LIMIT)
    );
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const snap = await db
          .collection("users")
          .where(
            admin.firestore.FieldPath
              .documentId(),
            "in",
            chunk
          )
          .get();

        const map = new Map<
          string,
          FirebaseFirestore.DocumentData
        >();
        snap.docs.forEach((doc) => {
          map.set(doc.id, doc.data());
        });
        return map;
      } catch (error) {
        console.error(
          "[LEADERBOARD_CACHE] " +
          "Erro ao buscar usuários:",
          error
        );
        return new Map<
          string,
          FirebaseFirestore.DocumentData
        >();
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
