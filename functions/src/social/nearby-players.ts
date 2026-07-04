/* istanbul ignore file -- geo/Admin SDK callable exercised through emulator social suites. */
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {Timestamp} from "firebase-admin/firestore";
import {
  distanceBetween,
  geohashQueryBounds,
} from "geofire-common";
import {db} from "../_db";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {isRecord} from "../validation/guards";

const ALLOWED_RADII_KM = [1, 5, 10, 25] as const;
const MAX_RESULTS = 50;
const MAX_LOCATION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const LOCATION_QUERY_LIMIT_PER_BOUND = 100;

type AllowedRadiusKm = typeof ALLOWED_RADII_KM[number];

/** Payload aceito pela callable de descoberta por proximidade. */
interface DiscoverNearbyPlayersRequest {
  lat: number;
  lng: number;
  radiusKm: AllowedRadiusKm;
  socialFilter?: "all" | "following";
}

/** Documento sensivel de localizacao lido apenas pelo Admin SDK. */
interface CandidateLocation {
  userId: string;
  lat: number;
  lng: number;
  geohash: string;
  locationUpdatedAt?: Timestamp;
}

/** Perfil publico minimo permitido na resposta da descoberta. */
interface PublicUserProfile {
  id: string;
  displayName: string;
  photoUrl: string | null;
  nickname: string | null;
  preferredPosition: string | null;
  followersCount: number;
  isFollowing: boolean;
}

export interface NearbyPlayerResponse extends PublicUserProfile {
  distanceKmApprox: number;
  distanceBand: "under_1km" | "under_5km" | "under_10km" | "under_25km";
  socialContext: "following" | "none";
}

/**
 * Valida numero finito.
 *
 * @param {unknown} value Valor bruto.
 * @return {boolean} True quando e number finito.
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Valida raio permitido.
 *
 * @param {unknown} value Valor bruto.
 * @return {boolean} True quando o raio e suportado.
 */
function isValidRadius(value: unknown): value is AllowedRadiusKm {
  return ALLOWED_RADII_KM.includes(value as AllowedRadiusKm);
}

/**
 * Faz parse e validacao do payload da callable.
 *
 * @param {unknown} data Payload bruto.
 * @return {DiscoverNearbyPlayersRequest} Payload validado.
 */
export function parseDiscoverNearbyPlayersRequest(
  data: unknown
): DiscoverNearbyPlayersRequest {
  if (!isRecord(data)) {
    throw new HttpsError("invalid-argument", "Payload inválido.");
  }

  const lat = data.lat;
  const lng = data.lng;
  const radiusKm = data.radiusKm;
  const socialFilter = data.socialFilter;

  if (!isFiniteNumber(lat) || lat < -90 || lat > 90) {
    throw new HttpsError("invalid-argument", "Latitude inválida.");
  }
  if (!isFiniteNumber(lng) || lng < -180 || lng > 180) {
    throw new HttpsError("invalid-argument", "Longitude inválida.");
  }
  if (!isValidRadius(radiusKm)) {
    throw new HttpsError("invalid-argument", "Raio inválido.");
  }
  if (
    socialFilter !== undefined &&
    socialFilter !== "all" &&
    socialFilter !== "following"
  ) {
    throw new HttpsError("invalid-argument", "Filtro social inválido.");
  }

  return {
    lat,
    lng,
    radiusKm,
    socialFilter: socialFilter ?? "all",
  };
}

/**
 * Converte distancia numerica em faixa segura para UI.
 *
 * @param {number} distanceKm Distancia calculada em km.
 * @return {string} Faixa de distancia.
 */
export function distanceBandForKm(
  distanceKm: number
): NearbyPlayerResponse["distanceBand"] {
  if (distanceKm <= 1) return "under_1km";
  if (distanceKm <= 5) return "under_5km";
  if (distanceKm <= 10) return "under_10km";
  return "under_25km";
}

/**
 * Arredonda distancia para uma casa decimal.
 *
 * @param {number} distanceKm Distancia em km.
 * @return {number} Distancia arredondada.
 */
export function roundDistanceKm(distanceKm: number): number {
  return Math.round(distanceKm * 10) / 10;
}

/**
 * Garante que a localizacao ainda esta dentro da janela de retencao.
 *
 * @param {Timestamp | undefined} updatedAt Timestamp de atualizacao.
 * @param {number} nowMs Agora em milissegundos.
 * @return {boolean} True quando a localizacao e recente.
 */
function isFreshLocation(updatedAt: Timestamp | undefined, nowMs: number) {
  if (!updatedAt) return false;
  return nowMs - updatedAt.toMillis() <= MAX_LOCATION_AGE_MS;
}

/**
 * Converte documento Firestore de user_locations em candidato interno.
 *
 * @param {FirebaseFirestore.QueryDocumentSnapshot} snap Snapshot Firestore.
 * @return {CandidateLocation | null} Candidato valido ou null.
 */
function mapLocationDoc(
  snap: FirebaseFirestore.QueryDocumentSnapshot
): CandidateLocation | null {
  const data = snap.data();
  const userId = typeof data.user_id === "string" ? data.user_id : snap.id;
  const lat = data.lat;
  const lng = data.lng;
  const geohash = data.geohash;
  const locationUpdatedAt = data.location_updated_at;

  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    !isFiniteNumber(lat) ||
    !isFiniteNumber(lng) ||
    typeof geohash !== "string" ||
    !(locationUpdatedAt instanceof Timestamp)
  ) {
    return null;
  }

  return {
    userId,
    lat,
    lng,
    geohash,
    locationUpdatedAt,
  };
}

