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

import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {FieldPath, Timestamp} from "firebase-admin/firestore";
import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";
import {
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import {checkRateLimit} from "../middleware/rate-limiter";
import {
  sanitizeText,
} from "../validation/index";
import {
  FIRESTORE_BATCH_SAFE_LIMIT,
  FIRESTORE_WHERE_IN_LIMIT,
  FUNCTION_REGION,
  GAME_GENDERS,
  LEVEL_TABLE,
} from "../constants";
import {ERROR_MSGS} from "../error-messages";

const getDb = () => admin.firestore();

// ==========================================
// CONSTANTES
// ==========================================

/** TTL do cache em milissegundos (5 minutos) */
const CACHE_TTL_MS = 5 * 60 * 1000;

// FIX #2199: removidos exports não utilizados CACHE_TTL_PEAK_MS,
// PEAK_HOURS_START e PEAK_HOURS_END (eram dead code com eslint-disable).

/** Coleção para armazenar cache de rankings */
const CACHE_COLLECTION = "cache_leaderboard";

/** Número máximo de jogadores no leaderboard */
const DEFAULT_LEADERBOARD_LIMIT = 100;

/** Limite absoluto para evitar queries caras */
const ABSOLUTE_MAX_LIMIT = 500;

/** Limite de candidatos saneados para montar o diretorio da Liga. */
const LEAGUE_DIRECTORY_SCAN_LIMIT = 5000;

/** Tamanho de lote para varrer usuarios pesquisaveis. */
const SEARCHABLE_USERS_BATCH_SIZE = 500;

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
  cached_at: Timestamp;
  /** Timestamp de expiração */
  expires_at: Timestamp;
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
  // Fase 4b: filtro de gênero. Ausente/"ALL"/inválido = combinado
  // (campos planos). MALE/FEMALE/MIXED = segmentado (by_gender.{G}).
  gender?: string;
}

interface GetLeaguePlayersRequest {
  seasonId?: string | null;
  groupId?: string | null;
  limit?: number;
  gender?: string | null;
  search?: string | null;
  sortField?: string | null;
  sortDirection?: string | null;
  pageToken?: string | null;
}

interface PublicLeagueUser {
  name: string;
  photoUrl: string | null;
  xp: number;
  favoriteTeam?: string;
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: string;
  seedId?: string;
  demoDataReason?: string;
}

interface LeagueParticipationStats {
  id: string;
  userId: string;
  points: number;
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  division: string;
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: string;
  seedId?: string;
  demoDataReason?: string;
}

interface PublicLeaguePlayer {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  favoriteTeam?: string;
  level: number;
  points: number;
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  division: string;
  experiencePoints: number;
  canReceiveInvites: boolean;
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: string;
  seedId?: string;
  demoDataReason?: string;
}

type LeagueSortField =
  "experiencePoints" |
  "points" |
  "name" |
  "gamesPlayed" |
  "wins" |
  "goals" |
  "assists" |
  "mvpCount" |
  "losses" |
  "winRate";

type SortDirection = "asc" | "desc";

/** Chave de gênero combinada (sem segmentação). */
const GENDER_ALL = "ALL";

/**
 * Remove documentos em lotes seguros para respeitar o limite de writes
 * do Firestore por batch.
 *
 * @param {admin.firestore.Firestore} db Instância do Firestore.
 * @param {admin.firestore.QueryDocumentSnapshot[]} docs Docs a remover.
 * @return {Promise<number>} Quantidade de batches commitados.
 */
export async function deleteDocsInBatches(
  db: admin.firestore.Firestore,
  docs: admin.firestore.QueryDocumentSnapshot[]
): Promise<number> {
  let committedBatches = 0;

  for (
    let i = 0;
    i < docs.length;
    i += FIRESTORE_BATCH_SAFE_LIMIT
  ) {
    const chunk = docs.slice(i, i + FIRESTORE_BATCH_SAFE_LIMIT);
    const batch = db.batch();
    chunk.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    committedBatches++;
  }

  return committedBatches;
}

/**
 * Normaliza o filtro de gênero do request para a chave de leitura.
 * @param {unknown} raw Valor cru de request.data.gender.
 * @return {string} MALE/FEMALE/MIXED (segmentado) ou ALL (combinado).
 */
