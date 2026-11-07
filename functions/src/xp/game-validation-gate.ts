import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {
  MAX_GOALS_PER_GAME,
  MAX_ASSISTS_PER_GAME,
  MAX_SAVES_PER_GAME,
  clampStat,
} from "../constants";
import {db} from "../_db";
import {buildGameValidationFromFirestore} from "../game-validation/aggregate";
import {isParticipationEligible} from "../game/helpers";
import {
  isScoreConsistentFromEventStream,
  readScoresMap,
} from "../games/live-events";
import type {Game, GameConfirmation} from "../models";

const LOCK_TTL_MS = 4 * 60 * 1000;

/**
 * Executa validações de segurança (owner_id, mudança de dono, existência
 * do dono), registra log de auditoria e verifica se a transição deve
 * disparar o processamento de XP.
 *
 * @param {string} gameId ID do jogo.
 * @param {Game} before Estado anterior do jogo.
 * @param {Game} after Estado novo do jogo.
 * @return {Promise<boolean>} true se o jogo deve prosseguir para o lock de XP.
 */
export async function validateGameSecurityAndShouldProcess(
  gameId: string,
  before: Game,
  after: Game
): Promise<boolean> {
  if (!after.owner_id) {
    logger.error(
      `[SECURITY] Game ${gameId}: ` +
      "Missing owner_id. Blocking processing."
    );
    return false;
  }

  if (
    before.owner_id &&
    before.owner_id !== after.owner_id
  ) {
    logger.warn(
      `[SECURITY] Game ${gameId}: owner changed ` +
      `from ${before.owner_id} ` +
      `to ${after.owner_id} ` +
      "- aborting XP processing to prevent fraud"
    );
    return false;
  }

  const ownerDoc = await db()
    .collection("users")
    .doc(after.owner_id)
    .get();
  if (!ownerDoc.exists) {
    logger.error(
      `[SECURITY] Game ${gameId}: ` +
      `owner_id ${after.owner_id} ` +
      "not found in users. Blocking processing."
    );
    return false;
  }

  if (before.status !== after.status) {
    logger.info(
      `[AUDIT] Game ${gameId}: ` +
      `Status changed ${before.status} ` +
      `-> ${after.status} ` +
      `by owner ${after.owner_id}`
    );
  }

  const releasedForProcessing =
    before.status === "FINISHED" &&
    after.status === "FINISHED" &&
    before.xp_reward_status === "HELD_FOR_REVIEW" &&
    after.xp_reward_status === "ELIGIBLE" &&
    after.xp_reward_review_decision === "APPROVED";

  return (
    (before.status !== "FINISHED" && after.status === "FINISHED") ||
    releasedForProcessing
  );
}

/**
 * Adquire o lock transacional de processamento de XP (`xp_processing`),
 * com fallback de TTL de 4 minutos para locks órfãos.
 *
 * @param {string} gameId ID do jogo.
 * @param {FirebaseFirestore.DocumentReference} gameRef Referência do jogo.
 * @return {Promise<boolean>} true se o lock foi adquirido.
 */
export async function acquireGameXpProcessingLock(
  gameId: string,
  gameRef: FirebaseFirestore.DocumentReference
): Promise<boolean> {
  const lockResult = await db().runTransaction(
    async (tx) => {
      const freshSnap = await tx.get(gameRef);
      const fresh = freshSnap.data() as Game | undefined;
      if (!fresh) {
        return {
          shouldProcess: false,
          reason: "missing" as const,
        };
      }
      if (fresh.xp_processed) {
        return {
          shouldProcess: false,
          reason: "processed" as const,
        };
      }
      if (fresh.xp_processing) {
        const lockAge =
          Date.now() - (
            fresh.xp_processing_at?.toMillis ?
              fresh.xp_processing_at.toMillis() :
              0
          );
        if (lockAge < LOCK_TTL_MS) {
          return {
            shouldProcess: false,
            reason: "processing" as const,
          };
        }
        logger.warn(
          "[LOCK_TTL] Stale xp_processing lock " +
          `detected for game ${gameId} ` +
          `(age: ${Math.round(lockAge / 1000)}s). ` +
          "Taking over."
        );
      }
      tx.update(gameRef, {
        xp_processing: true,
        xp_processing_at: FieldValue.serverTimestamp(),
      });
      return {
        shouldProcess: true,
        reason: "locked" as const,
      };
    }
  );

  if (!lockResult.shouldProcess) {
    logger.info(
      `Game ${gameId} skipped ` +
      `(${lockResult.reason}).`
    );
    return false;
  }

  return true;
}

