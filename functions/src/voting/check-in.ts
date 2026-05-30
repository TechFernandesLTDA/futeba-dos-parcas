/**
 * SECFIX #426: server-side check-in validation.
 *
 * Cliente NAO escreve checked_in/was_present direto.
 * Em vez disso chama checkInToGame({gameId, lat, lng}) que:
 * 1. Valida user confirmed em jogo
 * 2. Valida lat/lng dentro de range valido
 * 3. Calcula distancia ao game.location_lat/lng
 * 4. Bloqueia se distancia > game.checkin_radius_meters
 * 5. Bloqueia se game.status nao for CONFIRMED ou LIVE
 * 6. Escreve checked_in=true via Admin SDK
 *
 * Combina com client-side mock GPS detection (PR #461)
 * para defesa em profundidade.
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {db} from "../_db";
import {checkRateLimit} from "../middleware/rate-limiter";
import {requireProfileComplete} from "../middleware/require-profile-complete";
import {FUNCTION_REGION} from "../constants";

const DEFAULT_RADIUS_METERS = 200;
const MAX_RADIUS_METERS = 2000;
const MAX_GPS_ACCURACY_METERS = 100;
const QR_RADIUS_METERS = 500;

interface CheckInRequest {
  gameId: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  qrToken?: string;
}

/**
 * Distancia haversine entre 2 coords em metros.
 *
 * @param {number} lat1 lat ponto A
 * @param {number} lng1 lng ponto A
 * @param {number} lat2 lat ponto B
 * @param {number} lng2 lng ponto B
 * @return {number} distancia em metros
 */