function resolveGenderKey(raw: unknown): string {
  if (typeof raw === "string") {
    const upper = raw.toUpperCase();
    if ((GAME_GENDERS as readonly string[]).includes(upper)) {
      return upper;
    }
  }
  return GENDER_ALL;
}

/**
 * Retorna a lista publica de jogadores da Liga/XP.
 *
 * Esta callable existe porque Firestore Rules nao conseguem mascarar campos:
 * os docs em users/{uid} contem PII, entao o cliente nao pode le-los para
 * montar a Liga. O Admin SDK le os dados completos e devolve apenas campos
 * publicos/sanitizados.
 */
export const getLeaguePlayers = onCall<GetLeaguePlayersRequest>(
  {
    region: FUNCTION_REGION,
    memory: "512MiB",
    enforceAppCheck: !process.env.FUNCTIONS_EMULATOR,
    consumeAppCheckToken: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        ERROR_MSGS.UNAUTHENTICATED
      );
    }

    const rateLimitResult = await checkRateLimit(
      request.auth.uid,
      {
        maxRequests: 50,
        windowMs: 60000,
        keyPrefix: "league_players",
      }
    );
    if (!rateLimitResult.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        ERROR_MSGS.RATE_LIMIT_GENERIC
      );
    }

    const seasonId = sanitizeOptionalId(
      request.data?.seasonId,
      "seasonId"
    );
    const groupId = sanitizeOptionalId(
      request.data?.groupId,
      "groupId"
    );
    const resultLimit = Math.min(
      Math.max(
        readNumber(request.data?.limit) || DEFAULT_LEADERBOARD_LIMIT,
        1
      ),
      ABSOLUTE_MAX_LIMIT
    );
    const pageOffset = parsePageToken(request.data?.pageToken);
    const searchQuery = normalizeSearchQuery(request.data?.search);
    const sortField = resolveLeagueSortField(request.data?.sortField);
    const sortDirection =
      resolveSortDirection(request.data?.sortDirection);
    const genderKey = resolveGenderKey(request.data?.gender);
    if (groupId) {
      await assertCanReadLeagueGroup(
        groupId,
        request.auth.uid,
        request.auth.token?.role === "ADMIN"
      );
    }

    const [participations, usersMap] = await Promise.all([
      fetchLeagueParticipations(
        seasonId,
        groupId,
        genderKey,
        LEAGUE_DIRECTORY_SCAN_LIMIT
      ),
      groupId ?
        fetchActiveGroupMemberIds(groupId)
          .then((userIds) => fetchPublicUsersByIds(userIds)) :
        fetchSearchableLeagueUsers(LEAGUE_DIRECTORY_SCAN_LIMIT),
    ]);

    const participationByUser = new Map<
      string,
      LeagueParticipationStats
    >();
    for (const participation of participations) {
      const existing = participationByUser.get(participation.userId);
      if (!existing || participation.points > existing.points) {
        participationByUser.set(participation.userId, participation);
      }
    }

    const allPlayers: PublicLeaguePlayer[] = Array.from(usersMap.entries())
      .map(([userId, userData]) => {
        const participation = participationByUser.get(userId);
        return {
          id: participation?.id ?? userId,
          userId,
          userName: userData.name,
          userPhoto: userData.photoUrl || undefined,
          favoriteTeam: userData.favoriteTeam,
          level: getLevelForXpServer(userData.xp),
          points: participation?.points ?? 0,
          gamesPlayed: participation?.gamesPlayed ?? 0,
          wins: participation?.wins ?? 0,
          goals: participation?.goals ?? 0,
          assists: participation?.assists ?? 0,
          mvpCount: participation?.mvpCount ?? 0,
          division: participation?.division ?? "BRONZE",
          experiencePoints: userData.xp,
          canReceiveInvites: true,
          isMock:
            userData.isMock === true ||
            participation?.isMock === true,
          demoData:
            userData.demoData === true ||
            participation?.demoData === true,
          dataOrigin:
            userData.dataOrigin ||
            participation?.dataOrigin,
          seedId:
            userData.seedId ||
            participation?.seedId,
          demoDataReason:
            userData.demoDataReason ||
            participation?.demoDataReason,
        };
      })
      .filter((player) => matchesLeagueSearch(player, searchQuery))
      .sort((a, b) =>
        compareLeaguePlayers(a, b, sortField, sortDirection)
      );
    const players = allPlayers.slice(
      pageOffset,
      pageOffset + resultLimit
    );
    const nextOffset = pageOffset + players.length;

    return {
      success: true,
      players,
      totalCount: allPlayers.length,
      count: players.length,
      hasMore: nextOffset < allPlayers.length,
      nextPageToken:
        nextOffset < allPlayers.length ?
          String(nextOffset) :
          null,
    };
  }
);

