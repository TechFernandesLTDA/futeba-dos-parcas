/**
 * SECFIX #442: Denormalização de location_lat/lng pra reduzir
 * precisão em reads públicos (LGPD).
 *
 * STAGE 1 (este PR):
 * - Trigger onGameWritten denormaliza location_lat/lng →
 *   location_lat_approx/lng_approx (3 decimais ~111m) automaticamente
 * - Callable denormalizeGameLocations (ADMIN one-shot) backfill games
 *   existentes
 * - Reads continuam expondo lat/lng exato (backward compat)
 *
 * STAGE 2 (PR futuro):
 * - Repos clientes lêem location_*_approx pra reads públicos
 * - Rules: bloquear leitura de location_lat/lng exato pra
 *   non-confirmed/non-owner
 *
 * Trade-off: 3 decimais = ~111m precisão (suficiente pra "está em SP
 * zona oeste" mas não pra inferir endereço residencial exato).
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";

/**
 * Arredonda número pra N casas decimais.
 * 3 decimais = ~111m precisão geográfica
 * (suficiente pra "região do bairro", insuficiente pra endereço).
 *
 * @param {number} value - Valor a arredondar
 * @param {number} decimals - Casas decimais (default 3)
 * @return {number} Valor arredondado
 */
function roundCoord(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Detecta se coords mudaram comparando before/after.
 *
 * @param {admin.firestore.DocumentData|undefined} before - Estado antes
 * @param {admin.firestore.DocumentData|undefined} after - Estado depois
 * @return {boolean} true se mudaram
 */
function coordsChanged(
  before: admin.firestore.DocumentData | undefined,
  after: admin.firestore.DocumentData | undefined
): boolean {
  if (!before && !after) return false;
  if (!before || !after) return true;
  return (
    before.location_lat !== after.location_lat ||
    before.location_lng !== after.location_lng
  );
}

/**
 * Detecta se approx fields já estão calculados corretamente.
 * Evita writes recursivos (trigger -> write -> trigger -> ...).
 *
 * @param {admin.firestore.DocumentData} data - Doc data
 * @return {boolean} true se approx já reflete coords reais
 */
function approxAlreadyCorrect(
  data: admin.firestore.DocumentData
): boolean {
  if (
    typeof data.location_lat !== "number" ||
    typeof data.location_lng !== "number"
  ) {
    return true; // sem coords reais, nada a fazer
  }
  const expectedLat = roundCoord(data.location_lat);
  const expectedLng = roundCoord(data.location_lng);
  return (
    data.location_lat_approx === expectedLat &&
    data.location_lng_approx === expectedLng
  );
}

/**
 * Trigger: calcula location_*_approx automaticamente quando
 * coords mudarem. Idempotente, pula se já correto.
 */
export const onGameWrittenDenormalizeLocation =
  onDocumentWritten(
    {
      region: "us-central1",
      document: "games/{gameId}",
    },
    async (event) => {
      const gameId = event.params.gameId;
      const before = event.data?.before.data();
      const after = event.data?.after.data();

      // Doc deletado — nada a fazer
      if (!after) return;

      // Coords não mudaram E approx já correto — skip
      if (
        !coordsChanged(before, after) &&
        approxAlreadyCorrect(after)
      ) {
        return;
      }

      // Sem coords reais — skip
      if (
        typeof after.location_lat !== "number" ||
        typeof after.location_lng !== "number"
      ) {
        return;
      }

      const latApprox = roundCoord(after.location_lat);
      const lngApprox = roundCoord(after.location_lng);

      // Já correto (proteção extra contra loop)
      if (
        after.location_lat_approx === latApprox &&
        after.location_lng_approx === lngApprox
      ) {
        return;
      }

      try {
        await admin.firestore()
          .doc(`games/${gameId}`)
          .update({
            location_lat_approx: latApprox,
            location_lng_approx: lngApprox,
          });
        logger.info(
          `[GAME_LOC] Denormalized ${gameId}: ` +
            `(${latApprox}, ${lngApprox})`
        );
      } catch (err) {
        logger.error(
          `[GAME_LOC] Failed to denormalize ${gameId}:`,
          err
        );
      }
    }
  );

/**
 * Callable one-shot: backfill location_*_approx em games
 * existentes. Apenas ADMIN. Deve rodar 1x após deploy.
 */
export const denormalizeGameLocations = onCall(
  {
    region: "us-central1",
    // FIX SEC-2026-05-08: enforce App Check em prod. Callable ADMIN manipula
    // games em batch — não deve aceitar chamada não-verificada.
    enforceAppCheck: process.env.NODE_ENV === "production",
    consumeAppCheckToken: true,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (request) => {
    const {auth} = request;
    if (!auth) {
      throw new HttpsError(
        "unauthenticated",
        "Login obrigatório"
      );
    }

    if (auth.token?.role !== "ADMIN") {
      throw new HttpsError(
        "permission-denied",
        "Apenas ADMIN pode rodar denormalização"
      );
    }

    const db = admin.firestore();
    const gamesSnap = await db.collection("games").get();

    let updated = 0;
    let skipped = 0;
    const errors: Array<{gameId: string; error: string}> = [];

    const CHUNK_SIZE = 200;
    const docs = gamesSnap.docs;

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();
      let chunkUpdates = 0;

      for (const doc of chunk) {
        const data = doc.data();

        if (
          typeof data.location_lat !== "number" ||
          typeof data.location_lng !== "number"
        ) {
          skipped++;
          continue;
        }

        const latApprox = roundCoord(data.location_lat);
        const lngApprox = roundCoord(data.location_lng);

        if (
          data.location_lat_approx === latApprox &&
          data.location_lng_approx === lngApprox
        ) {
          skipped++;
          continue;
        }

        batch.update(doc.ref, {
          location_lat_approx: latApprox,
          location_lng_approx: lngApprox,
        });
        chunkUpdates++;
      }

      if (chunkUpdates === 0) continue;

      try {
        await batch.commit();
        updated += chunkUpdates;
      } catch (err) {
        logger.error(
          `[GAME_LOC_BACKFILL] Chunk ${i} failed:`,
          err
        );
        for (const doc of chunk) {
          errors.push({
            gameId: doc.id,
            error: (err as Error).message,
          });
        }
      }
    }

    logger.info(
      `[GAME_LOC_BACKFILL] Done: ${updated} updated, ` +
        `${skipped} skipped, ${errors.length} errors`
    );

    return {
      success: true,
      updated,
      skipped,
      errors,
      total: docs.length,
    };
  }
);