/**
 * Carrega relacoes de follow do usuario atual para os candidatos.
 *
 * @param {string} uid Usuario atual.
 * @param {string[]} candidateIds Candidatos encontrados por geohash.
 * @return {Promise<Set<string>>} IDs seguidos pelo usuario atual.
 */
async function loadFollowingSet(
  uid: string,
  candidateIds: string[]
): Promise<Set<string>> {
  const uniqueIds = [...new Set(candidateIds)];
  const snaps = await Promise.all(
    uniqueIds.map((candidateId) =>
      db()
        .doc(`users/${uid}/following/${candidateId}`)
        .get()
        .then((snap) => [candidateId, snap.exists] as const)
    )
  );
  return new Set(snaps.filter(([, exists]) => exists).map(([id]) => id));
}

/**
 * Carrega apenas perfis publicos pesquisaveis dos candidatos.
 *
 * @param {string[]} candidateIds Candidatos filtrados por distancia.
 * @param {Set<string>} followingIds IDs seguidos pelo usuario atual.
 * @return {Promise<Map<string, PublicUserProfile>>} Perfis publicos.
 */
async function loadPublicProfiles(
  candidateIds: string[],
  followingIds: Set<string>
): Promise<Map<string, PublicUserProfile>> {
  const entries = await Promise.all(
    candidateIds.map(async (candidateId) => {
      const snap = await db().doc(`users/${candidateId}`).get();
      if (!snap.exists) return null;

      const data = snap.data() ?? {};
      if (data.is_searchable !== true || data.deleted_at != null) {
        return null;
      }

      const rawName = data.name ?? data.display_name ?? data.email;
      const displayName =
        typeof rawName === "string" && rawName.trim().length > 0 ?
          rawName.trim() :
          "Jogador";

      return [
        candidateId,
        {
          id: candidateId,
          displayName,
          photoUrl:
            typeof data.photo_url === "string" ? data.photo_url : null,
          nickname:
            typeof data.nickname === "string" ? data.nickname : null,
          preferredPosition:
            typeof data.preferred_position === "string" ?
              data.preferred_position :
              null,
          followersCount:
            typeof data.followers_count === "number" ?
              data.followers_count :
              0,
          isFollowing: followingIds.has(candidateId),
        } satisfies PublicUserProfile,
      ] as const;
    })
  );

  return new Map(
    entries.filter((entry): entry is readonly [string, PublicUserProfile] =>
      entry !== null
    )
  );
}

export const discoverNearbyPlayers = secureCallable<
  DiscoverNearbyPlayersRequest,
  {players: NearbyPlayerResponse[]}
>(
  {
    appCheck: true,
    consumeAppCheckToken: false,
    rateLimit: {
      maxRequests: 30,
      windowMs: 60 * 1000,
      keyPrefix: "discover_nearby_players",
    },
    auditLogContext: async (request) => ({
      radiusKm: isRecord(request.data) ? request.data.radiusKm : undefined,
      socialFilter: isRecord(request.data) ?
        request.data.socialFilter :
        undefined,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login obrigatório.");
    }

    const payload = parseDiscoverNearbyPlayersRequest(request.data);
    const uid = request.auth.uid;
    const center: [number, number] = [payload.lat, payload.lng];
    const radiusMeters = payload.radiusKm * 1000;
    const bounds = geohashQueryBounds(center, radiusMeters);
    const candidatesById = new Map<string, CandidateLocation>();
    const nowMs = Date.now();

    try {
      const snapshots = await Promise.all(
        bounds.map(([start, end]) =>
          db()
            .collection("user_locations")
            .where("location_sharing_enabled", "==", true)
            .orderBy("geohash")
            .startAt(start)
            .endAt(end)
            .limit(LOCATION_QUERY_LIMIT_PER_BOUND)
            .get()
        )
      );

      for (const snapshot of snapshots) {
        for (const doc of snapshot.docs) {
          if (doc.id === uid) continue;
          const candidate = mapLocationDoc(doc);
          if (!candidate) continue;
          if (!isFreshLocation(candidate.locationUpdatedAt, nowMs)) continue;

          const distanceKm = distanceBetween(center, [
            candidate.lat,
            candidate.lng,
          ]);

          if (distanceKm <= payload.radiusKm) {
            candidatesById.set(candidate.userId, candidate);
          }
        }
      }

      const candidateIds = [...candidatesById.keys()];
      const followingIds = await loadFollowingSet(uid, candidateIds);
      const filteredCandidateIds = payload.socialFilter === "following" ?
        candidateIds.filter((candidateId) => followingIds.has(candidateId)) :
        candidateIds;
      const profiles = await loadPublicProfiles(filteredCandidateIds, followingIds);

      const players = filteredCandidateIds
        .map((candidateId) => {
          const candidate = candidatesById.get(candidateId);
          const profile = profiles.get(candidateId);
          if (!candidate || !profile) return null;

          const distanceKm = distanceBetween(center, [
            candidate.lat,
            candidate.lng,
          ]);

          return {
            ...profile,
            distanceKmApprox: roundDistanceKm(distanceKm),
            distanceBand: distanceBandForKm(distanceKm),
            socialContext: profile.isFollowing ? "following" : "none",
          } satisfies NearbyPlayerResponse;
        })
        .filter((player): player is NearbyPlayerResponse => player !== null)
        .sort((a, b) => a.distanceKmApprox - b.distanceKmApprox)
        .slice(0, MAX_RESULTS);

      return {players};
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Erro ao descobrir jogadores próximos", {
        uid,
        radiusKm: payload.radiusKm,
        socialFilter: payload.socialFilter,
        error,
      });
      throw new HttpsError(
        "internal",
        "Não foi possível buscar jogadores próximos."
      );
    }
  }
);