/**
 * Converte pageToken numerico em offset seguro.
 *
 * @param {unknown} raw Token recebido da UI.
 * @return {number} Offset zero-based.
 */
function parsePageToken(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw !== "string") {
    throw new HttpsError("invalid-argument", "pageToken inválido");
  }
  const offset = Number.parseInt(raw, 10);
  if (!Number.isFinite(offset) || offset < 0) {
    throw new HttpsError("invalid-argument", "pageToken inválido");
  }
  return Math.min(offset, LEAGUE_DIRECTORY_SCAN_LIMIT);
}

/**
 * Normaliza texto para busca sem acento/case.
 *
 * @param {unknown} raw Termo bruto.
 * @return {string} Termo normalizado.
 */
function normalizeSearchQuery(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw !== "string") {
    throw new HttpsError("invalid-argument", "Busca inválida");
  }
  return normalizeSearchText(sanitizeText(raw).slice(0, 120));
}

/**
 * Remove acentos e case para comparacao de busca.
 *
 * @param {string} value Texto original.
 * @return {string} Texto normalizado.
 */
function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Resolve campo de ordenacao aceito pela Liga.
 *
 * @param {unknown} raw Valor bruto.
 * @return {LeagueSortField} Campo seguro.
 */
function resolveLeagueSortField(raw: unknown): LeagueSortField {
  const allowed: readonly LeagueSortField[] = [
    "experiencePoints",
    "points",
    "name",
    "gamesPlayed",
    "wins",
    "goals",
    "assists",
    "mvpCount",
    "losses",
    "winRate",
  ];
  return typeof raw === "string" &&
    (allowed as readonly string[]).includes(raw) ?
    raw as LeagueSortField :
    "experiencePoints";
}

/**
 * Resolve direcao de ordenacao.
 *
 * @param {unknown} raw Valor bruto.
 * @return {SortDirection} Direcao segura.
 */
function resolveSortDirection(raw: unknown): SortDirection {
  return raw === "asc" ? "asc" : "desc";
}

/**
 * Verifica se um jogador casa com a busca por UID ou nome.
 *
 * @param {PublicLeaguePlayer} player Jogador publico.
 * @param {string} query Termo normalizado.
 * @return {boolean} True quando deve permanecer na lista.
 */
function matchesLeagueSearch(
  player: PublicLeaguePlayer,
  query: string
): boolean {
  if (!query) return true;
  return normalizeSearchText(player.userName).includes(query) ||
    player.userId.toLowerCase().includes(query);
}

/**
 * Ordena jogadores com desempate estavel por XP, nome e UID.
 *
 * @param {PublicLeaguePlayer} a Primeiro jogador.
 * @param {PublicLeaguePlayer} b Segundo jogador.
 * @param {LeagueSortField} sortField Campo principal.
 * @param {SortDirection} direction Direcao.
 * @return {number} Comparador Array.sort.
 */
function compareLeaguePlayers(
  a: PublicLeaguePlayer,
  b: PublicLeaguePlayer,
  sortField: LeagueSortField,
  direction: SortDirection
): number {
  const factor = direction === "asc" ? 1 : -1;
  if (sortField === "name") {
    return factor * a.userName.localeCompare(b.userName) ||
      b.experiencePoints - a.experiencePoints ||
      a.userId.localeCompare(b.userId);
  }

  const numericValue = (player: PublicLeaguePlayer): number => {
    switch (sortField) {
    case "points": return player.points;
    case "gamesPlayed": return player.gamesPlayed;
    case "wins": return player.wins;
    case "goals": return player.goals;
    case "assists": return player.assists;
    case "mvpCount": return player.mvpCount;
    case "losses":
      return Math.max(0, player.gamesPlayed - player.wins);
    case "winRate":
      return player.gamesPlayed > 0 ?
        player.wins / player.gamesPlayed :
        0;
    case "experiencePoints":
    default: return player.experiencePoints;
    }
  };

  return factor * (numericValue(a) - numericValue(b)) ||
    b.experiencePoints - a.experiencePoints ||
    b.points - a.points ||
    a.userName.localeCompare(b.userName) ||
    a.userId.localeCompare(b.userId);
}

