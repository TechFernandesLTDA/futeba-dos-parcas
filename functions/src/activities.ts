import * as admin from "firebase-admin";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";

// Lazy initialization - admin.initializeApp() é chamado em index.ts
const getDb = () => admin.firestore();

/**
 * Gera atividade de jogo finalizado diretamente (chamado pelo consolidador em index.ts).
 * Aceita dados do jogo já carregados para evitar leituras duplicadas.
 *
 * @param gameId - ID do jogo
 * @param gameData - Dados do jogo (já carregados)
 * @param db - Instância do Firestore
 */
export async function generateGameFinishedActivityDirect(
  gameId: string,
  gameData: any,
  db: admin.firestore.Firestore
): Promise<void> {
  // Idempotência: verificar se atividade já foi gerada
  if (gameData.activity_generated) {
    logger.info(`[ACTIVITY_DIRECT] Atividade para game ${gameId} já gerada.`);
    return;
  }

  logger.info(`[ACTIVITY_DIRECT] Gerando atividade para game ${gameId}...`);

  // Buscar detalhes adicionais para a atividade
  const liveScoreDoc = await db.collection("live_scores").doc(gameId).get();
  let description = "Jogo finalizado! Confira os resultados e estatísticas.";

  // Buscar dados do dono do jogo para a atividade
  const userDoc = await db.collection("users").doc(gameData.owner_id).get();
  const userData = userDoc.data();
  const userName = userData ? userData.name : "Alguém";
  const userPhoto = userData ? userData.photoUrl : null;

  if (liveScoreDoc.exists) {
    const score = liveScoreDoc.data();
    if (score) {
      // Suportar ambos os formatos: snake_case (Firestore) e camelCase (legado)
      const t1Score = score.team1_score ?? score.team1Score ?? 0;
      const t2Score = score.team2_score ?? score.team2Score ?? 0;
      description = `Placar Final: Time A ${t1Score} x ${t2Score} Time B`;
    }
  }

  // Determinar visibilidade baseada na visibilidade do jogo
  let visibility = "PUBLIC";
  if (gameData.visibility === "GROUP_ONLY" || gameData.visibility === "PRIVATE") {
    visibility = "FRIENDS";
  } else if (gameData.is_public === false) {
    visibility = "FRIENDS";
  }

  const activity = {
    type: "GAME_FINISHED",
    title: gameData.name || "Futebol dos Parças",
    description: description,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
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
  batch.update(db.collection("games").doc(gameId), {activity_generated: true});

  await batch.commit();
  logger.info(`[ACTIVITY_DIRECT] Atividade gerada para ${gameId}.`);
}

export const generateActivityOnGameFinish = onDocumentUpdated("games/{gameId}", async (event) => {
  if (!event.data) return;

  const before = event.data.before.data();
  const after = event.data.after.data();
  const gameId = event.params.gameId;

  // Trigger only when status changes to FINISHED
  if (before.status !== "FINISHED" && after.status === "FINISHED") {
    // Idempotência: verificar se atividade já foi gerada
    if (after.activity_generated) {
      logger.info(`Activity for game ${gameId} already generated.`);
      return;
    }

    try {
      await generateGameFinishedActivityDirect(gameId, after, getDb());
    } catch (error) {
      logger.error("Error generating activity for game:", error);
    }
  }
});
