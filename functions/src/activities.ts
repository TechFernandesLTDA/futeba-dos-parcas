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
  // Idempotência: verificar se atividade já foi gerada
  if (gameData.activity_generated) {
    logger.info(
      "[ACTIVITY_DIRECT] Atividade para game " +
      `${gameId} já gerada.`
    );
    return;
  }

  logger.info(
    "[ACTIVITY_DIRECT] Gerando atividade " +
    `para game ${gameId}...`
  );

  // Buscar detalhes adicionais em paralelo
  const [liveScoreDoc, userDoc] = await Promise.all([
    db.collection("live_scores").doc(gameId).get(),
    db.collection("users").doc(gameData.owner_id).get(),
  ]);
  let description =
    "Jogo finalizado! Confira os resultados e estatísticas.";

  const userData = userDoc.data();
  const userName = userData ? userData.name : "Alguém";
  const userPhoto = userData ? userData.photoUrl : null;

  if (liveScoreDoc.exists) {
    const score = liveScoreDoc.data();
    if (score) {
      // Suportar ambos os formatos: snake_case
      // (Firestore) e camelCase (legado)
      const t1Score =
        score.team1_score ?? score.team1Score ?? 0;
      const t2Score =
        score.team2_score ?? score.team2Score ?? 0;
      description =
        `Placar Final: Time A ${t1Score}` +
        ` x ${t2Score} Time B`;
    }
  }

  // Determinar visibilidade baseada na visibilidade
  // do jogo
  let visibility = "PUBLIC";
  if (
    gameData.visibility === "GROUP_ONLY" ||
    gameData.visibility === "PRIVATE"
  ) {
    visibility = "FRIENDS";
  } else if (gameData.is_public === false) {
    visibility = "FRIENDS";
  }

  const activity = {
    type: "GAME_FINISHED",
    title: gameData.name || "Futebol dos Parças",
    description: description,
    created_at:
      admin.firestore.FieldValue.serverTimestamp(),
    reference_id: gameId,
    reference_type: "GAME",
    user_id: gameData.owner_id,
    user_name: userName,
    user_photo: userPhoto,
    visibility: visibility,
    metadata: {
      location: gameData.locationName || "",
      game_id: gameId,
    },
  };

  const batch = db.batch();
  const activityRef = db.collection("activities").doc();

  batch.set(activityRef, activity);
  batch.update(
    db.collection("games").doc(gameId),
    {activity_generated: true}
  );

  await batch.commit();
  logger.info(
    `[ACTIVITY_DIRECT] Atividade gerada para ${gameId}.`
  );
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
    "games/{gameId}",
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
        }
      }
    }
  );