/**
 * Le string publica opcional com trim.
 *
 * @param {unknown} value Valor bruto.
 * @param {string | undefined} fallback Fallback opcional.
 * @return {string | undefined} String normalizada ou fallback.
 */
function readString(
  value: unknown,
  fallback?: string
): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ?
    value.trim() :
    fallback;
}

/**
 * Le numero finito com fallback zero.
 *
 * @param {unknown} value Valor bruto.
 * @return {number} Numero seguro.
 */
function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ?
    value :
    0;
}

/**
 * Calcula nivel a partir da tabela compartilhada de XP.
 *
 * @param {number} totalXp XP total do usuario.
 * @return {number} Nivel correspondente.
 */
function getLevelForXpServer(totalXp: number): number {
  let level = 0;
  for (const entry of LEVEL_TABLE.levels) {
    if (totalXp >= entry.xpRequired) {
      level = entry.level;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Sanitiza IDs opcionais usados em queries server-side.
 *
 * @param {unknown} value Valor bruto.
 * @param {string} fieldName Nome do campo para mensagem de erro.
 * @return {string | null} ID seguro ou null.
 */
function sanitizeOptionalId(
  value: unknown,
  fieldName: string
): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} inválido`
    );
  }

  const safeValue = sanitizeText(value);
  if (
    safeValue.length === 0 ||
    safeValue.length > 100 ||
    /[/\\.]/.test(safeValue)
  ) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} contém caracteres inválidos`
    );
  }
  return safeValue;
}

/**
 * Verifica se o perfil pode aparecer em buscas publicas da Liga.
 *
 * @param {FirebaseFirestore.DocumentData} data Documento users/{uid}.
 * @return {boolean} True quando o usuario e pesquisavel.
 */
function isPublicSearchableUser(
  data: FirebaseFirestore.DocumentData
): boolean {
  if (data.deleted_at != null || data.deletedAt != null) return false;
  if (data.is_searchable === false || data.isSearchable === false) {
    return false;
  }
  return data.is_searchable === true || data.isSearchable === true;
}

/**
 * Adiciona ao mapa apenas o subset publico do perfil.
 *
 * @param {Map<string, PublicLeagueUser>} usersMap Mapa de usuarios.
 * @param {string} userId UID do usuario.
 * @param {FirebaseFirestore.DocumentData} data Documento users/{uid}.
 */
function addPublicLeagueUser(
  usersMap: Map<string, PublicLeagueUser>,
  userId: string,
  data: FirebaseFirestore.DocumentData
) {
  if (!isPublicSearchableUser(data)) return;

  const xp = readNumber(
    data.experience_points ?? data.experiencePoints
  );
  usersMap.set(userId, {
    name:
      readString(data.name) ||
      readString(data.display_name) ||
      readString(data.nickname) ||
      "Jogador",
    photoUrl:
      readString(data.photo_url) ||
      readString(data.photoUrl) ||
      null,
    xp,
    favoriteTeam:
      readString(data.favorite_team) ||
      readString(data.favoriteTeam),
    isMock: data.is_mock === true || data.isMock === true,
    demoData: data.demo_data === true || data.demoData === true,
    dataOrigin:
      readString(data.data_origin) ||
      readString(data.dataOrigin),
    seedId:
      readString(data.seed_id) ||
      readString(data.seedId),
    demoDataReason:
      readString(data.demo_data_reason) ||
      readString(data.demoDataReason),
  });
}

/**
 * Busca perfis publicos por IDs usando chunks seguros de whereIn.
 *
 * @param {string[]} userIds UIDs candidatos.
 * @return {Promise<Map<string, PublicLeagueUser>>} Usuarios publicos.
 */
async function fetchPublicUsersByIds(
  userIds: string[]
): Promise<Map<string, PublicLeagueUser>> {
  const db = getDb();
  const usersMap = new Map<string, PublicLeagueUser>();
  const uniqueIds = [...new Set(userIds)].filter(Boolean);

  for (
    let i = 0;
    i < uniqueIds.length;
    i += FIRESTORE_WHERE_IN_LIMIT
  ) {
    const chunk = uniqueIds.slice(i, i + FIRESTORE_WHERE_IN_LIMIT);
    const snap = await db
      .collection("users")
      .where(FieldPath.documentId(), "in", chunk)
      .get();

    snap.docs.forEach((doc) => {
      addPublicLeagueUser(usersMap, doc.id, doc.data());
    });
  }

  return usersMap;
}

