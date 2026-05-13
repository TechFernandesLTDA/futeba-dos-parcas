import * as admin from "firebase-admin";
import {
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";

// Lazy initialization - admin.initializeApp() é chamado
// em index.ts
const getDb = () => admin.firestore();

/**
 * Gera atividade de jogo finalizado diretamente
 * (chamado pelo consolidador em index.ts).
 * Aceita dados do jogo já carregados para evitar
 * leituras duplicadas.
 *
 * @param {string} gameId - ID do jogo
 * @param {FirebaseFirestore.DocumentData} gameData -
 *   Dados do jogo (já carregados)
 * @param {admin.firestore.Firestore} db -
 *   Instância do Firestore
 * @return {Promise<void>} Promise vazia
 */
export async function generateGameFinishedActivityDirect(
  gameId: string,
  gameData: FirebaseFirestore.DocumentData,
  db: admin.firestore.Firestore
): Promise<void> {
  logger.info(
    "[ACTIVITY_DIRECT] Gerando atividade " +
    `para game ${gameId}...`
  );

  // Validate owner_id exists and is valid (read outside tx, non-critical)
  const ownerId = gameData.owner_id;
  if (!ownerId || typeof ownerId !== "string") {
    logger.warn(
      "[ACTIVITY_DIRECT] Game " +
      `${gameId} sem owner_id valido. ` +
      "Atividade orfa evitada."
    );
    return;
  }

  // FIX #1145: Run idempotency check + write inside transaction
  // with deterministic doc ID to prevent duplicate activities
  // from at-least-once trigger deliveries.
  try {
    await db.runTransaction(async (tx) => {
      const gameRef = db.collection("games").doc(gameId);
      const freshSnap = await tx.get(gameRef);
      if (!freshSnap.exists) return;
      const fresh = freshSnap.data()!;

      // Re-check activity_generated on fresh data (TOCTOU guard)
      if (fresh.activity_generated) {
        logger.info(
          "[ACTIVITY_DIRECT] Atividade para game " +
          `${gameId} já gerada (detected in transaction).`
        );
        return;
      }

      // Read user data outside tx (idempotent, non-critical)
      const [liveScoreDoc, userDoc] = await Promise.all([
        db.collection("live_scores").doc(gameId).get(),
        db.collection("users").doc(ownerId).get(),
      ]);

      let description = "Jogo finalizado! Confira os resultados e estatisticas.";
      const userData = userDoc.data();
      const userName = userData ? userData.name : "Alguem";
      const userPhoto = userData ?
        (userData.photo_url ?? userData.photoUrl ?? null) : null;

      if (liveScoreDoc.exists) {
        const score = liveScoreDoc.data();
        if (score) {
          const t1Score = score.team1_score ?? score.team1Score ?? 0;
          const t2Score = score.team2_score ?? score.team2Score ?? 0;
          description = `Placar Final: Time A ${t1Score} x ${t2Score} Time B`;
        }
      }

      let visibility = "PUBLIC";
      if (
        fresh.visibility === "GROUP_ONLY" ||
        fresh.visibility === "PRIVATE"
      ) {
        visibility = "FRIENDS";
      } else if (fresh.is_public === false) {
        visibility = "FRIENDS";
      }

      const activity = {
        type: "GAME_FINISHED",
        title: fresh.name || "Futebol dos Parcas",
        description,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        reference_id: gameId,
        reference_type: "GAME",
        user_id: ownerId,
        user_name: userName,
        user_photo: userPhoto,
        visibility,
        metadata: {
          location: fresh.location_name ?? fresh.locationName ?? "",
          game_id: gameId,
        },
      };

      // Use deterministic doc ID = gameId for idempotency
      // If triggered twice, second write fails (doc already exists)
      // or is no-op with merge:false
      tx.set(db.collection("activities").doc(gameId), activity);
      tx.update(gameRef, {activity_generated: true});
    });

    logger.info(
      `[ACTIVITY_DIRECT] Atividade gerada para ${gameId}.`
    );
  } catch (error) {
    logger.error(
      "[ACTIVITY_DIRECT] Erro ao gerar atividade:",
      error
    );
    throw error;
  }
}

/**
 * Trigger que gera atividade quando um jogo
 * muda de status para FINISHED.
 *
 * @param {object} event - Evento de atualização
 *   do Firestore
 * @return {Promise<void>} Promise vazia
 */
export const generateActivityOnGameFinish =
  onDocumentUpdated(
    {
      document: "games/{gameId}",
      region: "southamerica-east1",
    },
    async (event) => {
      if (!event.data) return;

      const before = event.data.before.data();
      const after = event.data.after.data();
      const gameId = event.params.gameId;

      // Trigger only when status changes to FINISHED
      if (
        before.status !== "FINISHED" &&
        after.status === "FINISHED"
      ) {
        // Idempotência: verificar se atividade
        // já foi gerada
        if (after.activity_generated) {
          logger.info(
            `Activity for game ${gameId}` +
            " already generated."
          );
          return;
        }

        try {
          await generateGameFinishedActivityDirect(
            gameId,
            after,
            getDb()
          );
        } catch (error) {
          logger.error(
            "Error generating activity for game:",
            error
          );
          throw error;
        }
      }
    }
  );