/**
 * Valida integridade do documento do jogo recarregado e executa o
 * soft-gate de validação anti-fraude.
 *
 * @param {object} params Parâmetros de validação.
 * @return {Promise<{ok: boolean; manualRewardApproval: boolean}>} Resultado.
 */
export async function validateFetchedGameAndSoftGate(params: {
  gameId: string;
  gameData: Game | undefined;
  afterRef: FirebaseFirestore.DocumentReference;
  confirmationsDocs: FirebaseFirestore.QueryDocumentSnapshot[];
  liveScoreDoc: FirebaseFirestore.DocumentSnapshot;
  gameEventsSnap: FirebaseFirestore.QuerySnapshot;
}): Promise<{ok: boolean; manualRewardApproval: boolean}> {
  const {
    gameId,
    gameData,
    afterRef,
    confirmationsDocs,
    liveScoreDoc,
    gameEventsSnap,
  } = params;

  if (!gameData) {
    logger.error(
      `[VALIDATION] Game ${gameId}: ` +
      "Documento do jogo não encontrado. " +
      "Abortando XP."
    );
    await afterRef.update({
      xp_processed: true,
      xp_processing: false,
      xp_processing_error:
        "Game document not found " +
        "during XP processing",
    });
    return {ok: false, manualRewardApproval: false};
  }

  if (
    !gameData.owner_id ||
    typeof gameData.owner_id !== "string"
  ) {
    logger.error(
      `[VALIDATION] Game ${gameId}: ` +
      "owner_id ausente ou inválido."
    );
    await afterRef.update({
      xp_processed: true,
      xp_processing: false,
      xp_processing_error:
        "Missing or invalid owner_id",
    });
    return {ok: false, manualRewardApproval: false};
  }

  if (gameData.status !== "FINISHED") {
    logger.error(
      `[VALIDATION] Game ${gameId}: ` +
      "Status inesperado " +
      `'${gameData.status}' ` +
      "(esperado FINISHED)."
    );
    await afterRef.update({
      xp_processing: false,
      xp_processing_error:
        "Unexpected status: " +
        `${gameData.status}`,
    });
    return {ok: false, manualRewardApproval: false};
  }

  const manualRewardApproval =
    gameData.xp_reward_review_decision === "APPROVED";
  const liveScoreData =
    liveScoreDoc.exists ?
      liveScoreDoc.data() :
      undefined;
  const scoresMap = readScoresMap(liveScoreData);
  const scoreEventConsistent =
    liveScoreData && scoresMap.size > 0 ?
      isScoreConsistentFromEventStream(
        gameEventsSnap.docs,
        scoresMap,
      ) :
      undefined;

  try {
    const validationResult =
      buildGameValidationFromFirestore({
        game: gameData,
        confirmations: confirmationsDocs
          .map((doc) => doc.data()),
        eventCount: gameEventsSnap.size,
        scoreEventConsistent,
        mode: "SOFT_GATE",
      });
    await afterRef.update({
      ...validationResult,
      xp_reward_status:
        validationResult.validation_status ===
          "REVIEW_REQUIRED" &&
        !manualRewardApproval ?
          "HELD_FOR_REVIEW" :
          "ELIGIBLE",
      validation_updated_at:
        FieldValue.serverTimestamp(),
    });
    logger.info(
      "[GAME_VALIDATION_GATE] " +
      `Game ${gameId}: score ` +
      `${validationResult.validation_score}, ` +
      `status ${validationResult.validation_status}`,
      {
        reasons:
          validationResult.validation_reasons,
        version:
          validationResult.validation_version,
      },
    );

    if (
      validationResult.validation_status ===
        "REVIEW_REQUIRED" &&
      !manualRewardApproval
    ) {
      await afterRef.update({
        xp_processing: false,
        xp_reward_status: "HELD_FOR_REVIEW",
        xp_reward_held_at:
          FieldValue.serverTimestamp(),
        xp_reward_hold_reasons:
          validationResult.validation_reasons,
        xp_processing_error:
          "XP held by validation gate",
      });
      logger.warn(
        "[GAME_VALIDATION_GATE] XP held for " +
        `game ${gameId}`,
        {
          score:
            validationResult.validation_score,
          reasons:
            validationResult.validation_reasons,
        },
      );
      return {ok: false, manualRewardApproval};
    }

    if (
      validationResult.validation_status ===
        "REVIEW_REQUIRED" &&
      manualRewardApproval
    ) {
      logger.warn(
        "[GAME_VALIDATION_GATE] Processing " +
        `manual override for game ${gameId}`,
        {
          score:
            validationResult.validation_score,
          reasons:
            validationResult.validation_reasons,
          reviewedBy:
            gameData.xp_reward_reviewed_by,
        },
      );
    }
  } catch (validationError) {
    logger.warn(
      "[GAME_VALIDATION_GATE] Falha ao calcular " +
      `score do jogo ${gameId}`,
      {
        error: validationError instanceof Error ?
          validationError.message :
          String(validationError),
      },
    );
  }

  return {ok: true, manualRewardApproval};
}