/**
 * Busca usuarios pesquisaveis globais considerando campos legado e atual.
 *
 * @param {number} resultLimit Limite maximo por campo de busca.
 * @return {Promise<Map<string, PublicLeagueUser>>} Usuarios deduplicados.
 */
async function fetchSearchableLeagueUsers(
  resultLimit: number
): Promise<Map<string, PublicLeagueUser>> {
  const db = getDb();
  const usersMap = new Map<string, PublicLeagueUser>();
  const fields = ["is_searchable", "isSearchable"];

  await Promise.all(fields.map(async (field) => {
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let scanned = 0;

    while (scanned < resultLimit) {
      const batchSize = Math.min(
        SEARCHABLE_USERS_BATCH_SIZE,
        resultLimit - scanned
      );
      let q: FirebaseFirestore.Query = db.collection("users")
        .where(field, "==", true)
        .orderBy(FieldPath.documentId())
        .limit(batchSize);
      if (lastDoc) {
        q = q.startAfter(lastDoc);
      }

      const snap = await q.get();
      if (snap.empty) break;

      snap.docs.forEach((doc) => {
        addPublicLeagueUser(usersMap, doc.id, doc.data());
      });

      scanned += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < batchSize) break;
    }
  }));

  return usersMap;
}

/**
 * Carrega IDs de membros ativos de um grupo.
 *
 * @param {string} groupId ID do grupo.
 * @return {Promise<string[]>} UIDs dos membros ativos.
 */
async function fetchActiveGroupMemberIds(
  groupId: string
): Promise<string[]> {
  const db = getDb();
  const snap = await db
    .collection("groups")
    .doc(groupId)
    .collection("members")
    .get();

  return snap.docs
    .filter((doc) => doc.data().status === "ACTIVE")
    .map((doc) => {
      const data = doc.data();
      return readString(data.user_id) ||
        readString(data.userId) ||
        doc.id;
    })
    .filter((userId): userId is string => Boolean(userId));
}

/**
 * Replica a autorizacao de leitura de grupo antes de expor membros via Admin.
 *
 * @param {string} groupId ID do grupo.
 * @param {string} uid UID autenticado.
 * @param {boolean} isAdmin Indica custom claim ADMIN.
 */
async function assertCanReadLeagueGroup(
  groupId: string,
  uid: string,
  isAdmin: boolean
): Promise<void> {
  if (isAdmin) return;

  const db = getDb();
  const groupSnap = await db
    .collection("groups")
    .doc(groupId)
    .get();
  if (!groupSnap.exists) {
    throw new HttpsError("not-found", "Grupo não encontrado");
  }

  const group = groupSnap.data() ?? {};
  if (group.deleted_at != null || group.status !== "ACTIVE") {
    throw new HttpsError("permission-denied", "Acesso negado");
  }
  if (group.is_public === true) return;
  if (group.owner_id === uid) return;

  const memberSnap = await db
    .collection("groups")
    .doc(groupId)
    .collection("members")
    .doc(uid)
    .get();
  const member = memberSnap.data();
  if (memberSnap.exists && member?.status === "ACTIVE") return;

  throw new HttpsError("permission-denied", "Acesso negado");
}

/**
 * Carrega participacoes de temporada usadas para pontuar a lista publica.
 *
 * @param {string | null} seasonId ID da temporada ou null.
 * @param {string | null} groupId ID do grupo ou null.
 * @param {string} genderKey Chave de genero ou ALL.
 * @param {number} resultLimit Limite de documentos.
 * @return {Promise<LeagueParticipationStats[]>} Stats de participacao.
 */