function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const checkInToGame = onCall(
  {
    region: FUNCTION_REGION,
    // FIX #1577: FUNCTIONS_EMULATOR em vez de NODE_ENV
    enforceAppCheck: !process.env.FUNCTIONS_EMULATOR,
    consumeAppCheckToken: true,
  },
  async (request) => {
    requireProfileComplete(request);

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }
    const {auth, data} = request;
    const uid = auth.uid;

    // FIX #584/H12: rate limit pra prevenir GPS coordinate enumeration.
    // Antes: sem rate limit, atacante binary-searchearia coordenadas
    // via mensagens de erro de distancia.
    // Agora: 10 calls/min por user (suficiente pra tentativa legítima
    // + retry com GPS lock fresh).
    const {allowed, resetAt} = await checkRateLimit(uid, {
      maxRequests: 10,
      windowMs: 60 * 1000,
      keyPrefix: "checkin",
    });
    if (!allowed) {
      const resetInSec = Math.ceil(
        (resetAt.getTime() - Date.now()) / 1000
      );
      throw new HttpsError(
        "resource-exhausted",
        `Rate limit excedido. Tente novamente em ${resetInSec}s.`,
        {retryAfter: resetInSec}
      );
    }

    const {gameId, lat, lng, accuracy, qrToken} =
      (data ?? {}) as CheckInRequest;
    if (typeof gameId !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "gameId obrigatorio",
      );
    }

    const hasQrToken = typeof qrToken === "string" && qrToken.length > 0;
    const hasGps = typeof lat === "number" && typeof lng === "number";

    if (!hasQrToken && !hasGps) {
      throw new HttpsError(
        "invalid-argument",
        "lat/lng ou qr_token obrigatorios",
      );
    }
    if (
      hasGps &&
      typeof accuracy === "number" &&
      accuracy > MAX_GPS_ACCURACY_METERS
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Precisao GPS insuficiente (${Math.round(accuracy)}m). ` +
          `Maximo ${MAX_GPS_ACCURACY_METERS}m.`,
      );
    }
    // FIX #584/M8: gameId sem max-length permitia cliente passar 10MB
    // string causando doc path overflow. Cap em 128 chars (Firestore
    // recomendação para document IDs).
    if (gameId.length === 0 || gameId.length > 128) {
      throw new HttpsError(
        "invalid-argument",
        "gameId deve ter entre 1 e 128 caracteres",
      );
    }
    if (hasGps) {
      if (lat! < -90 || lat! > 90 || lng! < -180 || lng! > 180) {
        throw new HttpsError(
          "invalid-argument",
          "Coordenadas fora de range",
        );
      }
      if (Math.abs(lat!) < 0.01 && Math.abs(lng!) < 0.01) {
        throw new HttpsError(
          "invalid-argument",
          "Localização inválida",
        );
      }
    }

    const gameSnap = await db().doc(`games/${gameId}`).get();
    if (!gameSnap.exists) {
      throw new HttpsError("not-found", "Jogo nao encontrado");
    }
    const game = gameSnap.data() as Record<string, unknown>;

    const status = game.status as string;
    if (status !== "CONFIRMED" && status !== "LIVE") {
      throw new HttpsError(
        "failed-precondition",
        "Check-in apenas em jogos CONFIRMED ou LIVE",
      );
    }

    // FIX #647: Time window — check-in apenas dentro da janela do jogo.
    // FIX #784: janela assimétrica — 30min ANTES do início (não atrasar
    // muito), mas SEM limite depois (jogo LIVE = qualquer horário válido).
    // Status CONFIRMED ou LIVE já é validado acima — gate semântico real.
    const gameDateTime = game.dateTime as
      | admin.firestore.Timestamp
      | undefined;
    if (
      gameDateTime &&
      typeof gameDateTime.toDate === "function"
    ) {
      const gameTime = gameDateTime.toDate();
      const now = new Date();
      const diffMs = now.getTime() - gameTime.getTime();
      // Apenas bloquear check-in MUITO ANTES do início (>30 min antes)
      // diffMs negativo = agora está antes do jogo
      if (diffMs < -30 * 60 * 1000) {
        throw new HttpsError(
          "failed-precondition",
          "Fora da janela de check-in " +
            "(mais de 30 min antes do início do jogo)",
        );
      }
      // Sem limite superior: jogo LIVE permite check-in a qualquer hora
    }

    let qrValid = false;
    if (hasQrToken) {
      const storedToken = game.checkin_qr_token as string | undefined;
      if (typeof storedToken === "string" && storedToken === qrToken) {
        // FIX #2051: QR token expiration check (24h)
        const expiresAt = game.checkin_qr_token_expires_at as
          admin.firestore.Timestamp | undefined;
        if (
          expiresAt &&
          typeof expiresAt.toDate === "function" &&
          expiresAt.toDate().getTime() < Date.now()
        ) {
          throw new HttpsError(
            "permission-denied",
            "QR token expirado",
          );
        }
        qrValid = true;
      } else {
        throw new HttpsError(
          "permission-denied",
          "QR token inválido ou expirado",
        );
      }
    }

    let dist = 0;
    let radius = DEFAULT_RADIUS_METERS;

    // FIX #2051: Always validate GPS when coordinates provided.
    // QR uses lenient 500m radius instead of skipping GPS entirely.
    if (hasGps) {
      const gameLat = game.location_lat as number | undefined;
      const gameLng = game.location_lng as number | undefined;
      if (
        typeof gameLat !== "number" ||
        typeof gameLng !== "number"
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Jogo sem coordenadas",
        );
      }

      dist = haversineMeters(lat!, lng!, gameLat, gameLng);

      if (qrValid) {
        radius = QR_RADIUS_METERS;
      } else {
        const radiusRaw = (game.checkin_radius_meters as number) ??
          DEFAULT_RADIUS_METERS;
        radius = Math.min(
          Math.max(radiusRaw, DEFAULT_RADIUS_METERS),
          MAX_RADIUS_METERS,
        );
        if (radiusRaw !== radius) {
          logger.warn(
            "[CHECKIN_RADIUS_CLAMP]",
            {
              gameId,
              configured: radiusRaw,
              used: radius,
            },
          );
        }
      }

      if (dist > radius) {
        logger.warn(
          "[CHECKIN_OUT_OF_RANGE]",
          {uid, gameId, dist: Math.round(dist), radius, qrValid},
        );
        throw new HttpsError(
          "permission-denied",
          `Voce esta a ${Math.round(dist)}m do campo ` +
            `(limite ${radius}m)`,
        );
      }
    }

    // FIX #647: TOCTOU — leitura e escrita do doc de
    // confirmacao dentro de transaction para evitar
    // race entre checar checked_in e escrever.
    const confId = `${gameId}_${uid}`;
    const confRef = db().doc(`confirmations/${confId}`);
    const gameRef = db().doc(`games/${gameId}`);

    await db().runTransaction(async (tx) => {
      const confSnap = await tx.get(confRef);
      if (!confSnap.exists) {
        throw new HttpsError(
          "permission-denied",
          "Voce nao esta confirmado neste jogo",
        );
      }
      const conf =
        confSnap.data() as Record<string, unknown>;
      if (conf.status !== "CONFIRMED") {
        throw new HttpsError(
          "failed-precondition",
          "Confirmacao precisa estar em status CONFIRMED",
        );
      }

      // Anti-replay: idempotencia
      if (conf.checked_in === true) {
        return {
          success: true,
          already: true,
        };
      }

      // FIX #2051: Invalidate QR token after successful check-in
      if (qrValid) {
        tx.update(gameRef, {
          checkin_qr_token: admin.firestore.FieldValue.delete(),
          checkin_qr_token_expires_at: admin.firestore.FieldValue.delete(),
        });
      }

      tx.set(
        confRef,
        {
          checked_in: true,
          checked_in_at: admin.firestore
            .FieldValue.serverTimestamp(),
          check_in_lat_approx:
            typeof lat === "number" ?
              Math.round(lat * 1000) / 1000 :
              null,
          check_in_lng_approx:
            typeof lng === "number" ?
              Math.round(lng * 1000) / 1000 :
              null,
          check_in_accuracy_m:
            typeof accuracy === "number" ?
              Math.round(accuracy) :
              null,
          check_in_distance_m: hasGps ? Math.round(dist) : null,
          check_in_method: qrValid ? "qr" : "gps",
          was_present: true,
        },
        {merge: true},
      );

      return {
        success: true,
        distance_m: hasGps ? Math.round(dist) : null,
      };
    });

    return {
      success: true,
      distance_m: hasGps ? Math.round(dist) : null,
      method: qrValid ? "qr" : "gps",
    };
  },
);

export const generateCheckinToken = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: !process.env.FUNCTIONS_EMULATOR,
    consumeAppCheckToken: true,
  },
  async (request) => {
    requireProfileComplete(request);

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }
    const {auth, data} = request;
    const uid = auth.uid;

    const {gameId} = (data ?? {}) as {gameId?: string};
    if (typeof gameId !== "string" || gameId.length === 0 || gameId.length > 128) {
      throw new HttpsError(
        "invalid-argument",
        "gameId obrigatorio",
      );
    }

    const gameSnap = await db().doc(`games/${gameId}`).get();
    if (!gameSnap.exists) {
      throw new HttpsError("not-found", "Jogo nao encontrado");
    }
    const game = gameSnap.data() as Record<string, unknown>;

    const ownerId = game.owner_id as string;
    const coOrganizers = (game.co_organizers as string[]) ?? [];
    const isAdmin = request.auth?.token?.role === "ADMIN";

    if (ownerId !== uid && !coOrganizers.includes(uid) && !isAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Apenas o dono ou admin pode gerar QR code",
      );
    }

    const status = game.status as string;
    if (status !== "CONFIRMED" && status !== "LIVE") {
      throw new HttpsError(
        "failed-precondition",
        "QR code apenas em jogos CONFIRMED ou LIVE",
      );
    }

    // FIX #2051: Reuse existing valid token to prevent spamming
    const existingToken = game.checkin_qr_token as string | undefined;
    const existingExpiresAt = game.checkin_qr_token_expires_at as
      admin.firestore.Timestamp | undefined;
    if (
      typeof existingToken === "string" &&
      existingExpiresAt &&
      typeof existingExpiresAt.toDate === "function" &&
      existingExpiresAt.toDate().getTime() > Date.now()
    ) {
      logger.info("[CHECKIN_QR_TOKEN_REUSE]", {gameId, uid});
      return {success: true, token: existingToken};
    }

    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);

    await db().doc(`games/${gameId}`).update({
      checkin_qr_token: token,
      checkin_qr_token_expires_at: admin.firestore.Timestamp.fromMillis(
        Date.now() + 24 * 60 * 60 * 1000
      ),
      checkin_qr_token_created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("[CHECKIN_QR_TOKEN_GENERATED]", {gameId, uid});

    return {success: true, token};
  },
);