/**
 * Filtra confirmações inválidas, exclui overlap temporal e ausentes,
 * e aplica clamp anti-cheat em gols, assistências e defesas.
 *
 * @param {string} gameId ID do jogo.
 * @param {GameConfirmation[]} confirmations Confirmações brutas.
 * @return {GameConfirmation[]} Confirmações elegíveis e capadas.
 */
export function filterAndClampConfirmations(
  gameId: string,
  confirmations: GameConfirmation[]
): GameConfirmation[] {
  const invalidConfirmations =
    confirmations.filter(
      (c) =>
        !c.userId ||
        typeof c.userId !== "string" ||
        c.userId.trim() === ""
    );
  if (invalidConfirmations.length > 0) {
    logger.error(
      `[VALIDATION] Game ${gameId}: ` +
      `${invalidConfirmations.length} ` +
      "confirmações com userId inválido. " +
      "Removendo da lista de processamento."
    );
  }

  const validConfirmations =
    confirmations.filter(
      (c) =>
        c.userId &&
        typeof c.userId === "string" &&
        c.userId.trim() !== ""
    );

  const overlapExcluded = validConfirmations.filter(
    (c) => c.suspiciousOverlap === true
  );
  if (overlapExcluded.length > 0) {
    for (const c of overlapExcluded) {
      logger.warn(
        "[ANTI-CHEAT][OVERLAP] Jogador excluído do processamento " +
        `de XP por suspicious_overlap: userId=${c.userId}, ` +
        `gameId=${gameId}`
      );
    }
    validConfirmations.splice(
      0,
      validConfirmations.length,
      ...validConfirmations.filter(
        (c) => c.suspiciousOverlap !== true
      )
    );
  }

  const presenceExcluded = validConfirmations.filter(
    (c) => !isParticipationEligible(c)
  );
  if (presenceExcluded.length > 0) {
    for (const c of presenceExcluded) {
      logger.warn(
        "[XP_ELIGIBILITY][PRESENCE] Jogador confirmado sem presença " +
        `real foi excluído do processamento de XP: userId=${c.userId}, ` +
        `gameId=${gameId}`
      );
    }
    validConfirmations.splice(
      0,
      validConfirmations.length,
      ...validConfirmations.filter(isParticipationEligible)
    );
  }

  for (const conf of validConfirmations) {
    if (conf.goals < 0 || conf.goals > MAX_GOALS_PER_GAME) {
      logger.warn(
        "[ANTI-CHEAT] User " +
        `${conf.userId}: goals=${conf.goals} ` +
        `above cap ${MAX_GOALS_PER_GAME} ` +
        "— clamping to cap"
      );
    }
    conf.goals = clampStat(conf.goals, MAX_GOALS_PER_GAME);

    if (conf.assists < 0 || conf.assists > MAX_ASSISTS_PER_GAME) {
      logger.warn(
        "[ANTI-CHEAT] User " +
        `${conf.userId}: assists=${conf.assists} ` +
        `above cap ${MAX_ASSISTS_PER_GAME} ` +
        "— clamping to cap"
      );
    }
    conf.assists = clampStat(conf.assists, MAX_ASSISTS_PER_GAME);

    if (conf.saves < 0 || conf.saves > MAX_SAVES_PER_GAME) {
      logger.warn(
        "[ANTI-CHEAT] User " +
        `${conf.userId}: saves=${conf.saves} ` +
        `above cap ${MAX_SAVES_PER_GAME} ` +
        "— clamping to cap"
      );
    }
    conf.saves = clampStat(conf.saves, MAX_SAVES_PER_GAME);
  }

  return validConfirmations;
}