async function fetchLeagueParticipations(
  seasonId: string | null,
  groupId: string | null,
  genderKey: string,
  resultLimit: number
): Promise<LeagueParticipationStats[]> {
  if (!seasonId) return [];

  const db = getDb();
  const isSegmented = genderKey !== GENDER_ALL;
  const orderField = isSegmented ?
    `by_gender.${genderKey}.points` :
    "points";
  let q: FirebaseFirestore.Query = db
    .collection("season_participation")
    .where("season_id", "==", seasonId);

  if (groupId) {
    q = q.where("group_id", "==", groupId);
  }

  const snap = await q
    .orderBy(orderField, "desc")
    .orderBy("user_id", "asc")
    .limit(resultLimit)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    const src = isSegmented ?
      ((data.by_gender || {})[genderKey] || {}) :
      data;
    const userId = readString(data.user_id) ||
      readString(data.userId) ||
      doc.id;

    return {
      id: doc.id,
      userId,
      points: readNumber(src.points),
      gamesPlayed: readNumber(
        src.games_played ?? src.gamesPlayed
      ),
      wins: readNumber(src.wins),
      goals: readNumber(src.goals_scored ?? src.goals),
      assists: readNumber(src.assists),
      mvpCount: readNumber(src.mvp_count ?? src.mvpCount),
      division: readString(data.division, "BRONZE") || "BRONZE",
      isMock: data.is_mock === true || data.isMock === true,
      demoData: data.demo_data === true || data.demoData === true,
      dataOrigin:
        readString(data.data_origin) ||
        readString(data.dataOrigin),
      seedId:
        readString(data.seed_id) ||
        readString(data.seedId),
      demoDataReason:
        readString(data.demo_data_reason) ||
        readString(data.demoDataReason),
    };
  });
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
      enforceAppCheck: !process.env.FUNCTIONS_EMULATOR,
      consumeAppCheckToken: true,
    },
    async (request) => {
      // ==========================================
      // 1. AUTENTICAÇÃO
      // ==========================================
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          ERROR_MSGS.UNAUTHENTICATED
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
          ERROR_MSGS.RATE_LIMIT_GENERIC
        );
      }

      const {seasonId, limit, forceRefresh} =
        request.data;
      const genderKey =
        resolveGenderKey(request.data.gender);

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
            resultLimit,
            genderKey
          );
        if (cached) {
          const cacheAge =
            Date.now() -
            cached.cached_at.toMillis();
          logger.info(
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
      logger.info(
        "[LEADERBOARD_CACHE] " +
        "Cache MISS para season " +
        `${safeSeasonId}. ` +
        "Buscando do Firestore..."
      );

      const startTime = Date.now();

      // Campo de ordenação: combinado usa o ponto plano; segmentado
      // ordena pelo ponto da categoria (by_gender.{G}.points). Docs
      // sem aquele gênero não têm o campo → naturalmente excluídos.
      const isSegmented = genderKey !== GENDER_ALL;
      const orderField = isSegmented ?
        `by_gender.${genderKey}.points` :
        "points";

      // Query principal de ranking
      // FIX #654-B2: secondary sort by user_id for deterministic tie-breaking
      const rankingSnap = await db
        .collection("season_participation")
        .where("season_id", "==", safeSeasonId)
        .orderBy(orderField, "desc")
        .orderBy("user_id", "asc")
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

      // Lê as stats de ranking do doc: combinado = campos planos;
      // segmentado = sub-objeto by_gender.{G} (rating/division
      // permanecem GLOBAIS, não são calculados por gênero).
      const num = (v: unknown): number =>
        typeof v === "number" ? v : 0;
      const readStats = (
        data: admin.firestore.DocumentData
      ): Record<string, number> => {
        const src = isSegmented ?
          ((data.by_gender || {})[genderKey] || {}) :
          data;
        return {
          points: num(src.points),
          games_played: num(src.games_played),
          wins: num(src.wins),
          draws: num(src.draws),
          losses: num(src.losses),
          goals_scored: num(src.goals_scored),
          assists: num(src.assists),
          mvp_count: num(src.mvp_count),
        };
      };

      // Montar leaderboard
      const rankings: LeaderboardEntry[] =
        rankingSnap.docs.map((doc, index) => {
          const data = doc.data();
          const userId = data.user_id;
          const userData = userMap.get(userId);
          const stats = readStats(data);

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
            points: stats.points,
            games_played: stats.games_played,
            wins: stats.wins,
            draws: stats.draws,
            losses: stats.losses,
            goals_scored: stats.goals_scored,
            assists: stats.assists,
            mvp_count: stats.mvp_count,
            division: data.division || "BRONZE",
          };
        });

      // ==========================================
      // 4. SALVAR NO CACHE
      // ==========================================
      const now =
        Timestamp.now();
      const expiresAt =
        Timestamp.fromMillis(
          now.toMillis() + CACHE_TTL_MS
        );

      const cacheDocId =
        `${safeSeasonId}_${genderKey}_${resultLimit}`;

      // Salvar cache de forma síncrona
      // (garante persistência antes de retornar)
      try {
        await db
          .collection(CACHE_COLLECTION)
          .doc(cacheDocId)
          .set({
            season_id: safeSeasonId,
            gender: genderKey,
            rankings,
            cached_at: now,
            expires_at: expiresAt,
            count: rankings.length,
            limit: resultLimit,
          });
      } catch (error) {
        logger.error(
          "[LEADERBOARD_CACHE] " +
          "Erro ao salvar cache:",
          error
        );
      }

      const queryDuration =
        Date.now() - startTime;
      logger.info(
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
 * @param {string} genderKey - Chave de gênero
 *   (ALL combinado ou MALE/FEMALE/MIXED)
 * @return {Promise<CachedLeaderboard|null>}
 *   Dados cacheados ou null se
 *   expirado/inexistente
 */
async function getCachedLeaderboard(
  seasonId: string,
  limit: number,
  genderKey: string = GENDER_ALL
): Promise<CachedLeaderboard | null> {
  const db = getDb();
  const cacheDocId = `${seasonId}_${genderKey}_${limit}`;

  try {
    const cacheDoc = await db
      .collection(CACHE_COLLECTION)
      .doc(cacheDocId)
      .get();

    if (!cacheDoc.exists) return null;

    // FIX #2284: valida shape antes do cast; cache malformado vira miss.
    const raw = cacheDoc.data();
    if (typeof raw !== "object" || raw === null) return null;
    const data = raw as CachedLeaderboard;

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
    logger.error(
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
            FieldPath
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
        logger.error(
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

// ==========================================
// INVALIDAÇÃO PROATIVA DE CACHE
// ==========================================

/**
 * FIX #621: Invalida leaderboard cache quando season_participation muda.
 *
 * Antes: apenas TTL de 5 min — doc-code mismatch com o comentário
 * do módulo que prometia "invalidação automática quando
 * season_participation é atualizada". Pós-partida, ranking ficava
 * stale por até 5 min para todos os clientes.
 *
 * Agora: trigger proativa deleta todos os docs de cache da season.
 * Cache key format: `${seasonId}_${limit}` — query por season_id
 * para capturar todas as variantes de limit cacheadas.
 *
 * Custo: ~20 trigger invocations por partida encerrada (1 por
 * season_participation doc). Cada invocation: 1 query + batch delete.
 * Aceitável para ranking correto imediatamente pós-partida.
 */
export const invalidateLeaderboardOnParticipation = onDocumentWritten(
  {
    document: "season_participation/{partId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    const after = event.data?.after?.data?.();
    const before = event.data?.before?.data?.();
    const seasonId = after?.season_id || before?.season_id;

    if (!seasonId || typeof seasonId !== "string") return;

    const db = getDb();

    try {
      // Buscar todos os docs de cache dessa season
      // (podem haver múltiplos com limites diferentes: 10, 20, 50, 100…)
      const cacheSnap = await db
        .collection(CACHE_COLLECTION)
        .where("season_id", "==", seasonId)
        .get();

      if (cacheSnap.empty) {
        // Nenhum cache para invalidar — operação idempotente
        return;
      }

      const committedBatches =
        await deleteDocsInBatches(
          db,
          cacheSnap.docs
        );

      logger.info(
        "[LEADERBOARD_CACHE] Invalidated " +
        `${cacheSnap.size} cache doc(s) ` +
        `for season ${seasonId} ` +
        `in ${committedBatches} batch(es)`
      );
    } catch (error) {
      // DECISÃO DE DESIGN (#1040): falha de invalidação é best-effort intencional.
      // O trigger é chamado ~20x por partida encerrada (1 por doc season_participation).
      // Não re-throw para evitar retry em cascata que custaria Firestore reads extras.
      // O TTL de 5 min na coleção leaderboard_cache garante eventual consistência
      // sem dados stale por mais de 5 minutos no pior caso.
      logger.error(
        "[LEADERBOARD_CACHE] " +
        `Erro ao invalidar cache da season ${seasonId}:`,
        error
      );
    }
  }
);

/**
 * Helpers expostos para testes focados de escalabilidade.
 */
export const __testing = {
  deleteDocsInBatches,
};
